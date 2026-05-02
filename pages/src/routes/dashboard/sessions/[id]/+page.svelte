<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api, ApiError } from '$lib/api';
  import RatingScale from '$components/RatingScale.svelte';
  import ChemotypeBadge from '$components/ChemotypeBadge.svelte';
  import VoidSessionModal from '$components/VoidSessionModal.svelte';

  interface Rating { phase: 'pre' | 'post' | 'next_day'; scale_code: string; value: number; captured_at: number }
  interface Task { id: string; description: string; complexity: number | null; estimated_minutes: number | null; actual_minutes: number | null; completion_status: string | null; quality_rating: number | null }
  interface AdverseEvent { id: string; code: string; severity: number | null; note: string | null }
  interface SessionDetail {
    id: string;
    started_at: number;
    ended_at: number | null;
    batch_id: string;
    batch_number: string;
    cultivar_name: string;
    producer: string;
    purpose_tags_json: string;
    route: string;
    device: string | null;
    vape_temp_c: number | null;
    dose_grams: number | null;
    onset_minutes: number | null;
    peak_minutes: number | null;
    note: string | null;
    voided: number;
    methodology_version: string;
    classification: string | null;
    dominant_terpene: string | null;
    secondary_terpene: string | null;
    ratings: Rating[];
    tasks: Task[];
    adverse_events: AdverseEvent[];
  }

  const id = $derived($page.params.id);
  let session = $state<SessionDetail | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let savedMessage = $state<string | null>(null);

  let postRatings = $state<Record<string, number | null>>({});
  let onsetMinutes = $state<number | null>(null);
  let peakMinutes = $state<number | null>(null);
  let postNote = $state('');

  // Mirrors `rating_scale` reference data in migration 0002 so the post-rating
  // sliders show the same anchor descriptors as the pre-rating flow. Until we
  // have a /api/scales endpoint to fetch these from, this is the source of
  // truth on the client.
  const SCALE_DEFS: Record<string, { label: string; a0: string; a5: string; a10: string }> = {
    focus:           { label: 'Focus',                a0: 'Cannot focus at all',  a5: 'Can focus with effort',  a10: 'Effortless deep focus' },
    anxiety:         { label: 'Anxiety',              a0: 'None',                 a5: 'Moderate',               a10: 'Overwhelming' },
    pain:            { label: 'Pain',                 a0: 'None',                 a5: 'Moderate',               a10: 'Worst imaginable' },
    mood:            { label: 'Mood',                 a0: 'Worst possible',       a5: 'Neutral',                a10: 'Best possible' },
    energy:          { label: 'Energy',               a0: 'Exhausted',            a5: 'Normal',                 a10: 'High energy' },
    appetite:        { label: 'Appetite',             a0: 'None',                 a5: 'Normal',                 a10: 'Strong hunger' },
    sleep_readiness: { label: 'Sleep readiness',      a0: 'Wide awake',           a5: 'Could rest if needed',   a10: 'Falling asleep' },
    task_initiation: { label: 'Task initiation',      a0: 'Cannot start tasks',   a5: 'Some difficulty',        a10: 'Start immediately' },
    working_memory:  { label: 'Working memory',       a0: 'Cannot hold thoughts', a5: 'Average',                a10: 'Crystal clear' },
    impulse_control: { label: 'Impulse control',      a0: 'No control',           a5: 'Some control',           a10: 'Full control' },
    hyperfocus:      { label: 'Hyperfocus tendency',  a0: 'None',                 a5: 'Moderate',               a10: 'Locked in' },
    time_perception: { label: 'Time perception',      a0: 'Time disorientation',  a5: 'Some sense of time',     a10: 'Accurate time sense' },
  };

  function scaleDef(code: string) {
    return SCALE_DEFS[code] ?? { label: code, a0: '', a5: '', a10: '' };
  }

  async function load() {
    error = null;
    try {
      session = await api<SessionDetail>(`/sessions/${id}`);
      // Pre-populate post slots for each scale we captured a pre-rating on
      const preScales = new Set(session.ratings.filter((r) => r.phase === 'pre').map((r) => r.scale_code));
      const postExisting = new Map(
        session.ratings.filter((r) => r.phase === 'post').map((r) => [r.scale_code, r.value])
      );
      const next: Record<string, number | null> = {};
      for (const code of preScales) next[code] = postExisting.get(code) ?? null;
      postRatings = next;
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    }
  }

  onMount(load);

  let withinEditWindow = $derived.by(() => {
    if (!session) return false;
    return Date.now() - session.started_at < 24 * 60 * 60 * 1000;
  });

  let purposeTags = $derived.by(() => {
    if (!session) return [];
    try {
      return JSON.parse(session.purpose_tags_json) as string[];
    } catch { return []; }
  });

  async function submitPost() {
    if (!session) return;

    const ratings = Object.entries(postRatings)
      .filter(([, v]) => v !== null)
      .map(([scale_code, value]) => ({ scale_code, value: value as number }));

    if (ratings.length === 0) {
      error = 'Pick at least one post-rating before saving.';
      savedMessage = null;
      return;
    }

    busy = true;
    error = null;
    savedMessage = null;
    try {
      const result = await api<{ ok: boolean; count: number }>(
        `/sessions/${session.id}/ratings?phase=post`,
        {
          method: 'POST',
          body: {
            ratings,
            onset_minutes: onsetMinutes ?? undefined,
            peak_minutes: peakMinutes ?? undefined,
            note: postNote || undefined,
          },
        }
      );
      await load();
      const stamp = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      savedMessage = `Saved ${result.count} post-rating${result.count === 1 ? '' : 's'} at ${stamp}.`;
      // Keep the success banner visible long enough to read, then clear.
      setTimeout(() => {
        savedMessage = null;
      }, 4000);
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    } finally {
      busy = false;
    }
  }

  // ─── Adverse events ─────────────────────────────────────────────
  // Methodology v0.1 §3.2 — adverse event capture is part of the post-session
  // record. Surfaced here as a quick-tap chip flow because logging severe
  // events is exactly when typing-into-textareas friction matters most.
  const COMMON_AE_CODES: Array<{ code: string; label: string }> = [
    { code: 'dry_mouth',     label: 'Dry mouth' },
    { code: 'red_eyes',      label: 'Red eyes' },
    { code: 'tachycardia',   label: 'Racing heart' },
    { code: 'paranoia',      label: 'Paranoia / unease' },
    { code: 'anxiety_spike', label: 'Anxiety spike' },
    { code: 'cough',         label: 'Cough / throat irritation' },
    { code: 'dizziness',     label: 'Dizziness' },
    { code: 'headache',      label: 'Headache' },
    { code: 'nausea',        label: 'Nausea' },
    { code: 'sedation',      label: 'Excessive sedation' },
  ];
  let aeCode = $state<string>('');
  let aeSeverity = $state<number>(2);
  let aeNote = $state('');
  let aeBusy = $state(false);

  async function submitAdverseEvent() {
    if (!session) return;
    if (!aeCode) {
      error = 'Pick an adverse-event type.';
      return;
    }
    aeBusy = true;
    error = null;
    try {
      await api(`/sessions/${session.id}/adverse_events`, {
        method: 'POST',
        body: {
          code: aeCode,
          severity: aeSeverity,
          note: aeNote || undefined,
        },
      });
      aeCode = '';
      aeSeverity = 2;
      aeNote = '';
      await load();
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    } finally {
      aeBusy = false;
    }
  }

  // ─── Repeat-this-session ────────────────────────────────────────
  // Pushes the same batch into quick-log and prefills purpose tags. The user
  // still captures fresh pre-ratings on the next-session screen — that's the
  // methodology guarantee, we don't carry pre-ratings across.
  function repeatSession() {
    if (!session) return;
    goto('/dashboard/quick-log');
  }

  // Modal-driven void flow. The native prompt() was a WCAG nightmare and
  // looked like a system error. VoidSessionModal renders an in-page dialog
  // and calls back here once the user confirms with a valid reason.
  let voidModalOpen = $state(false);

  function openVoidModal() {
    if (!session) return;
    voidModalOpen = true;
  }

  function cancelVoid() {
    voidModalOpen = false;
  }

  async function confirmVoid(reason: string) {
    if (!session) return;
    voidModalOpen = false;
    busy = true;
    try {
      await api(`/sessions/${session.id}/void`, { method: 'POST', body: { reason } });
      await load();
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    } finally {
      busy = false;
    }
  }

  function preFor(scale: string): number | undefined {
    return session?.ratings.find((r) => r.phase === 'pre' && r.scale_code === scale)?.value;
  }

  function postFor(scale: string): number | undefined {
    return session?.ratings.find((r) => r.phase === 'post' && r.scale_code === scale)?.value;
  }

  function delta(scale: string): number | null {
    const p = preFor(scale);
    const q = postFor(scale);
    return p !== undefined && q !== undefined ? q - p : null;
  }

  let scaleCodes = $derived.by(() =>
    session ? [...new Set(session.ratings.map((r) => r.scale_code))] : []
  );

  function formatTimestamp(ms: number): string {
    return new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }
</script>

<svelte:head><title>Session — Phenologue</title></svelte:head>

{#if error}<div class="form-error">{error}</div>{/if}

{#if session}
  <div class="head">
    <div>
      <h4>Session · {session.methodology_version}</h4>
      <h1>{session.cultivar_name}</h1>
      <p class="meta">
        Batch <a href={`/dashboard/batches/${session.batch_id}`}><code>{session.batch_number}</code></a> · {session.producer} ·
        <span class="ts">{formatTimestamp(session.started_at)}</span>
        {#if session.voided}<span class="voided">voided</span>{/if}
      </p>
    </div>
    {#if !session.voided && withinEditWindow}
      <button type="button" class="ghost danger" onclick={openVoidModal} disabled={busy}>Void session</button>
    {/if}
  </div>

  <div class="badges">
    <ChemotypeBadge
      classification={session.classification}
      dominant={session.dominant_terpene}
      secondary={session.secondary_terpene}
    />
    {#each purposeTags as tag (tag)}
      <span class="purpose-tag">{tag}</span>
    {/each}
  </div>

  <div class="meta-grid">
    <div><dt>Route</dt><dd>{session.route}</dd></div>
    {#if session.device}<div><dt>Device</dt><dd>{session.device}</dd></div>{/if}
    {#if session.vape_temp_c}<div><dt>Temp</dt><dd>{session.vape_temp_c}°C</dd></div>{/if}
    {#if session.dose_grams}<div><dt>Dose</dt><dd>{session.dose_grams}g</dd></div>{/if}
    {#if session.onset_minutes}<div><dt>Onset</dt><dd>{session.onset_minutes} min</dd></div>{/if}
    {#if session.peak_minutes}<div><dt>Peak</dt><dd>{session.peak_minutes} min</dd></div>{/if}
  </div>

  <h2>Ratings</h2>
  <table class="data">
    <thead>
      <tr><th>Scale</th><th>Pre</th><th>Post</th><th>Δ</th></tr>
    </thead>
    <tbody>
      {#each scaleCodes as scale (scale)}
        <tr>
          <td>{scaleDef(scale).label}</td>
          <td>{preFor(scale) ?? '—'}</td>
          <td>{postFor(scale) ?? '—'}</td>
          <td class:positive={(delta(scale) ?? 0) > 0} class:negative={(delta(scale) ?? 0) < 0}>
            {#if delta(scale) !== null}{(delta(scale)! > 0 ? '+' : '') + delta(scale)}{:else}—{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if !session.voided && withinEditWindow}
    <hr class="divider" />
    <h2>Add post-session ratings</h2>
    <p class="meta">Within 24h of session start. Same scales as pre-ratings.</p>

    {#if savedMessage}
      <div class="form-saved" role="status" aria-live="polite">{savedMessage}</div>
    {/if}

    {#each scaleCodes as scale (scale)}
      {@const def = scaleDef(scale)}
      <RatingScale
        code={scale}
        label={def.label}
        anchor0={def.a0}
        anchor5={def.a5}
        anchor10={def.a10}
        bind:value={postRatings[scale]}
      />
    {/each}

    <div class="form-row">
      <label for="onset">Onset (minutes to first effect)</label>
      <input id="onset" type="number" min="0" max="180" bind:value={onsetMinutes} />
    </div>
    <div class="form-row">
      <label for="peak">Peak (minutes to peak effect)</label>
      <input id="peak" type="number" min="0" max="240" bind:value={peakMinutes} />
    </div>
    <div class="form-row">
      <label for="postnote">Post-session note</label>
      <textarea id="postnote" rows="3" bind:value={postNote}></textarea>
    </div>

    <button type="button" disabled={busy} onclick={submitPost}>
      {busy ? 'Saving…' : 'Save post-ratings'}
    </button>
  {:else if !session.voided && !withinEditWindow}
    <p class="meta">Edit window has closed. Sessions are immutable after 24 hours.</p>
  {/if}

  {#if !session.voided && withinEditWindow}
    <hr class="divider" />
    <h2>Adverse events</h2>
    <p class="meta">Anything from "dry mouth" to "racing heart". Logged anonymously to the aggregate dataset if you've consented.</p>

    {#if session.adverse_events.length}
      <table class="data ae-list">
        <thead><tr><th>Event</th><th>Severity</th><th>Note</th></tr></thead>
        <tbody>
          {#each session.adverse_events as ev (ev.id)}
            <tr>
              <td>{ev.code.replace(/_/g, ' ')}</td>
              <td>{ev.severity ?? '—'} / 5</td>
              <td>{ev.note ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <div class="ae-quick">
      <div class="form-row">
        <label>What happened?</label>
        <div class="chips">
          {#each COMMON_AE_CODES as opt (opt.code)}
            <button type="button" class="chip" class:active={aeCode === opt.code} onclick={() => (aeCode = opt.code)}>
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      {#if aeCode}
        <div class="form-row">
          <label for="ae-severity">Severity (1 mild → 5 severe)</label>
          <div class="severity-row">
            {#each [1, 2, 3, 4, 5] as s (s)}
              <button type="button" class="dot-sev" class:active={aeSeverity >= s} onclick={() => (aeSeverity = s)} aria-label="Severity {s}">{s}</button>
            {/each}
          </div>
        </div>

        <div class="form-row">
          <label for="ae-note">Note (optional)</label>
          <input id="ae-note" type="text" bind:value={aeNote} placeholder="What was different about this one?" />
        </div>

        <button type="button" disabled={aeBusy} onclick={submitAdverseEvent}>
          {aeBusy ? 'Saving…' : 'Log adverse event'}
        </button>
      {/if}
    </div>
  {/if}

  {#if !session.voided}
    <hr class="divider" />
    <button type="button" class="repeat" onclick={repeatSession}>↺ Log another session like this one</button>
  {/if}
{:else if !error}
  <p class="meta">Loading…</p>
{/if}

<VoidSessionModal open={voidModalOpen} onConfirm={confirmVoid} onCancel={cancelVoid} />

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .ts { font-family: var(--mono); }
  .voided {
    color: var(--accent);
    border: 1px solid var(--accent);
    padding: 0.05rem 0.5rem;
    margin-left: 0.5rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .badges {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin: 0.5rem 0 1rem;
  }

  .purpose-tag {
    font-family: var(--mono);
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    background: var(--paper-deep);
    border: 1px solid var(--rule);
    text-transform: lowercase;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.6rem;
    padding: 0.8rem 1rem;
    background: var(--paper-deep);
    border: 1px solid var(--paper-edge);
    margin: 1rem 0 1.5rem;
  }

  .meta-grid dt {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .meta-grid dd {
    font-family: var(--mono);
    font-size: 0.95rem;
    color: var(--ink);
  }

  .danger { color: var(--accent); border-color: var(--accent); background: transparent; }
  .danger:hover { background: var(--accent); color: var(--paper); }

  td.positive { color: #2c7a3e; font-weight: 500; }
  td.negative { color: var(--accent); font-weight: 500; }

  .form-saved {
    font-family: var(--mono);
    font-size: 0.85rem;
    color: #2c7a3e;
    background: var(--paper-deep);
    border-left: 3px solid #2c7a3e;
    padding: 0.6rem 0.9rem;
    margin: 0 0 1rem;
  }

  /* ── Adverse event quick-add ───────────────────────────────────── */
  .ae-list { margin-bottom: 1.5rem; max-width: 36rem; }

  .ae-quick { padding: 1rem 1.1rem; background: var(--paper-deep); border: 1px solid var(--paper-edge); }

  .ae-quick .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }

  .ae-quick .chip {
    background: var(--paper);
    color: var(--ink-muted);
    border: 1px solid var(--rule);
    padding: 0.4rem 0.7rem;
    font-family: var(--mono);
    font-size: 0.78rem;
    text-transform: lowercase;
    letter-spacing: 0;
  }
  .ae-quick .chip:hover { background: var(--paper-deep); color: var(--ink); border-color: var(--ink); }
  .ae-quick .chip.active { background: var(--accent); color: var(--paper); border-color: var(--accent); }

  .severity-row { display: flex; gap: 0.3rem; }
  .dot-sev {
    appearance: none;
    width: 2.4rem;
    height: 2.4rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    color: var(--ink-muted);
    font-family: var(--mono);
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 2px;
    text-transform: none;
    letter-spacing: 0;
    padding: 0;
  }
  .dot-sev:hover { background: var(--paper-edge); color: var(--ink); border-color: var(--ink); }
  .dot-sev.active { background: var(--accent); color: var(--paper); border-color: var(--accent); }

  /* ── Repeat session ────────────────────────────────────────────── */
  .repeat {
    background: transparent;
    color: var(--ink);
    border: 2px dashed var(--rule);
    padding: 0.8rem 1.2rem;
    width: 100%;
    text-align: center;
    font-family: var(--mono);
    font-size: 0.85rem;
    text-transform: lowercase;
    letter-spacing: 0.04em;
  }
  .repeat:hover { background: var(--paper-deep); border-color: var(--ink); border-style: solid; color: var(--ink); }
</style>

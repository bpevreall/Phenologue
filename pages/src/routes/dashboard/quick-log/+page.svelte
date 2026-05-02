<script lang="ts">
  /**
   * Quick log — the friction-killer flow.
   *
   * Most logged sessions are repeats of the same cultivar/batch. The 4-step
   * guided flow at /dashboard/sessions/new is correct for first-time use of a
   * batch but is overkill for "same as yesterday". Quick log:
   *
   *   1. Pick from your recent batches (one tap)
   *   2. Pre-ratings + dose + purpose on a single screen
   *   3. Submit -> redirected to session detail to capture post-ratings later
   *
   * Methodology constraint still enforced: pre-ratings required, batch_id
   * required, purpose tags required, methodology_version stamped server-side.
   */
  import { onMount } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import { goto } from '$app/navigation';
  import RatingScale from '$components/RatingScale.svelte';
  import ChemotypeBadge from '$components/ChemotypeBadge.svelte';

  interface RecentSession {
    id: string;
    started_at: number;
    batch_id: string;
    cultivar_name: string;
    producer: string;
    classification: string | null;
    dominant_terpene: string | null;
    secondary_terpene: string | null;
    route: string;
    device: string | null;
    vape_temp_c: number | null;
    dose_grams: number | null;
    purpose_tags_json: string;
  }

  interface RecentBatch {
    batch_id: string;
    cultivar_name: string;
    producer: string;
    classification: string | null;
    dominant_terpene: string | null;
    secondary_terpene: string | null;
    last_used_at: number;
    last_session_id: string;
    last_route: string;
    last_device: string | null;
    last_vape_temp_c: number | null;
    last_dose_grams: number | null;
    last_purpose_tags: string[];
    n_sessions: number;
  }

  const PURPOSE_OPTIONS = [
    'focus', 'creativity', 'physical_activity', 'social', 'relaxation',
    'sleep_prep', 'pain_management', 'anxiety_management',
    'appetite_stimulation', 'recreational', 'exploratory',
  ];

  const SCALE_DEFS: Array<{ code: string; label: string; a0: string; a5: string; a10: string }> = [
    { code: 'focus',           label: 'Focus',           a0: 'Cannot focus at all',  a5: 'Can focus with effort', a10: 'Effortless deep focus' },
    { code: 'anxiety',         label: 'Anxiety',         a0: 'None',                 a5: 'Moderate',              a10: 'Overwhelming' },
    { code: 'pain',            label: 'Pain',            a0: 'None',                 a5: 'Moderate',              a10: 'Worst imaginable' },
    { code: 'mood',            label: 'Mood',            a0: 'Worst possible',       a5: 'Neutral',               a10: 'Best possible' },
    { code: 'energy',          label: 'Energy',          a0: 'Exhausted',            a5: 'Normal',                a10: 'High energy' },
    { code: 'appetite',        label: 'Appetite',        a0: 'None',                 a5: 'Normal',                a10: 'Strong hunger' },
    { code: 'sleep_readiness', label: 'Sleep readiness', a0: 'Wide awake',           a5: 'Could rest if needed',  a10: 'Falling asleep' },
  ];

  // See sessions/new — same rationale: default to mood/anxiety/pain, the
  // rest are behind a `<details>` disclosure.
  const CORE_SCALES = ['mood', 'anxiety', 'pain'] as const;

  let recentBatches = $state<RecentBatch[]>([]);
  let chosen = $state<RecentBatch | null>(null);
  let preRatings = $state<Record<string, number | null>>({});
  let purposeTags = $state<string[]>([]);
  let doseGrams = $state<number | null>(0.1);
  let vapeTempC = $state<number | null>(195);
  let device = $state('');
  let route = $state<'vape' | 'oil' | 'edible' | 'other'>('vape');
  let busy = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    for (const s of SCALE_DEFS) preRatings[s.code] = null;
    try {
      const sessions = await api<RecentSession[]>('/sessions');
      recentBatches = collapseToBatches(sessions);
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    }
  });

  /**
   * Collapse a session list into one row per batch, with the most recent
   * session metadata as the prefill. Sessions older than 60 days drop off.
   */
  function collapseToBatches(sessions: RecentSession[]): RecentBatch[] {
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const map = new Map<string, RecentBatch>();
    for (const s of sessions) {
      if (s.started_at < cutoff) continue;
      const existing = map.get(s.batch_id);
      if (existing) {
        existing.n_sessions++;
        if (s.started_at > existing.last_used_at) {
          // Newer session; refresh prefill metadata from it.
          existing.last_used_at = s.started_at;
          existing.last_session_id = s.id;
          existing.last_route = s.route;
          existing.last_device = s.device;
          existing.last_vape_temp_c = s.vape_temp_c;
          existing.last_dose_grams = s.dose_grams;
          existing.last_purpose_tags = parseTags(s.purpose_tags_json);
        }
      } else {
        map.set(s.batch_id, {
          batch_id: s.batch_id,
          cultivar_name: s.cultivar_name,
          producer: s.producer,
          classification: s.classification,
          dominant_terpene: s.dominant_terpene,
          secondary_terpene: s.secondary_terpene,
          last_used_at: s.started_at,
          last_session_id: s.id,
          last_route: s.route,
          last_device: s.device,
          last_vape_temp_c: s.vape_temp_c,
          last_dose_grams: s.dose_grams,
          last_purpose_tags: parseTags(s.purpose_tags_json),
          n_sessions: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.last_used_at - a.last_used_at);
  }

  function parseTags(raw: string | undefined): string[] {
    if (!raw) return [];
    try { const t = JSON.parse(raw); return Array.isArray(t) ? t : []; } catch { return []; }
  }

  function pick(batch: RecentBatch) {
    chosen = batch;
    purposeTags = [...batch.last_purpose_tags];
    route = (batch.last_route as typeof route) ?? 'vape';
    device = batch.last_device ?? '';
    vapeTempC = batch.last_vape_temp_c ?? 195;
    doseGrams = batch.last_dose_grams ?? 0.1;
  }

  function togglePurpose(tag: string) {
    purposeTags = purposeTags.includes(tag)
      ? purposeTags.filter((t) => t !== tag)
      : [...purposeTags, tag];
  }

  let preRatingsValid = $derived(Object.values(preRatings).some((v) => v !== null));

  async function submit() {
    if (!chosen) return;
    if (!preRatingsValid) {
      error = 'Methodology v0.1 requires at least one pre-rating.';
      return;
    }
    if (purposeTags.length === 0) {
      error = 'Pick at least one purpose tag.';
      return;
    }

    busy = true;
    error = null;
    try {
      const result = await api<{ id: string }>('/sessions', {
        method: 'POST',
        body: {
          batch_id: chosen.batch_id,
          purpose_tags: purposeTags,
          route,
          device: device || undefined,
          vape_temp_c: route === 'vape' ? (vapeTempC ?? undefined) : undefined,
          dose_grams: doseGrams ?? undefined,
          pre_ratings: Object.entries(preRatings)
            .filter(([, v]) => v !== null)
            .map(([scale_code, value]) => ({ scale_code, value: value as number })),
        },
      });
      goto(`/dashboard/sessions/${result.id}`);
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    } finally {
      busy = false;
    }
  }

  function formatRecency(ms: number): string {
    const diff = Date.now() - ms;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
</script>

<svelte:head><title>Quick log — Phenologue</title></svelte:head>

<h4>Quick log</h4>
<h1>Same as last time?</h1>
<p class="meta">Pick from your recent batches; metadata pre-fills from the latest session. New batch? Use the <a href="/dashboard/sessions/new">guided flow</a>.</p>

{#if error}<div class="form-error">{error}</div>{/if}

{#if recentBatches.length === 0 && !chosen}
  <p>No recent sessions — start with the <a href="/dashboard/sessions/new">guided flow</a> for your first session against a new batch.</p>
{/if}

{#if !chosen}
  <ul class="batches">
    {#each recentBatches as b (b.batch_id)}
      <li>
        <button type="button" class="batch-card" data-chemotype={b.classification ?? 'unclassified'} onclick={() => pick(b)}>
          <div class="head">
            <div>
              <div class="name">{b.cultivar_name}</div>
              <div class="producer">{b.producer}</div>
            </div>
            <div class="recency">
              <div class="time">{formatRecency(b.last_used_at)}</div>
              <div class="n">{b.n_sessions} session{b.n_sessions === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div class="badge-row">
            <ChemotypeBadge classification={b.classification} dominant={b.dominant_terpene} secondary={b.secondary_terpene} />
            {#if b.last_dose_grams != null}<span class="dose">{b.last_dose_grams}g · {b.last_route}{b.last_vape_temp_c ? ` · ${b.last_vape_temp_c}°C` : ''}</span>{/if}
          </div>
          {#if b.last_purpose_tags.length}
            <div class="tags">
              {#each b.last_purpose_tags as tag (tag)}<span class="tag">{tag}</span>{/each}
            </div>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
{:else}
  <div class="picked">
    <div class="picked-head">
      <div>
        <div class="name">{chosen.cultivar_name}</div>
        <div class="meta">{chosen.producer} · {chosen.classification ?? 'unclassified'}</div>
      </div>
      <button type="button" class="ghost" onclick={() => (chosen = null)}>Change batch</button>
    </div>

    <h3>Pre-ratings</h3>
    <p class="rating-hint">Methodology v0.1 requires at least one pre-rating. Skip what isn't relevant.</p>
    {#each SCALE_DEFS.filter((s) => CORE_SCALES.includes(s.code as typeof CORE_SCALES[number])) as s (s.code)}
      <RatingScale
        code={s.code}
        label={s.label}
        anchor0={s.a0}
        anchor5={s.a5}
        anchor10={s.a10}
        bind:value={preRatings[s.code]}
      />
    {/each}

    <details class="more-scales">
      <summary>+ More scales <span class="more-meta">(focus, energy, appetite, sleep)</span></summary>
      {#each SCALE_DEFS.filter((s) => !CORE_SCALES.includes(s.code as typeof CORE_SCALES[number])) as s (s.code)}
        <RatingScale
          code={s.code}
          label={s.label}
          anchor0={s.a0}
          anchor5={s.a5}
          anchor10={s.a10}
          bind:value={preRatings[s.code]}
        />
      {/each}
    </details>

    <h3>Session</h3>
    <div class="form-row">
      <label>Purpose tags</label>
      <div class="chips">
        {#each PURPOSE_OPTIONS as tag (tag)}
          <button type="button" class="chip" class:active={purposeTags.includes(tag)} onclick={() => togglePurpose(tag)}>{tag.replace(/_/g, ' ')}</button>
        {/each}
      </div>
    </div>

    <div class="row-grid">
      <div class="form-row">
        <label for="route">Route</label>
        <select id="route" bind:value={route}>
          <option value="vape">Vape</option>
          <option value="oil">Oil</option>
          <option value="edible">Edible</option>
          <option value="other">Other</option>
        </select>
      </div>

      {#if route === 'vape'}
        <div class="form-row">
          <label for="device">Device</label>
          <input id="device" type="text" bind:value={device} />
        </div>
        <div class="form-row">
          <label for="temp">Temp (°C)</label>
          <input id="temp" type="number" min="140" max="230" bind:value={vapeTempC} />
        </div>
      {/if}

      <div class="form-row">
        <label for="dose">Dose (g)</label>
        <input id="dose" type="number" min="0" max="2" step="0.01" bind:value={doseGrams} />
      </div>
    </div>

    <button type="button" disabled={busy || !preRatingsValid} onclick={submit}>
      {busy ? 'Logging…' : 'Start session →'}
    </button>
  </div>
{/if}

<style>
  .batches {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
    display: grid;
    gap: 0.6rem;
  }

  .batch-card {
    display: block;
    width: 100%;
    text-align: left;
    background: var(--paper-deep);
    color: var(--ink);
    border: 1px solid var(--paper-edge);
    border-left: 4px solid var(--chip, var(--rule));
    padding: 0.9rem 1.1rem;
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .batch-card:hover {
    background: var(--paper);
    border-color: var(--ink);
  }

  .batch-card .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .name {
    font-family: var(--serif);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .producer, .meta {
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .recency {
    text-align: right;
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--ink-muted);
  }

  .recency .time {
    font-size: 0.85rem;
    color: var(--ink);
  }

  .badge-row {
    margin-top: 0.4rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .dose {
    font-family: var(--mono);
    font-size: 0.78rem;
    color: var(--ink-soft);
  }

  .tags {
    margin-top: 0.4rem;
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  .tag {
    padding: 0.05rem 0.5rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    font-family: var(--mono);
    font-size: 0.7rem;
    text-transform: lowercase;
    color: var(--ink-muted);
  }

  .picked-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    padding-bottom: 0.8rem;
    margin-bottom: 1rem;
    border-bottom: 2px double var(--ink);
  }

  .row-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.75rem;
  }

  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip {
    background: var(--paper);
    color: var(--ink-muted);
    border: 1px solid var(--rule);
    padding: 0.4rem 0.7rem;
    font-size: 0.78rem;
    text-transform: lowercase;
    letter-spacing: 0;
  }
  .chip:hover { background: var(--paper-deep); color: var(--ink); border-color: var(--ink); }
  .chip.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  .rating-hint {
    font-family: var(--mono);
    font-size: 0.8rem;
    color: var(--ink-muted);
    margin: -0.2rem 0 1rem;
    letter-spacing: 0.02em;
  }

  .more-scales {
    margin: 0.5rem 0 1.5rem;
    border-top: 1px dashed var(--rule);
    padding-top: 0.8rem;
  }
  .more-scales > summary {
    cursor: pointer;
    font-family: var(--mono);
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
    padding: 0.4rem 0;
    list-style: none;
  }
  .more-scales > summary::-webkit-details-marker { display: none; }
  .more-scales > summary:hover { color: var(--accent); }
  .more-scales[open] > summary {
    color: var(--ink);
    margin-bottom: 0.8rem;
    border-bottom: 1px solid var(--rule);
  }
  .more-meta {
    text-transform: lowercase;
    letter-spacing: 0;
    color: var(--ink-muted);
    margin-left: 0.4rem;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import { goto } from '$app/navigation';
  import RatingScale from '$components/RatingScale.svelte';
  import ChemotypeBadge from '$components/ChemotypeBadge.svelte';
  import StepBar from '$components/StepBar.svelte';

  // Methodology v0.1 requires ≥1 pre-rating, but in practice most logs use
  // mood / anxiety / pain. Showing all seven scales up-front feels clinical
  // (77 dot-buttons on screen). Default to these three; the rest are behind
  // a `<details>` disclosure for users who want to capture more.
  const CORE_SCALES = ['mood', 'anxiety', 'pain'] as const;

  interface Cultivar {
    id: string;
    name: string;
    producer: string;
    batches: Array<{
      id: string;
      batch_number: string;
      classification: string | null;
      dominant_terpene: string | null;
      secondary_terpene: string | null;
      measurement_status: string;
    }>;
  }

  interface Scale {
    code: string;
    label: string;
    anchor_0: string;
    anchor_5: string;
    anchor_10: string;
    category: string;
    condition_code: string | null;
  }

  let step = $state<'pick_cultivar' | 'pick_batch' | 'pre_ratings' | 'session_meta'>('pick_cultivar');

  let cultivars = $state<Cultivar[]>([]);
  let cultivarQuery = $state('');
  let chosenCultivar = $state<Cultivar | null>(null);
  let chosenBatchId = $state<string | null>(null);

  let scales = $state<Scale[]>([]);
  let preRatings = $state<Record<string, number | null>>({});

  let purposeTags = $state<string[]>([]);
  let route = $state<'vape' | 'oil' | 'edible' | 'other'>('vape');
  let device = $state('');
  let vapeTempC = $state<number | null>(195);
  let doseGrams = $state<number | null>(0.1);
  let note = $state('');

  let busy = $state(false);
  let error = $state<string | null>(null);

  const PURPOSE_OPTIONS = [
    'focus', 'creativity', 'physical_activity', 'social', 'relaxation',
    'sleep_prep', 'pain_management', 'anxiety_management',
    'appetite_stimulation', 'recreational', 'exploratory',
  ];

  onMount(async () => {
    await reloadCultivars();
    // The scales endpoint isn't implemented separately; for v0.1 we hard-code
    // the core seven scales the methodology mandates so the form still works
    // before reference data is fetched from the API.
    scales = HARD_CODED_SCALES;
    for (const s of scales) preRatings[s.code] = null;
  });

  async function reloadCultivars() {
    try {
      cultivars = await api<Cultivar[]>('/cultivars', {
        query: { q: cultivarQuery || undefined },
      });
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    }
  }

  async function pickCultivar(c: Cultivar) {
    try {
      // Fetch detail with batches
      chosenCultivar = await api<Cultivar>(`/cultivars/${c.id}`);
      step = 'pick_batch';
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    }
  }

  function pickBatch(batchId: string) {
    chosenBatchId = batchId;
    step = 'pre_ratings';
  }

  function togglePurpose(tag: string) {
    if (purposeTags.includes(tag)) {
      purposeTags = purposeTags.filter((t) => t !== tag);
    } else {
      purposeTags = [...purposeTags, tag];
    }
  }

  function preRatingsValid() {
    return Object.values(preRatings).some((v) => v !== null);
  }

  async function submit() {
    if (!chosenBatchId) return;
    if (purposeTags.length === 0) {
      error = 'Pick at least one purpose tag.';
      return;
    }
    if (!preRatingsValid()) {
      error = 'Methodology v0.1 requires at least one pre-rating.';
      return;
    }

    busy = true;
    error = null;
    try {
      const result = await api<{ id: string }>('/sessions', {
        method: 'POST',
        body: {
          batch_id: chosenBatchId,
          purpose_tags: purposeTags,
          route,
          device: device || undefined,
          vape_temp_c: vapeTempC ?? undefined,
          dose_grams: doseGrams ?? undefined,
          note: note || undefined,
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

  const HARD_CODED_SCALES: Scale[] = [
    { code: 'focus', label: 'Focus', anchor_0: 'Cannot focus at all', anchor_5: 'Can focus with effort', anchor_10: 'Effortless deep focus', category: 'core', condition_code: null },
    { code: 'anxiety', label: 'Anxiety', anchor_0: 'None', anchor_5: 'Moderate', anchor_10: 'Overwhelming', category: 'core', condition_code: null },
    { code: 'pain', label: 'Pain', anchor_0: 'None', anchor_5: 'Moderate', anchor_10: 'Worst imaginable', category: 'core', condition_code: null },
    { code: 'mood', label: 'Mood', anchor_0: 'Worst possible', anchor_5: 'Neutral', anchor_10: 'Best possible', category: 'core', condition_code: null },
    { code: 'energy', label: 'Energy', anchor_0: 'Exhausted', anchor_5: 'Normal', anchor_10: 'High energy', category: 'core', condition_code: null },
    { code: 'appetite', label: 'Appetite', anchor_0: 'None', anchor_5: 'Normal', anchor_10: 'Strong hunger', category: 'core', condition_code: null },
    { code: 'sleep_readiness', label: 'Sleep readiness', anchor_0: 'Wide awake', anchor_5: 'Could rest if needed', anchor_10: 'Falling asleep', category: 'core', condition_code: null },
  ];
</script>

<svelte:head><title>Start session — Phenologue</title></svelte:head>

<h4>New entry</h4>
<h1>Start a session</h1>

{#if error}<div class="form-error">{error}</div>{/if}

<StepBar
  steps={['Cultivar', 'Batch', 'Pre-ratings', 'Meta']}
  current={['pick_cultivar', 'pick_batch', 'pre_ratings', 'session_meta'].indexOf(step)}
/>

{#if step === 'pick_cultivar'}
  <section>
    <p>Pick the cultivar you're about to consume. If it isn't listed, it can be added from the cultivars page.</p>
    <div class="form-row">
      <label for="q">Search</label>
      <input id="q" type="text" bind:value={cultivarQuery} oninput={reloadCultivars} placeholder="L.A. S.A.G.E., Karamel Kandy…" />
    </div>
    <ul class="picklist">
      {#each cultivars as c (c.id)}
        <li>
          <button type="button" class="ghost" onclick={() => pickCultivar(c)}>
            <span class="primary">{c.name}</span>
            <span class="meta">{c.producer}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{:else if step === 'pick_batch'}
  <section>
    <p>Pick the batch number for {chosenCultivar?.name}. Batch fidelity is a methodology requirement — different batches of the same cultivar are not pooled.</p>
    {#if !chosenCultivar?.batches?.length}
      <p class="meta">No batches yet. Add one from the cultivars page first.</p>
    {/if}
    <ul class="picklist">
      {#each chosenCultivar?.batches ?? [] as b (b.id)}
        <li>
          <button type="button" class="ghost" onclick={() => pickBatch(b.id)}>
            <span class="primary">{b.batch_number}</span>
            <ChemotypeBadge classification={b.classification} dominant={b.dominant_terpene} secondary={b.secondary_terpene} measurementStatus={b.measurement_status} />
          </button>
        </li>
      {/each}
    </ul>
    <button type="button" class="ghost" onclick={() => (step = 'pick_cultivar')}>← Back</button>
  </section>
{:else if step === 'pre_ratings'}
  <section>
    <p>Pre-state ratings — how you feel <em>right now</em>, before consumption.</p>
    <p class="rating-hint">Methodology v0.1 requires at least one pre-rating. Skip what isn't relevant.</p>
    {#each scales.filter((s) => CORE_SCALES.includes(s.code as typeof CORE_SCALES[number])) as s (s.code)}
      <RatingScale
        code={s.code}
        label={s.label}
        anchor0={s.anchor_0}
        anchor5={s.anchor_5}
        anchor10={s.anchor_10}
        bind:value={preRatings[s.code]}
      />
    {/each}

    <details class="more-scales">
      <summary>+ More scales <span class="more-meta">(focus, energy, appetite, sleep)</span></summary>
      {#each scales.filter((s) => !CORE_SCALES.includes(s.code as typeof CORE_SCALES[number])) as s (s.code)}
        <RatingScale
          code={s.code}
          label={s.label}
          anchor0={s.anchor_0}
          anchor5={s.anchor_5}
          anchor10={s.anchor_10}
          bind:value={preRatings[s.code]}
        />
      {/each}
    </details>

    <div class="actions">
      <button type="button" class="ghost" onclick={() => (step = 'pick_batch')}>← Back</button>
      <button type="button" disabled={!preRatingsValid()} onclick={() => (step = 'session_meta')}>Continue →</button>
    </div>
  </section>
{:else if step === 'session_meta'}
  <section>
    <p>Session details. These can be edited within 24 hours.</p>

    <div class="form-row">
      <label>Purpose tags <span class="meta">(pick one or more)</span></label>
      <div class="chips">
        {#each PURPOSE_OPTIONS as tag (tag)}
          <button type="button" class="chip" class:active={purposeTags.includes(tag)} onclick={() => togglePurpose(tag)}>
            {tag.replace(/_/g, ' ')}
          </button>
        {/each}
      </div>
    </div>

    <div class="form-row">
      <label for="route">Route of administration</label>
      <select id="route" bind:value={route}>
        <option value="vape">Vape (flower)</option>
        <option value="oil">Oil (sublingual)</option>
        <option value="edible">Edible</option>
        <option value="other">Other</option>
      </select>
    </div>

    {#if route === 'vape'}
      <div class="form-row">
        <label for="device">Device</label>
        <input id="device" type="text" bind:value={device} placeholder="Mighty+, Tinymight 2…" />
      </div>
      <div class="form-row">
        <label for="temp">Vape temperature (°C)</label>
        <input id="temp" type="number" min="140" max="230" bind:value={vapeTempC} />
      </div>
    {/if}

    <div class="form-row">
      <label for="dose">Dose (grams)</label>
      <input id="dose" type="number" min="0" max="2" step="0.01" bind:value={doseGrams} />
    </div>

    <div class="form-row">
      <label for="note">Pre-session note (optional)</label>
      <textarea id="note" rows="3" bind:value={note}></textarea>
    </div>

    <div class="actions">
      <button type="button" class="ghost" onclick={() => (step = 'pre_ratings')}>← Back</button>
      <button type="button" disabled={busy} onclick={submit}>{busy ? 'Logging…' : 'Start session'}</button>
    </div>
  </section>
{/if}

<style>
  .rating-hint {
    font-family: var(--mono);
    font-size: 0.8rem;
    color: var(--ink-muted);
    margin: -0.5rem 0 1.2rem;
    letter-spacing: 0.02em;
  }

  .more-scales {
    margin: 0.5rem 0 1rem;
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

  .picklist {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
    display: grid;
    gap: 0.5rem;
  }

  .picklist button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    padding: 0.7rem 1rem;
    font-size: 1rem;
  }

  .primary {
    font-family: var(--serif);
    font-weight: 500;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

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

  .actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 1.5rem;
  }

  .actions .ghost { background: transparent; color: var(--ink-muted); }
  .actions .ghost:hover { background: var(--paper-deep); color: var(--ink); border-color: var(--ink); }
</style>

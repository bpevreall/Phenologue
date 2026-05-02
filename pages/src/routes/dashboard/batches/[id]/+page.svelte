<script lang="ts">
  /**
   * Batch detail — chemotype, organoleptic assessment, your sessions vs this batch.
   *
   * Methodology v0.1 §7 — organoleptic assessment is how a patient bridges
   * "what does this smell like" to a structured terpene-profile inference. The
   * descriptor → terpene map lives in the DB (`terpene_descriptor_map`) and
   * the inference pipeline is in `worker/src/lib/inference.ts`. This page is
   * the patient surface for it.
   */
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import ChemotypeBadge from '$components/ChemotypeBadge.svelte';
  import TerpenePill from '$components/TerpenePill.svelte';

  interface Batch {
    id: string;
    cultivar_id: string;
    cultivar_name: string;
    producer: string;
    country_origin: string | null;
    batch_number: string;
    harvest_date: string | null;
    test_date: string | null;
    irradiation: string | null;
    coa_url: string | null;
    measurement_status: 'measured' | 'partial' | 'inferred';
    thc_pct: number | null;
    cbd_pct: number | null;
    total_cannabinoids_pct: number | null;
    terp_pinene_a: number | null;
    terp_pinene_b: number | null;
    terp_myrcene: number | null;
    terp_limonene: number | null;
    terp_terpinolene: number | null;
    terp_linalool: number | null;
    terp_caryophyllene: number | null;
    terp_humulene: number | null;
    terp_ocimene: number | null;
    terp_bisabolol: number | null;
    terp_farnesene: number | null;
    terp_total_pct: number | null;
    classification: string | null;
    dominant_terpene: string | null;
    dominant_pct: number | null;
    secondary_terpene: string | null;
    secondary_pct: number | null;
  }

  // Methodology v0.1 §7.1 — controlled descriptor vocabulary.
  // Codes here MUST match `terpene_descriptor_map.descriptor_code` rows.
  const DESCRIPTORS: Array<{ family: string; items: Array<{ code: string; label: string }> }> = [
    { family: 'Citrus', items: [
      { code: 'lemon',         label: 'lemon' },
      { code: 'lime',          label: 'lime' },
      { code: 'orange',        label: 'orange' },
      { code: 'grapefruit',    label: 'grapefruit' },
      { code: 'sour_citrus',   label: 'sour citrus' },
    ]},
    { family: 'Pine / forest', items: [
      { code: 'pine',          label: 'pine' },
      { code: 'fir',           label: 'fir' },
      { code: 'eucalyptus',    label: 'eucalyptus' },
      { code: 'fresh_herb',    label: 'fresh herb' },
      { code: 'sage',          label: 'sage' },
      { code: 'rosemary',      label: 'rosemary' },
      { code: 'forest',        label: 'forest' },
      { code: 'green',         label: 'green' },
    ]},
    { family: 'Floral', items: [
      { code: 'lavender',      label: 'lavender' },
      { code: 'rose',          label: 'rose' },
      { code: 'jasmine',       label: 'jasmine' },
      { code: 'violet',        label: 'violet' },
      { code: 'floral',        label: 'floral' },
    ]},
    { family: 'Fruit / tropical', items: [
      { code: 'tropical',      label: 'tropical' },
      { code: 'mango',         label: 'mango' },
      { code: 'berry',         label: 'berry' },
      { code: 'stone_fruit',   label: 'stone fruit' },
      { code: 'apple',         label: 'apple' },
      { code: 'melon',         label: 'melon' },
    ]},
    { family: 'Spice / gas', items: [
      { code: 'pepper',        label: 'pepper' },
      { code: 'clove',         label: 'clove' },
      { code: 'diesel',        label: 'diesel' },
      { code: 'chemical',      label: 'chemical' },
      { code: 'skunk',         label: 'skunk' },
    ]},
    { family: 'Dough / sweet', items: [
      { code: 'cookie_dough',  label: 'cookie dough' },
      { code: 'dough',         label: 'dough' },
      { code: 'yeast',         label: 'yeast' },
      { code: 'malt',          label: 'malt' },
      { code: 'vanilla',       label: 'vanilla' },
      { code: 'candy',         label: 'candy' },
      { code: 'honey',         label: 'honey' },
      { code: 'caramel',       label: 'caramel' },
      { code: 'butterscotch',  label: 'butterscotch' },
    ]},
    { family: 'Earth / herbal', items: [
      { code: 'soil',          label: 'soil' },
      { code: 'moss',          label: 'moss' },
      { code: 'mushroom',      label: 'mushroom' },
      { code: 'damp_wood',     label: 'damp wood' },
      { code: 'sharp_herbal',  label: 'sharp herbal' },
      { code: 'terpene_solvent', label: 'terpene solvent' },
      { code: 'hops',          label: 'hops' },
    ]},
    { family: 'Other', items: [
      { code: 'mint',          label: 'mint' },
      { code: 'menthol',       label: 'menthol' },
      { code: 'cheese',        label: 'cheese' },
      { code: 'coffee',        label: 'coffee' },
      { code: 'chocolate',     label: 'chocolate' },
    ]},
  ];

  const id = $derived($page.params.id);
  let batch = $state<Batch | null>(null);
  let error = $state<string | null>(null);

  let selected = $state<string[]>([]);
  let intensity = $state<number | null>(null);
  let assessmentNote = $state('');
  let isPublic = $state(false);
  let saving = $state(false);
  let savedMessage = $state<string | null>(null);

  async function load() {
    error = null;
    try {
      batch = await api<Batch>(`/batches/${id}`);
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    }
  }

  onMount(load);

  function toggle(code: string) {
    selected = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
  }

  async function submitAssessment() {
    if (!batch) return;
    if (selected.length === 0) {
      error = 'Pick at least one descriptor.';
      return;
    }
    saving = true;
    error = null;
    savedMessage = null;
    try {
      await api(`/batches/${batch.id}/organoleptic`, {
        method: 'POST',
        body: {
          descriptors: selected,
          intensity: intensity ?? undefined,
          note: assessmentNote || undefined,
          is_public: isPublic,
        },
      });
      const stamp = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
      savedMessage = `Assessment saved with ${selected.length} descriptor${selected.length === 1 ? '' : 's'} at ${stamp}.`;
      selected = [];
      intensity = null;
      assessmentNote = '';
      setTimeout(() => (savedMessage = null), 4000);
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    } finally {
      saving = false;
    }
  }

  // Build a list of measured/inferred terpenes with their tier (dominant /
  // secondary / trace) for the chemotype display.
  let terpeneRows = $derived.by(() => {
    if (!batch) return [];
    const rows = [
      { name: 'pinene', value: (batch.terp_pinene_a ?? 0) + (batch.terp_pinene_b ?? 0) },
      { name: 'myrcene', value: batch.terp_myrcene ?? 0 },
      { name: 'limonene', value: batch.terp_limonene ?? 0 },
      { name: 'terpinolene', value: batch.terp_terpinolene ?? 0 },
      { name: 'linalool', value: batch.terp_linalool ?? 0 },
      { name: 'caryophyllene', value: batch.terp_caryophyllene ?? 0 },
      { name: 'humulene', value: batch.terp_humulene ?? 0 },
      { name: 'ocimene', value: batch.terp_ocimene ?? 0 },
      { name: 'bisabolol', value: batch.terp_bisabolol ?? 0 },
      { name: 'farnesene', value: batch.terp_farnesene ?? 0 },
    ].filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
    return rows.map((r, i) => ({
      ...r,
      tier: i === 0 ? 'dominant' : i === 1 ? 'secondary' : 'trace',
    }));
  });
</script>

<svelte:head><title>{batch?.cultivar_name ?? 'Batch'} — Phenologue</title></svelte:head>

{#if error}<div class="form-error">{error}</div>{/if}

{#if batch}
  <div class="head">
    <div>
      <h4>Batch · {batch.batch_number}</h4>
      <h1>{batch.cultivar_name}</h1>
      <p class="meta">{batch.producer}{batch.country_origin ? ` · ${batch.country_origin}` : ''}</p>
    </div>
    <ChemotypeBadge
      classification={batch.classification}
      dominant={batch.dominant_terpene}
      secondary={batch.secondary_terpene}
      measurementStatus={batch.measurement_status}
    />
  </div>

  <div class="meta-grid">
    {#if batch.harvest_date}<div><dt>Harvest</dt><dd>{batch.harvest_date}</dd></div>{/if}
    {#if batch.test_date}<div><dt>Tested</dt><dd>{batch.test_date}</dd></div>{/if}
    {#if batch.irradiation}<div><dt>Irradiation</dt><dd>{batch.irradiation}</dd></div>{/if}
    {#if batch.thc_pct != null}<div><dt>THC</dt><dd>{batch.thc_pct}%</dd></div>{/if}
    {#if batch.cbd_pct != null}<div><dt>CBD</dt><dd>{batch.cbd_pct}%</dd></div>{/if}
    {#if batch.terp_total_pct != null}<div><dt>Terp total</dt><dd>{batch.terp_total_pct}%</dd></div>{/if}
  </div>

  {#if terpeneRows.length}
    <h2>Terpene profile</h2>
    <p class="meta">
      {batch.measurement_status === 'inferred' ? 'Inferred from organoleptic assessment.' :
        batch.measurement_status === 'partial' ? 'Cannabinoids measured, terpenes partially inferred.' :
        'Measured from a published COA.'}
    </p>
    <div class="terps">
      {#each terpeneRows as r (r.name)}
        <TerpenePill terpene={r.name} pct={r.value} tier={r.tier as 'dominant'|'secondary'|'trace'} />
      {/each}
    </div>
  {/if}

  <hr class="divider" />

  <h2>Organoleptic assessment</h2>
  <p>Pick the smell descriptors that match this batch. The protocol uses these to infer or corroborate the terpene profile (methodology v0.1 §7.2). More descriptors is better than fewer.</p>

  {#if savedMessage}
    <div class="form-saved" role="status" aria-live="polite">{savedMessage}</div>
  {/if}

  {#each DESCRIPTORS as group (group.family)}
    <div class="descriptor-group">
      <h4>{group.family}</h4>
      <div class="chips">
        {#each group.items as d (d.code)}
          <button type="button" class="chip" class:active={selected.includes(d.code)} onclick={() => toggle(d.code)}>
            {d.label}
          </button>
        {/each}
      </div>
    </div>
  {/each}

  <div class="form-row">
    <label for="intensity">Intensity (0 faint → 10 overpowering)</label>
    <div class="severity-row">
      {#each Array.from({ length: 11 }, (_, i) => i) as v (v)}
        <button type="button" class="dot-sev" class:active={intensity !== null && v <= intensity} onclick={() => (intensity = v)} aria-label="Intensity {v}">{v}</button>
      {/each}
    </div>
  </div>

  <div class="form-row">
    <label for="anote">Note (optional)</label>
    <textarea id="anote" rows="2" bind:value={assessmentNote} placeholder="What stood out? Anything unexpected?"></textarea>
  </div>

  <div class="form-row">
    <label class="check"><input type="checkbox" bind:checked={isPublic} /> Share this assessment publicly (anonymised, attributed to no one)</label>
  </div>

  <button type="button" disabled={saving || selected.length === 0} onclick={submitAssessment}>
    {saving ? 'Saving…' : `Save assessment (${selected.length} selected)`}
  </button>
{:else if !error}
  <p class="meta">Loading…</p>
{/if}

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
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
  }

  .terps { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1.5rem; }

  .descriptor-group { margin-bottom: 1rem; }
  .descriptor-group h4 { margin: 1rem 0 0.4rem; font-size: 0.78rem; }

  .chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .chip {
    background: var(--paper);
    color: var(--ink-muted);
    border: 1px solid var(--rule);
    padding: 0.35rem 0.65rem;
    font-family: var(--mono);
    font-size: 0.78rem;
    text-transform: lowercase;
    letter-spacing: 0;
    cursor: pointer;
  }
  .chip:hover { background: var(--paper-deep); color: var(--ink); border-color: var(--ink); }
  .chip.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  .severity-row { display: flex; gap: 0.2rem; flex-wrap: wrap; }
  .dot-sev {
    appearance: none;
    width: 2rem;
    height: 2rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    color: var(--ink-muted);
    font-family: var(--mono);
    font-size: 0.78rem;
    cursor: pointer;
    text-transform: none;
    letter-spacing: 0;
    padding: 0;
  }
  .dot-sev.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  .check { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }

  .form-saved {
    font-family: var(--mono);
    font-size: 0.85rem;
    color: #2c7a3e;
    background: var(--paper-deep);
    border-left: 3px solid #2c7a3e;
    padding: 0.6rem 0.9rem;
    margin: 0 0 1rem;
  }
</style>

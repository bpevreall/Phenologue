<script lang="ts">
  /**
   * Cultivar detail — list of batches under one cultivar.
   *
   * Cultivars (= producer + canonical name) live across all patients. Batches
   * are the analytic unit. Most patients log against one or two batches per
   * cultivar over time, so the batch list is short and useful.
   */
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import ChemotypeBadge from '$components/ChemotypeBadge.svelte';

  interface Batch {
    id: string;
    batch_number: string;
    harvest_date: string | null;
    test_date: string | null;
    expiry_date: string | null;
    measurement_status: string;
    thc_pct: number | null;
    cbd_pct: number | null;
    terp_total_pct: number | null;
    classification: string | null;
    dominant_terpene: string | null;
    secondary_terpene: string | null;
  }

  interface Cultivar {
    id: string;
    name: string;
    producer: string;
    country_origin: string | null;
    genetic_lineage: string | null;
    canonical_name: string;
    batches?: Batch[];
  }

  const id = $derived($page.params.id);
  let cultivar = $state<Cultivar | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      cultivar = await api<Cultivar>(`/cultivars/${id}`);
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    }
  });
</script>

<svelte:head><title>{cultivar?.name ?? 'Cultivar'} — Phenologue</title></svelte:head>

{#if error}<div class="form-error">{error}</div>{/if}

{#if cultivar}
  <h4>Cultivar</h4>
  <h1>{cultivar.name}</h1>
  <p class="meta">{cultivar.producer}{cultivar.country_origin ? ` · ${cultivar.country_origin}` : ''}{cultivar.genetic_lineage ? ` · ${cultivar.genetic_lineage}` : ''}</p>

  <h2>Batches</h2>
  {#if !cultivar.batches?.length}
    <p class="meta">No batches yet for this cultivar. Add one from the cultivar's COA when you have it.</p>
  {:else}
    <ul class="batches">
      {#each cultivar.batches as b (b.id)}
        <li>
          <a class="batch-row" href={`/dashboard/batches/${b.id}`} data-chemotype={b.classification ?? 'unclassified'}>
            <div class="left">
              <div class="num">{b.batch_number}</div>
              <div class="meta">
                {b.harvest_date ? `harvested ${b.harvest_date}` : 'harvest unknown'}
                {b.test_date ? ` · tested ${b.test_date}` : ''}
              </div>
            </div>
            <div class="right">
              <ChemotypeBadge classification={b.classification} dominant={b.dominant_terpene} secondary={b.secondary_terpene} measurementStatus={b.measurement_status} />
              {#if b.thc_pct != null}<span class="num-meta">{b.thc_pct}% THC</span>{/if}
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
{:else if !error}
  <p class="meta">Loading…</p>
{/if}

<style>
  .batches {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
    display: grid;
    gap: 0.5rem;
  }

  .batch-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem 1rem;
    background: var(--paper-deep);
    border: 1px solid var(--paper-edge);
    border-left: 4px solid var(--chip, var(--rule));
    text-decoration: none;
    color: inherit;
    border-bottom: 1px solid var(--paper-edge);
  }
  .batch-row:hover { background: var(--paper); border-color: var(--ink); }

  .num {
    font-family: var(--mono);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .right {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .num-meta {
    font-family: var(--mono);
    font-size: 0.78rem;
    color: var(--ink-soft);
  }
</style>

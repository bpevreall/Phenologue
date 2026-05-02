<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import SessionCard from '$components/SessionCard.svelte';

  interface Report {
    total_sessions: number;
    purpose_counts: Record<string, number>;
    chemotype_counts: Record<string, number>;
    scale_deltas: Record<string, { mean_delta: number | null; n: number }>;
    cultivar_counts: Array<{ name: string; producer: string; count: number }>;
    recent_sessions: Array<{
      id: string;
      started_at: number;
      cultivar_name: string;
      classification: string | null;
      purpose_tags: string[];
      voided: boolean;
    }>;
  }

  let report = $state<Report | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      report = await api<Report>('/reports/personal');
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    }
  });
</script>

<svelte:head><title>Dashboard — Phenologue</title></svelte:head>

<h4>Volume 0.1</h4>
<h1>Personal dashboard</h1>

{#if error}
  <div class="form-error">{error}</div>
{/if}

{#if report}
  <section class="kpis">
    <div class="kpi">
      <div class="num">{report.total_sessions}</div>
      <div class="meta">Sessions logged</div>
    </div>
    <div class="kpi">
      <div class="num">{Object.keys(report.chemotype_counts).length}</div>
      <div class="meta">Chemotypes seen</div>
    </div>
    <div class="kpi">
      <div class="num">{report.cultivar_counts.length}</div>
      <div class="meta">Distinct cultivars</div>
    </div>
  </section>

  {#if Object.keys(report.scale_deltas).length}
    <h2>Mean pre→post deltas</h2>
    <table class="data">
      <thead>
        <tr><th>Scale</th><th>Mean Δ</th><th>n</th></tr>
      </thead>
      <tbody>
        {#each Object.entries(report.scale_deltas) as [scale, d]}
          <tr>
            <td>{scale}</td>
            <td>{d.mean_delta?.toFixed(2) ?? '—'}</td>
            <td>{d.n}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <h2>Recent sessions</h2>
  {#if report.recent_sessions.length === 0}
    <p class="meta">No sessions yet. <a href="/dashboard/sessions/new">Log your first.</a></p>
  {:else}
    <div class="cards">
      {#each report.recent_sessions as s (s.id)}
        <SessionCard session={s as any} />
      {/each}
    </div>
  {/if}
{:else if !error}
  <p class="meta">Loading…</p>
{/if}

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 1rem;
    margin: 1.5rem 0 2rem;
  }

  .kpi {
    padding: 1.2rem 1rem;
    background: var(--paper-deep);
    border: 1px solid var(--paper-edge);
  }

  .num {
    font-family: var(--serif);
    font-size: 2.4rem;
    font-weight: 600;
    line-height: 1;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
    gap: 0.8rem;
    margin-top: 1rem;
  }

  table.data { margin: 1rem 0 2rem; max-width: 32rem; }
</style>

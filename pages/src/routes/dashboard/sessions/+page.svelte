<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import SessionCard from '$components/SessionCard.svelte';

  interface SessionRow {
    id: string;
    started_at: number;
    batch_id: string;
    route: string;
    dose_grams: number | null;
    purpose_tags_json: string;
    cultivar_name: string;
    producer: string;
    classification: string | null;
    voided: number;
  }

  let sessions = $state<SessionRow[]>([]);
  let error = $state<string | null>(null);
  let purpose = $state('');

  async function load() {
    error = null;
    try {
      sessions = await api<SessionRow[]>('/sessions', {
        query: { purpose: purpose || undefined },
      });
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    }
  }

  onMount(load);
</script>

<svelte:head><title>Sessions — Phenologue</title></svelte:head>

<div class="head">
  <h1>Sessions</h1>
  <a class="btn" href="/dashboard/sessions/new">+ Start session</a>
</div>

<div class="filter">
  <label for="purpose">Filter by purpose</label>
  <select id="purpose" bind:value={purpose} onchange={load}>
    <option value="">All purposes</option>
    <option value="focus">focus</option>
    <option value="creativity">creativity</option>
    <option value="physical_activity">physical activity</option>
    <option value="social">social</option>
    <option value="relaxation">relaxation</option>
    <option value="sleep_prep">sleep prep</option>
    <option value="pain_management">pain management</option>
    <option value="anxiety_management">anxiety management</option>
    <option value="appetite_stimulation">appetite stimulation</option>
    <option value="recreational">recreational</option>
    <option value="exploratory">exploratory</option>
  </select>
</div>

{#if error}<div class="form-error">{error}</div>{/if}

{#if sessions.length === 0 && !error}
  <p class="meta">No sessions match. <a href="/dashboard/sessions/new">Log a session.</a></p>
{:else}
  <div class="cards">
    {#each sessions as s (s.id)}
      <SessionCard session={s as any} />
    {/each}
  </div>
{/if}

<style>
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .filter {
    margin-bottom: 1.5rem;
    max-width: 24rem;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
    gap: 0.8rem;
  }
</style>

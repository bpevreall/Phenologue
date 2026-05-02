<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import ChemotypeBadge from '$components/ChemotypeBadge.svelte';

  interface Cultivar {
    id: string;
    name: string;
    producer: string;
    country_origin: string | null;
    canonical_name: string;
  }

  let cultivars = $state<Cultivar[]>([]);
  let q = $state('');
  let error = $state<string | null>(null);

  async function load() {
    try {
      cultivars = await api<Cultivar[]>('/cultivars', { query: { q: q || undefined } });
    } catch (err) {
      error = err instanceof ApiError ? err.errors[0]?.message ?? 'Failed' : 'Network error';
    }
  }

  onMount(load);
</script>

<svelte:head><title>Cultivars — Phenologue</title></svelte:head>

<h1>Cultivars</h1>
<p class="meta">Catalogue of cultivars and batches. The list is shared across all patients.</p>

<div class="form-row">
  <label for="q">Search</label>
  <input id="q" type="text" bind:value={q} oninput={load} placeholder="Search by name or canonical key…" />
</div>

{#if error}<div class="form-error">{error}</div>{/if}

<table class="data">
  <thead>
    <tr><th>Cultivar</th><th>Producer</th><th>Origin</th><th></th></tr>
  </thead>
  <tbody>
    {#each cultivars as c (c.id)}
      <tr>
        <td><strong>{c.name}</strong></td>
        <td>{c.producer}</td>
        <td>{c.country_origin ?? '—'}</td>
        <td><a href="/dashboard/cultivars/{c.id}">view</a></td>
      </tr>
    {/each}
  </tbody>
</table>

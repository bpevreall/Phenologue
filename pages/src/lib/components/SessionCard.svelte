<script lang="ts">
  interface SessionRow {
    id: string;
    started_at: number;
    cultivar_name: string;
    producer?: string;
    classification?: string | null;
    purpose_tags_json?: string;
    purpose_tags?: string[];
    voided?: boolean | number;
    dose_grams?: number | null;
    route?: string;
  }

  interface Props {
    session: SessionRow;
  }

  let { session }: Props = $props();

  function formatDate(ms: number): string {
    return new Date(ms).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  let purposes = $derived.by(() => {
    if (Array.isArray(session.purpose_tags)) return session.purpose_tags;
    if (session.purpose_tags_json) {
      try {
        return JSON.parse(session.purpose_tags_json) as string[];
      } catch { return []; }
    }
    return [];
  });
</script>

<a class="card" href={`/dashboard/sessions/${session.id}`} data-chemotype={session.classification ?? 'unclassified'}>
  <div class="head">
    <span class="cultivar">{session.cultivar_name}</span>
    <span class="date">{formatDate(session.started_at)}</span>
  </div>
  <div class="middle">
    {#if session.classification}
      <span class="chemo">{session.classification}</span>
    {/if}
    {#if session.dose_grams != null}
      <span class="dose">{session.dose_grams}g {session.route ?? ''}</span>
    {/if}
  </div>
  <div class="tags">
    {#each purposes as tag (tag)}
      <span class="tag">{tag}</span>
    {/each}
    {#if session.voided}<span class="voided">voided</span>{/if}
  </div>
</a>

<style>
  .card {
    display: block;
    padding: 1rem 1.2rem;
    background: var(--paper-deep);
    border: 1px solid var(--paper-edge);
    border-left: 4px solid var(--chip, var(--rule));
    border-radius: 2px;
    text-decoration: none;
    color: inherit;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .card:hover { background: var(--paper); border-color: var(--ink); }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.4rem;
  }

  .cultivar {
    font-family: var(--serif);
    font-weight: 600;
    font-size: 1.05rem;
  }

  .date, .chemo, .dose, .tag, .voided {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .middle { display: flex; gap: 0.8rem; margin-bottom: 0.4rem; }
  .chemo { color: var(--ink); }
  .dose { color: var(--ink-soft); }

  .tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .tag {
    padding: 0.05rem 0.5rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    text-transform: lowercase;
  }
  .voided {
    color: var(--accent);
    border: 1px solid var(--accent);
    padding: 0.05rem 0.5rem;
  }
</style>

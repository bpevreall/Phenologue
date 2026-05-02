<script lang="ts">
  interface Props {
    terpene: string | null | undefined;
    pct?: number | null;
    tier?: 'dominant' | 'secondary' | 'trace';
  }

  let { terpene, pct, tier = 'trace' }: Props = $props();
</script>

{#if terpene}
  <span class="pill" data-chemotype="{terpene}-dominant" data-tier={tier}>
    <span class="name">{terpene}</span>
    {#if pct != null}
      <span class="pct">{pct.toFixed(2)}%</span>
    {/if}
  </span>
{/if}

<style>
  .pill {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4rem;
    padding: 0.2rem 0.6rem;
    background: var(--chip, var(--paper-deep));
    border: 1px solid var(--ink);
    border-radius: 1px;
    font-family: var(--mono);
    font-size: 0.78rem;
    color: var(--ink);
    text-transform: lowercase;
    letter-spacing: 0.04em;
  }

  .pill[data-tier="dominant"] { font-weight: 700; }
  .pill[data-tier="secondary"] { font-weight: 500; }
  .pill[data-tier="trace"] { opacity: 0.7; font-weight: 400; }

  .pct { color: var(--ink-soft); }
</style>

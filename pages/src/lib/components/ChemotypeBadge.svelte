<script lang="ts">
  interface Props {
    classification: string | null | undefined;
    dominant?: string | null;
    secondary?: string | null;
    measurementStatus?: 'measured' | 'partial' | 'inferred' | string | null;
  }

  let { classification, dominant, secondary, measurementStatus }: Props = $props();
</script>

{#if classification}
  <div class="badge" data-chemotype={classification}>
    <div class="line">
      <span class="cls">{classification.replace('-dominant', ' dominant')}</span>
      {#if measurementStatus}
        <span class="status" data-status={measurementStatus}>{measurementStatus}</span>
      {/if}
    </div>
    {#if dominant || secondary}
      <div class="terps">
        {#if dominant}<span class="d">{dominant}</span>{/if}
        {#if dominant && secondary} <span class="sep">/</span> {/if}
        {#if secondary}<span class="s">{secondary}</span>{/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .badge {
    display: inline-block;
    padding: 0.4rem 0.7rem;
    background: var(--chip, var(--paper-deep));
    border: 1px solid var(--ink);
    border-radius: 1px;
    font-family: var(--mono);
    line-height: 1.3;
  }

  .line {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }

  .cls {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink);
  }

  .status {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 0.05rem 0.4rem;
    border: 1px solid var(--ink-muted);
    color: var(--ink-muted);
    background: var(--paper);
  }

  .status[data-status="inferred"] {
    border-color: var(--accent);
    color: var(--accent);
  }

  .terps {
    margin-top: 0.2rem;
    font-size: 0.75rem;
    color: var(--ink-soft);
    text-transform: lowercase;
  }
  .terps .d { font-weight: 700; }
  .terps .sep { color: var(--ink-muted); }
</style>

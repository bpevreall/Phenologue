<script lang="ts">
  /** 0-10 visual analogue scale with anchored descriptors at 0, 5, 10. */

  interface Props {
    code: string;
    label: string;
    anchor0: string;
    anchor5: string;
    anchor10: string;
    value: number | null;
    onChange?: (v: number) => void;
  }

  let {
    code,
    label,
    anchor0,
    anchor5,
    anchor10,
    value = $bindable(),
    onChange,
  }: Props = $props();

  function set(v: number) {
    value = v;
    onChange?.(v);
  }
</script>

<div class="scale">
  <div class="head">
    <span class="label">{label}</span>
    <span class="code">{code}</span>
    {#if value !== null}<span class="value">{value}</span>{/if}
  </div>

  <div class="track">
    {#each Array.from({ length: 11 }, (_, i) => i) as v (v)}
      <button
        type="button"
        class="dot"
        class:filled={value !== null && value === v}
        class:active={value !== null && v <= value}
        aria-label="{label} {v}"
        onclick={() => set(v)}
      >{v}</button>
    {/each}
  </div>

  <div class="anchors">
    <span>{anchor0}</span>
    <span>{anchor5}</span>
    <span>{anchor10}</span>
  </div>
</div>

<style>
  .scale {
    margin-bottom: 1.5rem;
    padding: 1rem 1.1rem;
    background: var(--paper-deep);
    border: 1px solid var(--paper-edge);
    border-radius: 2px;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.6rem;
  }

  .label {
    font-family: var(--serif);
    font-weight: 500;
    font-size: 1.05rem;
  }

  .code {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .value {
    font-family: var(--mono);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--ink);
    margin-left: auto;
  }

  .track {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 0.25rem;
    margin-bottom: 0.4rem;
  }

  .dot {
    appearance: none;
    background: var(--paper);
    border: 1px solid var(--rule);
    color: var(--ink-muted);
    font-family: var(--mono);
    font-size: 0.8rem;
    padding: 0.4rem 0;
    cursor: pointer;
    border-radius: 2px;
    text-transform: none;
    letter-spacing: 0;
  }

  .dot:hover { background: var(--paper-edge); border-color: var(--ink); color: var(--ink); }

  .dot.active {
    background: var(--accent-soft);
    border-color: var(--ink);
    color: var(--ink);
  }

  .dot.filled {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }

  .anchors {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--ink-muted);
    text-transform: lowercase;
  }

  .anchors :global(span:nth-child(2)) { text-align: center; }
  .anchors :global(span:nth-child(3)) { text-align: right; }
</style>

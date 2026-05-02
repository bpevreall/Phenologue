<script lang="ts">
  /**
   * Numbered-circle step indicator with line-fill progress.
   *
   * Replaces the text-span stepper in /dashboard/sessions/new. Renders one
   * circle per step, joined by lines that fill from left → right up to the
   * current step. Steps before `current` are "completed" (ink), the step at
   * `current` is "active" (accent), steps after are "future" (muted).
   *
   * Pure CSS — no external deps. Uses a CSS variable to drive fill width so
   * the line animates smoothly when `current` changes.
   */

  interface Props {
    /** Step labels; circle count matches array length. */
    steps: string[];
    /** Zero-based index of the active step. */
    current: number;
  }

  let { steps, current }: Props = $props();

  // Fraction of the connector line filled. With N steps there are N-1 gaps;
  // the line should be fully filled when current === steps.length - 1.
  let fillPct = $derived(
    steps.length <= 1 ? 0 : Math.max(0, Math.min(100, (current / (steps.length - 1)) * 100))
  );
</script>

<ol class="stepbar" style="--fill: {fillPct}%; --n: {steps.length}">
  <li class="line" aria-hidden="true"></li>
  {#each steps as label, i (i)}
    <li
      class="step"
      class:completed={i < current}
      class:active={i === current}
      aria-current={i === current ? 'step' : undefined}
    >
      <span class="circle">{i + 1}</span>
      <span class="label">{label}</span>
    </li>
  {/each}
</ol>

<style>
  .stepbar {
    list-style: none;
    margin: 1.5rem 0 2.5rem;
    padding: 0;
    position: relative;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    align-items: start;
  }

  /* Connector line, sits behind the circles. Two layers: the muted base
   * and an accent fill driven by the --fill CSS variable. */
  .line {
    position: absolute;
    top: 0.95rem; /* aligns to the centre of a 1.9rem circle */
    left: calc(100% / var(--n, 4) / 2);
    right: calc(100% / var(--n, 4) / 2);
    height: 2px;
    background: var(--rule);
    z-index: 0;
  }
  .line::after {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--fill);
    background: var(--ink);
    transition: width 200ms ease;
  }

  .step {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    text-align: center;
  }

  .circle {
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--paper);
    color: var(--ink-muted);
    border: 2px solid var(--rule);
    font-family: var(--mono);
    font-size: 0.85rem;
    font-weight: 600;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  }

  .step.completed .circle {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }

  .step.active .circle {
    background: var(--accent);
    color: var(--paper);
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }

  .label {
    font-family: var(--mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    line-height: 1.2;
  }

  .step.completed .label { color: var(--ink-soft); }
  .step.active .label { color: var(--ink); }

  @media (max-width: 540px) {
    .label { font-size: 0.65rem; letter-spacing: 0.04em; }
    .circle { width: 1.7rem; height: 1.7rem; font-size: 0.78rem; }
    .line { top: 0.85rem; }
  }
</style>

<script lang="ts">
  /**
   * Modal that replaces the native `prompt('Reason for voiding…')` call on
   * the session detail page. Methodology v0.1 records a short reason for
   * every void so audit trails make sense; the native prompt is awful for
   * accessibility and has no styling hook.
   *
   * Behaviour:
   *   - Backdrop click cancels.
   *   - Escape cancels.
   *   - Tab is trapped inside the modal while open.
   *   - Textarea is required (≥5 chars) and autofocuses on open.
   *   - Confirm calls `onConfirm(reason)`; Cancel calls `onCancel()`.
   *
   * The parent owns visibility (`open`) so it can await an async user
   * decision via the callback contract.
   */
  import { tick } from 'svelte';

  interface Props {
    open: boolean;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
  }

  let { open, onConfirm, onCancel }: Props = $props();

  let reason = $state('');
  let textarea = $state<HTMLTextAreaElement | null>(null);
  let dialog = $state<HTMLDivElement | null>(null);
  let touched = $state(false);

  let valid = $derived(reason.trim().length >= 5);
  let showError = $derived(touched && !valid);

  // When the modal opens, reset state, focus the textarea, lock body scroll.
  $effect(() => {
    if (open) {
      reason = '';
      touched = false;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      tick().then(() => textarea?.focus());
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  });

  function handleKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Tab' && dialog) {
      // Focus trap — keep tab inside the modal.
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button, textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function confirm() {
    touched = true;
    if (!valid) {
      textarea?.focus();
      return;
    }
    onConfirm(reason.trim());
  }

  function backdropClick(e: MouseEvent) {
    // Only cancel if the click landed on the backdrop itself, not the card.
    if (e.target === e.currentTarget) onCancel();
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if open}
  <div
    class="backdrop"
    role="presentation"
    onclick={backdropClick}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCancel(); }}
  >
    <div
      class="card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="void-modal-title"
      bind:this={dialog}
    >
      <h3 id="void-modal-title">Void this session?</h3>
      <p class="prompt">Why are you voiding this session? A brief reason helps you (and the dataset) later.</p>

      <label for="void-reason">Reason</label>
      <textarea
        id="void-reason"
        rows="3"
        required
        bind:this={textarea}
        bind:value={reason}
        onblur={() => (touched = true)}
        placeholder="e.g. logged the wrong batch, contaminated equipment…"
      ></textarea>
      {#if showError}
        <p class="hint error">At least 5 characters required.</p>
      {:else}
        <p class="hint">Minimum 5 characters. Stored on the void record.</p>
      {/if}

      <div class="actions">
        <button type="button" class="ghost" onclick={onCancel}>Cancel</button>
        <button type="button" class="danger" disabled={!valid && touched} onclick={confirm}>
          Void session
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(20, 18, 14, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    z-index: 100;
    animation: fade 140ms ease-out;
  }

  .card {
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: 2px;
    padding: 1.6rem 1.8rem;
    width: 100%;
    max-width: 32rem;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
    animation: lift 160ms ease-out;
  }

  .card h3 {
    margin: 0 0 0.6rem;
    font-family: var(--serif);
    font-size: 1.4rem;
  }

  .prompt {
    color: var(--ink-soft);
    margin-bottom: 1.1rem;
    font-size: 0.95rem;
  }

  .hint {
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--ink-muted);
    margin: 0.4rem 0 0;
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }

  .hint.error { color: var(--accent); }

  .actions {
    display: flex;
    gap: 0.6rem;
    justify-content: flex-end;
    margin-top: 1.4rem;
  }

  .actions .ghost {
    background: transparent;
    color: var(--ink);
  }
  .actions .ghost:hover {
    background: var(--paper-deep);
    border-color: var(--ink);
    color: var(--ink);
  }

  .actions .danger {
    background: var(--accent);
    color: var(--paper);
    border-color: var(--accent);
  }
  .actions .danger:hover { filter: brightness(0.92); }

  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes lift {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>

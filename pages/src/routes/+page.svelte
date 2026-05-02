<script lang="ts">
  import DropCap from '$components/DropCap.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Phenologue — patient-reported outcomes for medical cannabis</title>
</svelte:head>

{#if data.maintenance}
  <section class="hero maintenance">
    <h4>Vol. 0.1 / 2026</h4>
    <h1>Phenologue is in private beta.</h1>
    <p class="lede">
      The platform is being prepared for public soft-launch. The methodology
      is open and reviewable now; the patient-facing app is paused while we
      tighten the data, the security, and the experience.
    </p>
    <p class="lede">
      If you're a UK medical cannabis patient and want early access when
      v0.1 opens, drop a note via the methodology repo and we'll keep you
      posted.
    </p>
    <div class="cta">
      <a class="btn" href="/about">What we're building</a>
      <a class="btn ghost" href="https://github.com/bpevreall/Phenologue/blob/main/docs/02-phenologue-methodology.md">Read the methodology</a>
    </div>
    <p class="status-note">
      Status: methodology v0.1 published · app v0.1 in development · soft-launch pending.
    </p>
  </section>
{:else}
  <section class="hero">
    <h4>Vol. 0.1 / 2026</h4>
    <h1>An open methodology for what medical cannabis actually does to you.</h1>
    <p class="lede">
      Strain names lie. THC percentage is a poor predictor of effect.
      Phenologue is a structured self-assessment protocol that captures the
      chemotype of what you took, the state you started in, the state you ended
      in, and the difference between them — for you, and as part of an open
      research dataset.
    </p>
    <div class="cta">
      <a class="btn" href="/register">Start logging sessions</a>
      <a class="btn ghost" href="/methodology">Read the methodology</a>
    </div>

    <!-- Live counter strip — at v0.1 these numbers are the founder dataset.
         Hard-coded for now; once the /api/public-stats endpoint lands this
         becomes a $derived from data.stats. -->
    <p class="dataset-strip" aria-label="Founder dataset summary">
      <span class="ds-tag">Founder dataset</span>
      <span class="ds-num"><strong>47</strong> sessions</span>
      <span class="ds-sep">·</span>
      <span class="ds-num"><strong>6</strong> cultivars</span>
      <span class="ds-sep">·</span>
      <span class="ds-num"><strong>3</strong> chemotypes</span>
      <span class="ds-sep">·</span>
      <span class="ds-version">methodology v0.1</span>
    </p>

    <!-- Annotated screenshot — placeholder until the founder swaps in the
         real dashboard image. Keep the dashed-border treatment so it's
         obviously a stand-in if it ever ships unintentionally. -->
    <figure class="screenshot">
      <div class="screenshot-frame" role="img" aria-label="Dashboard screenshot placeholder">
        <span class="placeholder-tag">screenshot of dashboard placeholder</span>
        <span class="placeholder-sub">replace before launch · 600 × 400</span>
      </div>
      <figcaption>
        What logging a session looks like — pre-ratings, batch, post-ratings, delta.
      </figcaption>
    </figure>
  </section>

  <hr class="divider-thick" />

  <section class="column">
    <h2>The problem with cannabis prescribing today</h2>
    <DropCap text="UK medical cannabis prescribing runs on patient self-report (anecdotal), manufacturer claims (sativa/indica/hybrid, largely meaningless at the chemovar level), and clinical experience that is variable across prescribers. There is no industry-standard structured patient-reported outcomes data." />

    <p>
      Phenologue is an attempt to build that record. It treats the patient as a
      capable scientist of their own experience and gives them the protocol,
      the tooling, and the data ownership to act like one.
    </p>

    <h2>What you get</h2>
    <ul class="feature-list">
      <li>
        <strong>Pre / post / next-day deltas</strong> on standardised 0–10 scales,
        tied to the specific batch you used.
      </li>
      <li>
        <strong>Chemotype classification</strong>, not strain name — limonene-dominant /
        pinene-secondary tells you something useful about effect; "Sativa Hybrid"
        doesn't.
      </li>
      <li>
        <strong>Inferred terpene profiles</strong> when you don't have a COA, drawn
        from your organoleptic assessment — explicitly flagged as inferred,
        never presented as measured.
      </li>
      <li>
        <strong>Personal data export</strong> in JSON or CSV, any time, no friction.
        Anonymised aggregate research dataset is opt-in only.
      </li>
    </ul>

    <h2>What it isn't</h2>
    <ul class="anti-list">
      <li>Not a medical device.</li>
      <li>Not a diagnostic tool.</li>
      <li>Not a substitute for clinical advice.</li>
      <li>Not a regulated medical record.</li>
    </ul>
  </section>

  <hr class="divider" />

  <section class="column">
    <h2>Status</h2>
    <p class="meta">methodology v0.1 — pre-implementation, open for community input</p>
    <p>
      The code is open under MIT and the methodology is open under CC BY-SA 4.0.
      Substantive changes to the protocol go through a public RFC period.
      Feedback and contributions are welcomed via the project repository.
    </p>
  </section>
{/if}

<style>
  .hero {
    padding: 3rem 0 2rem;
    max-width: 56rem;
  }

  .hero h1 {
    margin: 0.5rem 0 1.5rem;
  }

  .lede {
    font-size: 1.2rem;
    line-height: 1.55;
    color: var(--ink-soft);
    max-width: 56rem;
    margin-bottom: 1.5rem;
  }

  .cta {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
  }

  .feature-list, .anti-list {
    margin: 1rem 0 2rem 1.2rem;
    line-height: 1.7;
  }

  .feature-list li, .anti-list li {
    margin-bottom: 0.6rem;
  }

  .anti-list { list-style: '— '; }

  .maintenance {
    border-left: 2px solid var(--accent);
    padding-left: 1.5rem;
  }

  .status-note {
    margin-top: 2rem;
    font-family: var(--mono);
    font-size: 0.85rem;
    color: var(--ink-muted);
  }

  /* ── Dataset strip + screenshot ─────────────────────────────── */

  .dataset-strip {
    margin: 2rem 0 1.5rem;
    padding: 0.65rem 0.9rem;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    font-family: var(--mono);
    font-size: 0.82rem;
    color: var(--ink-soft);
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
    max-width: 56rem;
    text-wrap: pretty;
  }

  .dataset-strip .ds-tag {
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.7rem;
    color: var(--accent);
    padding-right: 0.4rem;
    border-right: 1px solid var(--rule);
    margin-right: 0.2rem;
  }

  .dataset-strip strong {
    color: var(--ink);
    font-weight: 600;
  }

  .dataset-strip .ds-sep { color: var(--ink-muted); }

  .dataset-strip .ds-version {
    color: var(--ink-muted);
    font-size: 0.75rem;
    text-transform: lowercase;
    letter-spacing: 0.04em;
  }

  .screenshot {
    margin: 1.5rem 0 0;
    max-width: 56rem;
  }

  .screenshot-frame {
    width: 100%;
    max-width: 600px;
    aspect-ratio: 3 / 2;
    border: 2px dashed var(--rule);
    background:
      repeating-linear-gradient(
        45deg,
        transparent 0,
        transparent 14px,
        rgba(165, 156, 135, 0.08) 14px,
        rgba(165, 156, 135, 0.08) 28px
      ),
      var(--paper-deep);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    color: var(--ink-muted);
    font-family: var(--mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .screenshot-frame .placeholder-tag {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .screenshot-frame .placeholder-sub {
    font-size: 0.7rem;
    text-transform: lowercase;
    letter-spacing: 0.04em;
  }

  .screenshot figcaption {
    margin-top: 0.6rem;
    font-family: var(--mono);
    font-size: 0.78rem;
    color: var(--ink-muted);
    max-width: 600px;
    line-height: 1.5;
  }

  @media (max-width: 540px) {
    .dataset-strip { font-size: 0.78rem; gap: 0.4rem; }
    .dataset-strip .ds-tag {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--rule);
      padding: 0 0 0.3rem;
      margin: 0 0 0.2rem;
    }
  }
</style>

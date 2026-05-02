<svelte:head>
  <title>About — Phenologue</title>
  <meta name="description" content="Phenologue is built by Brendon Pevreall, a UK medical cannabis patient — not a clinician. Patient-led, openly licensed, honest about what's not yet built." />
</svelte:head>

<section class="column">
  <h4>About</h4>
  <h1>Built by a patient, not a clinic.</h1>

  <!-- a. Founder note ----------------------------------------------------- -->
  <div class="founder">
    <div class="founder-photo" aria-hidden="true">
      <span>[founder photo placeholder — replace before launch]</span>
    </div>
    <p class="founder-note">
      Phenologue is built by <strong>Brendon Pevreall</strong>, a UK medical
      cannabis patient — not a clinician. The platform exists because the
      structured outcomes data UK medical cannabis prescribing needs doesn't
      exist. Patient-led, openly methodologically licensed, and honest about
      what's not yet built.
    </p>
  </div>

  <!-- b. Why a non-clinician? --------------------------------------------- -->
  <h2>Why a non-clinician?</h2>
  <p>
    Chemotype-tagged, pre/post patient-reported outcome data is patient-reported
    by definition. UK clinicians work from limited validated outcome data
    because that data has not been systematically collected at the patient-led
    layer. That is the gap Phenologue is built to close.
  </p>
  <p>
    The methodology is open and reviewable. The science is borrowed and cited —
    nothing in the protocol is invented from scratch. Every analytical claim
    sits on top of peer-reviewed work in chemovar science and validated PRO
    instruments. Read the
    <a href="/methodology">methodology and the citation list</a>; if any claim
    isn't supported, file an issue.
  </p>

  <!-- c. Data principles (compressed) ------------------------------------- -->
  <h2>Data principles</h2>
  <ul class="principles">
    <li>Full export at any time. Full deletion at any time, no retention.</li>
    <li>No identified data used for any purpose without explicit consent.</li>
    <li>Research use is opt-in, granular, and revocable.</li>
  </ul>

  <!-- d. What v0.1 collects, what it does not (preserved verbatim) -------- -->
  <h2>What v0.1 collects, and what it does not</h2>
  <p>
    Phenologue v0.1 deliberately collects the minimum personal information
    needed to run the protocol. We capture an email (for password reset and
    account recovery), an optional pseudonym, your prescribing conditions, and
    your session log. We do <strong>not</strong> ask for your real name,
    address, phone number, or date of birth.
  </p>
  <p>
    The full anonymisation pipeline that strips identifiers from aggregated
    research output (planned for v0.2) is described in the
    <a href="/methodology">open methodology</a>. Until v0.2 ships, raw exports
    are returned exactly as you submitted them — anonymisation is your
    responsibility if you choose to share an export publicly. We are honest
    about this gap rather than pretending the pipeline exists.
  </p>

  <!-- e. What it isn't ---------------------------------------------------- -->
  <h2>What it isn't</h2>
  <ul class="anti-list">
    <li>Not a medical device.</li>
    <li>Not a diagnostic tool.</li>
    <li>Not clinical advice.</li>
    <li>Not a regulated medical record.</li>
  </ul>

  <!-- f. Open contracts --------------------------------------------------- -->
  <h2>Open contracts</h2>
  <ul class="principles">
    <li>
      <strong>Methodology</strong> — CC BY-SA 4.0 — read it at
      <a href="/methodology">/methodology</a>.
    </li>
    <li>
      <strong>Code</strong> — MIT — published at
      <a href="https://github.com/bpevreall/Phenologue" rel="external">
        github.com/bpevreall/Phenologue
      </a>.
    </li>
    <li>
      <strong>Aggregate dataset</strong> — open access for descriptive
      statistics; licensed access for the raw anonymised dataset under a data
      sharing agreement.
    </li>
  </ul>

  <!-- g. Contact ---------------------------------------------------------- -->
  <hr class="divider" />

  <h2>Contact</h2>
  <dl class="contact">
    <dt>Email</dt>
    <dd>
      <a href="mailto:data-controller@phenologue.uk">
        data-controller@phenologue.uk
      </a>
    </dd>
    <dt>GDPR data controller</dt>
    <dd>
      <a href="mailto:data-controller@phenologue.uk">
        data-controller@phenologue.uk
      </a>
    </dd>
    <dt>Methodology RFCs</dt>
    <dd>
      <a href="https://github.com/bpevreall/Phenologue/issues" rel="external">
        github.com/bpevreall/Phenologue/issues
      </a>
    </dd>
  </dl>

  <p class="meta">v0.1 — pre-launch, founder-only dataset, open for beta access.</p>
</section>

<style>
  .founder {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 1.5rem;
    align-items: start;
    margin: 1.5rem 0 2.5rem;
  }

  .founder-photo {
    width: 200px;
    height: 200px;
    border: 2px dashed var(--rule);
    background: var(--paper-deep);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 1rem;
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--ink-muted);
    line-height: 1.4;
  }

  .founder-note {
    font-size: 1.1rem;
    line-height: 1.6;
    margin: 0;
  }

  .principles {
    margin: 1rem 0 2rem 1.2rem;
    line-height: 1.7;
  }
  .principles li { margin-bottom: 0.5rem; }

  .anti-list {
    margin: 1rem 0 2rem 1.2rem;
    list-style: '— ';
    line-height: 1.7;
  }
  .anti-list li { margin-bottom: 0.4rem; }

  .contact {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 1.5rem;
    row-gap: 0.6rem;
    margin: 1rem 0 2rem;
    font-family: var(--mono);
    font-size: 0.85rem;
  }
  .contact dt {
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.75rem;
    padding-top: 0.15rem;
  }
  .contact dd { margin: 0; }

  @media (max-width: 540px) {
    .founder {
      grid-template-columns: 1fr;
      justify-items: center;
      text-align: left;
    }
    .contact { grid-template-columns: 1fr; row-gap: 0.2rem; }
    .contact dd { margin-bottom: 0.6rem; }
  }
</style>

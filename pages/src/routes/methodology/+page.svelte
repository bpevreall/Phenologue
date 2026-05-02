<script lang="ts">
  import { CITATIONS, GROUP_LABELS, GROUP_ORDER, type Citation, type CitationGroup } from '$lib/data/citations';

  // Group citations by their `group` tag, preserving doc order within each group.
  const grouped: Record<CitationGroup, Citation[]> = {
    pro: [],
    chemovar: [],
    neighbours: [],
    non_pubmed: [],
  };
  for (const c of CITATIONS) grouped[c.group].push(c);

  // PubMed deep-link helper — only render when a PMID exists.
  function pubmedUrl(pmid: string): string {
    return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  }
</script>

<svelte:head>
  <title>Methodology — Phenologue</title>
  <meta name="description" content="Phenologue methodology v0.1 — chemotype-first patient-reported outcomes for medical cannabis. Open citation list, PubMed-linked." />
</svelte:head>

<section class="column">
  <h4>Methodology v0.1 / 26 April 2026</h4>
  <h1>Phenologue: a structured PRO methodology for medical cannabis</h1>

  <!-- a. Lede ------------------------------------------------------------- -->
  <p class="lede">
    Phenologue captures session-level outcomes against cultivar
    <em>chemotypes</em>, not strain names. Every session is a paired pre/post
    record tied to a specific batch. The methodology is openly licensed
    (<abbr title="Creative Commons Attribution-ShareAlike 4.0">CC BY-SA 4.0</abbr>)
    and the data is patient-owned by default. Pen and paper works fine; the
    platform automates the bookkeeping.
  </p>
  <p>
    Read the full methodology document on
    <a href="https://github.com/bpevreall/Phenologue/blob/main/docs/02-phenologue-methodology.md" rel="external">
      GitHub
    </a>. The citations below mirror §11 of that document — every analytical
    claim sits on top of peer-reviewed work.
  </p>

  <hr class="divider" />

  <!-- b. Citations -------------------------------------------------------- -->
  <h2 id="citations">References and prior art</h2>

  {#each GROUP_ORDER as group}
    <h3>{GROUP_LABELS[group]}</h3>
    <ol class="citations">
      {#each grouped[group] as c (c.doi)}
        <li>
          <span class="authors">{c.authors}</span>
          <span class="year">({c.year}).</span>
          <em class="title">{c.title}</em>{#if c.journal}.{/if}
          {#if c.journal}
            <span class="journal">{c.journal}</span>{#if c.volume} {c.volume}{/if}{#if c.pages}:{c.pages}{/if}.
          {/if}
          {#if c.pmid}
            <span class="ids">
              PMID:
              <a href={pubmedUrl(c.pmid)} rel="external">{c.pmid}</a>.
            </span>
          {/if}
          <span class="ids">
            DOI: <a href={c.doi} rel="external">{c.doi.replace(/^https?:\/\//, '')}</a>
          </span>
          {#if c.note}
            <p class="note">{c.note}</p>
          {/if}
        </li>
      {/each}
    </ol>
  {/each}

  <hr class="divider" />

  <!-- c. Versioning ------------------------------------------------------- -->
  <h2>Versioning and governance</h2>
  <p>
    The methodology is published as a versioned open document under CC BY-SA
    4.0. Patch versions (0.1.x) are clarifications, typo fixes, and additions
    to the controlled vocabulary. Minor versions (0.x) add scales, fields, and
    analysis approaches and remain backward-compatible. Major versions are
    breaking changes to the data structure with an explicit migration path.
  </p>
  <p>
    Substantive changes follow a public RFC process with a two-week minimum
    comment period. Every session record, every report, and every export is
    stamped with the methodology version it was produced against; aggregate
    analyses report the version distribution of their underlying sessions so
    that methodology drift never corrupts longitudinal comparisons.
  </p>
  <p>
    Community input is welcomed. RFCs and clarification requests live at
    <a href="https://github.com/bpevreall/Phenologue/issues" rel="external">
      github.com/bpevreall/Phenologue/issues
    </a>.
  </p>

  <hr class="divider" />

  <p class="meta">
    Methodology v0.1 · CC BY-SA 4.0 · authored by Brendon Pevreall · last
    revised 26 April 2026 · canonical source on
    <a href="https://github.com/bpevreall/Phenologue/blob/main/docs/02-phenologue-methodology.md" rel="external">
      GitHub
    </a>.
  </p>
</section>

<style>
  .lede {
    font-size: 1.1rem;
    line-height: 1.6;
    margin-top: 1rem;
  }

  h3 {
    margin-top: 2rem;
    color: var(--ink-soft);
    font-family: var(--mono);
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 0.3rem;
  }

  .citations {
    list-style: decimal;
    margin: 1rem 0 2rem 1.4rem;
    line-height: 1.55;
  }
  .citations li {
    margin-bottom: 1.2rem;
    padding-left: 0.3rem;
  }

  .authors {
    color: var(--ink);
  }
  .year {
    color: var(--ink-muted);
    font-family: var(--mono);
    font-size: 0.85em;
  }
  .title {
    color: var(--ink);
  }
  .journal {
    color: var(--ink-soft);
  }
  .ids {
    font-family: var(--mono);
    font-size: 0.8rem;
    color: var(--ink-muted);
    display: inline-block;
    margin-right: 0.4rem;
  }
  .ids a {
    color: var(--accent);
  }

  .note {
    font-size: 0.9rem;
    color: var(--ink-soft);
    margin: 0.4rem 0 0;
    padding-left: 0.8rem;
    border-left: 2px solid var(--paper-edge);
    line-height: 1.5;
    max-width: var(--measure);
  }

  abbr {
    text-decoration: none;
    border-bottom: 1px dotted var(--ink-muted);
    cursor: help;
  }
</style>

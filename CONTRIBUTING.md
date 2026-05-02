# Contributing to Phenologue

Thanks for taking the time to help. Phenologue is a small, opinionated v0.1
project. The shape of the contribution that's most useful right now is
**methodology criticism** and **bug reports from real session-logging
experience**, not large feature PRs.

## What we're looking for

### High-value contributions

- **Methodology RFCs.** Open a [GitHub Issue](https://github.com/bpevreall/Phenologue/issues)
  with the `methodology-rfc` label. Cite peer-reviewed sources where possible.
  See `docs/02-phenologue-methodology.md` for the canonical protocol and §10
  for the RFC process.
- **Bug reports.** Include the `request_id` from the API response envelope
  (visible in the network tab). Steps to reproduce, expected vs actual.
- **Citation suggestions.** If a claim in the methodology doc isn't supported
  by the cited literature, or if you can suggest a stronger primary source,
  open an issue with the `citation` label.
- **Terpene descriptor map corrections.** `worker/migrations/0002_reference_data.sql`
  contains the descriptor → terpene mapping. If you can cite peer-reviewed
  evidence for a correction (or a missing mapping), open an issue with the
  `terpene-map` label. Example precedent: the `skunk` mapping was removed in
  migration 0003 after Oswald et al. 2021 (ACS Omega) characterised it as
  volatile sulfur compounds, not caryophyllene.

### Lower-priority for now

- Large refactors. The architecture is intentionally simple at v0.1; we'll
  open issues for refactor-worthy themes when v0.2 planning starts.
- New features outside the methodology spec. Coach-mode (LLM-driven session
  intake) and the v0.2 anonymisation pipeline are already on the roadmap; see
  pinned issues.

## Code contributions

If you do want to send a code PR:

1. Fork and branch from `main`. Branch naming: `fix/short-description` or
   `feat/short-description`.
2. Worker changes: `cd worker && npx vitest run` must pass. New behaviour
   needs a test.
3. Pages changes: `cd pages && npx vite build` must succeed. Don't introduce
   new client-side dependencies without justification.
4. Don't touch the methodology document in a code PR — methodology changes
   go through the RFC process so we keep version history honest.
5. Sign your commits if possible. Squash before merging.

## Licensing of contributions

By contributing, you agree your contribution is licensed under the project's
existing terms:
- Code (worker/, pages/, scripts/, tests/, config) — **MIT** (`LICENSE`)
- Methodology (`docs/02-phenologue-methodology.md` and derivatives) —
  **CC BY-SA 4.0** (`LICENSE-METHODOLOGY`)

If you contribute methodology text, you're explicitly agreeing the addition
is CC BY-SA 4.0.

## Code of conduct

Be respectful. Disagree about the methodology rigorously and openly; that's
the whole point. Don't be a jerk about it.

## Maintainer

Brendon Pevreall ([@bpevreall](https://github.com/bpevreall)) — UK medical
cannabis patient, not a clinician. Email: `data-controller@phenologue.uk`.

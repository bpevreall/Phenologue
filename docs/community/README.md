# Community outreach drafts

Drafts of public-facing posts and applications.

**The order is important.** Show up as a useful patient first; the project pitch comes later, only after the community knows you. Posting Phenologue before establishing trust on MedBud will read as marketing and torpedo the warm-intro path.

## Files (in posting order)

- [04-medbud-introduction-post.md](04-medbud-introduction-post.md) — **Week 1.** Standard new-member intro post in Patient Chat. No project pitch.
- [05-medbud-irradiation-thread-reply.md](05-medbud-irradiation-thread-reply.md) — **Week 1–2.** A measured, citation-backed reply to Grumbleweed's irradiation thread. Establishes you as a useful technical contributor with two real batches.
- [01-medbud-volunteer-application.md](01-medbud-volunteer-application.md) — **Week 3–4.** Volunteer pitch, by which point you've made yourself known and the application is a formality, not a cold call.
- [02-medbud-methodology-rfc-post.md](02-medbud-methodology-rfc-post.md) — **Month 2.** RFC for v0.1 methodology, posted only after volunteer status is acknowledged AND phenologue.uk/methodology is live AND you've logged at least 5 of your own sessions to reference.
- [03-medbud-data-partnership.md](03-medbud-data-partnership.md) — **Month 3.** Data partnership pitch. Send only after the RFC has had genuine engagement.
- [sample-cultivars.csv](sample-cultivars.csv) — Example shape of the CSV the partnership would deliver. Tested against `worker/scripts/import-cultivars.ts`.

## Sequencing

1. **This week**: Sign up to MedBud, post the introduction (`04`), read everything in Research & Science you can stand. Don't post anywhere else.
2. **Week 2**: Post the irradiation reply (`05`) once you've actually compared your two batches and have one or two papers genuinely read. **Skip if you haven't.** A weak reply here is worse than no reply.
3. **Week 3–4**: If `05` lands well (replies, tags, no flagging-as-marketing), submit the volunteer application (`01`). Reference the irradiation thread as your contribution proof.
4. **Month 1 (technical track, in parallel)**: Deploy worker + pages, point phenologue.uk DNS, log own first 30+ sessions, finalise methodology copy on the public site.
5. **Month 2**: Once volunteer status is acknowledged AND the methodology is live AND you've dogfooded ≥5 sessions, post the RFC (`02`).
6. **Month 2 ongoing**: Reply to RFC feedback, queue methodology v0.1.x patch notes for legitimate corrections.
7. **Month 3**: Data partnership pitch (`03`) directly to MedBud admin. The volunteer relationship is the warm intro; the partnership is the deal.
8. **Month 3+**: If MedBud agrees, run `pnpm db:import:cultivars --remote --env dev --file ../data/medbud-cultivars.csv` against `dev`, sanity-check, then promote to `prod`. Open invite to log on Phenologue alongside, target 100+ sessions in the cohort.

## Why partnership-not-scrape is the only option

- MedBud's catalogue is curated, proprietary, and has no public API or data-licensing statement. Scraping it would breach implicit usage terms and torpedo the volunteer relationship.
- The volunteer route is the warm intro. The data partnership pitch lands much better from someone who has already proved they show up.
- A one-off CSV export is cheap for MedBud to produce. The asymmetric value flow (their catalogue ↔ our anonymised aggregate outcomes) is real and credible because Phenologue's methodology is open and the code is auditable.

## What not to do

- **Don't post the RFC before the methodology is live and you've dogfooded at least 5 sessions yourself.** The community will ask "do you actually use this?" and the answer needs to be yes, with timestamps.
- **Don't conflate Bloom and Phenologue in community posts.** Phenologue is the open thing; Bloom is the company name patients don't need to care about yet.
- **Don't promise features.** Promise the methodology + the platform that exists. Anything else is roadmap noise.
- **Don't engage in the same thread as a logged-in patient AND as the project author.** Pick one identity per thread, stay in it.

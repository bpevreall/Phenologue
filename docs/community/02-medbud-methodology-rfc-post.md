# MedBud RFC Post — Phenologue v0.1 Methodology

**Target:** Research & Science → Cannabinoids & Terpenes
**URL:** https://forums.medbud.wiki/categories/academy/
**Status:** Draft, not yet posted
**Send when:** After the volunteer application is acknowledged AND the methodology is live at phenologue.uk/methodology AND I have at least 5 of my own logged sessions to reference. Posting an RFC for a methodology I haven't dogfooded would be undignified.

---

## Suggested title

> RFC — open, UK-first methodology for chemotype-level patient self-tracking (CC BY-SA 4.0)

## Suggested category

Research & Science → Cannabinoids & Terpenes (the same forum where the terpene chart and irradiation threads live — that's the audience).

## Post body

> Hi all — UK patient under specialist care (ADHD primary) who's been hanging around Patient Chat and the Research & Science threads for a few weeks now. Posting in here properly for the first time because there's something I've built that I'd like to put up for community review.
>
> Quick framing first. There's already real prior art in this space:
>
> - **Strainprint** (Canada) and **Releaf** (US) both do session-level pre/post symptom logging with terpene and cannabinoid data, and have generated 12+ peer-reviewed papers each. Both are commercial / proprietary, and neither operates in the UK regulatory context.
> - **Project Twenty21** ran the largest UK observational PRO study from 2020 to end-2024. It published useful findings but has now ended.
> - The **UK Medical Cannabis Registry** (Curaleaf-led) is up at 40,000+ patients but is clinic-owned, formulation-rather-than-chemotype, and not openly available.
> - The **Vigil Index of Cannabis Chemovars** (J. Cannabis Research, 2022) is a published methodology for cannabinoid + terpene-led classification; it's the closest published prior art to what I'm proposing here.
>
> What I think is genuinely missing — and what I've built v0.1 of — is an **open, patient-owned, batch-fidelity, chemotype-led** self-assessment protocol with the methodology document published openly under CC BY-SA 4.0 and the implementation under MIT. UK-first not because chemotype is UK-specific, but because the regulatory + access context is and that shapes the data model.
>
> The result is **Phenologue**. I'd like to share v0.1 here for community feedback before pushing it any wider. Calling it an RFC because that's what it is — nothing is set in stone, and I'd rather get it wrong now with your input than lock something in for the wrong reasons.
>
> ### What it actually is
>
> A protocol that captures, per session:
>
> - **Pre-state** ratings (focus, anxiety, pain, mood, energy, appetite, sleep readiness — plus condition-specific scales for ADHD, GAD, chronic pain, sleep)
> - **Cultivar / batch** identity, with separate handling of measured vs. inferred terpene profiles
> - **Method controls** — vape temp, dose, route
> - **Post-state** ratings on the same scales (within 24h, then locked)
> - **Optional task-completion data** for focus-tagged sessions (relevant for ADHD)
> - **Optional next-day** rating
>
> Every session is tied to a specific batch number — same cultivar, different batches don't pool unless the producer confirms identity. Every session is stamped with the methodology version it was created against. Every inferred terpene profile is flagged `inferred`, never `measured`.
>
> ### Where it overlaps with threads already running here
>
> - **S.O.H™'s terpene chart** — Phenologue uses chemotype classification (limonene-dominant, caryophyllene-dominant, mixed, etc.) as the analytic unit, not strain name. I'd love to feed back into the chart with what the data actually shows once it's running.
> - **Grumbleweed's irradiation thread** — irradiation status is a first-class field on every batch in Phenologue. If irradiation is materially affecting reported THC and outcome, the structured data should make that visible. Long way from being able to answer that yet, but it's the kind of question this is built for.
>
> ### What it isn't
>
> - Not a medical device.
> - Not a diagnostic tool.
> - Not a substitute for clinical advice.
> - Not a regulated medical record.
> - Not a prescribing decision support tool.
>
> Just a structured way to log what worked and what didn't, and contribute (opt-in only) to an anonymised aggregate dataset.
>
> ### What I'm asking
>
> Three things:
>
> 1. **Read the methodology** — `https://phenologue.uk/methodology` — and tell me where it's wrong, where the scales are misaligned, where the controlled vocabularies are missing terms, where I've not understood my own indication well enough. I'm one patient. I will get this wrong without you.
> 2. **Tell me what's already been done that I should have cited and didn't.** The prior art list above is what I found; if you know of work I missed (especially anything UK-specific or anything outside the English-language literature), I want to converge with it, not duplicate it.
> 3. **If anyone wants to log alongside me**, the platform is at `https://phenologue.uk` and accounts are free forever. I'm explicitly *not* trying to monetise the open layer — it's CC BY-SA 4.0 methodology and MIT-licensed code. Bloom (the company behind it) exists, but anything paid lives at a different layer that hasn't been built and isn't on the table for years.
>
> ### Receipts
>
> - Methodology document: `https://phenologue.uk/methodology` (CC BY-SA 4.0)
> - Full open source repo: `https://github.com/<username>/phenologue` (MIT)
> - My own first 30+ sessions across L.A. S.A.G.E. T26 and Karamel Kandy KSV-9 are the v0.1 reference dataset — happy to share methodology-version-stamped exports of those sessions if it's useful.
>
> Versioning is open, RFCs are open, every contribution is attributed under CC BY-SA. If something breaks on contact with reality, v0.2 fixes it. Patch notes will live alongside the methodology.
>
> Cheers — Brendon

## Tone notes for self-review before posting

- **Not a sales pitch.** It's a peer asking peers for review.
- **Lead with the question, not the product.** The community has heard product pitches before.
- **Show the work.** Methodology link + repo link + sample dataset are the receipts that this isn't vapourware.
- **Do not engage if someone questions whether self-report data has bias.** They're right. The methodology already says so. Point them at §9.1 of the doc.
- **Do not engage with strain-vs-chemotype debates as if they're contested.** They aren't, in the literature. State the position once and link to refs.
- **No emojis.** This audience reads as patients-who-take-themselves-seriously, not wellness Instagram.

## After posting

- Cross-post a shorter version to the **Cannabinoids & Terpenes** subforum if it lands well in the parent.
- Save thread URL as `phenologue/docs/community/medbud-rfc-thread.md` for reference and reply tracking.
- Don't post anywhere else for at least 7 days. Let one thread breathe.

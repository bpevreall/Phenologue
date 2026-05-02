# MedBud × Phenologue — Data Partnership Proposal (Draft)

**Target:** MedBud admin / data team (via volunteer thread acknowledgement → direct contact)
**Status:** Draft, not yet sent
**Send when:** Only after the volunteer application has been received well AND the methodology is live AND the founder dataset has 30+ sessions. Asking for data on day one looks like the asker is the only one bringing value to the table.

---

## What I'm proposing

Two organisations swapping the data each one is uniquely positioned to produce, neither of which can build the other's piece alone.

**MedBud has** the most complete UK-context producer/cultivar catalogue I've seen — Producer → Strain hierarchy, T## THC indicators, tier signalling, pharmacy availability. That's a curated asset that takes years of community attention to keep current.

**MedBud doesn't have** structured patient-reported outcomes data tied to that catalogue. Which is fair — that's not the same job. It's the job Phenologue is built to do.

**Phenologue has** an open methodology (CC BY-SA 4.0), open code (MIT), per-session pre/post structured ratings, batch-fidelity outcome tracking, chemotype classification, organoleptic terpene inference for unmeasured profiles. What Phenologue doesn't have on day one is a cultivar catalogue — every patient has to re-enter the same producer/strain data the next patient already entered.

**The deal**:

1. **MedBud** shares the producer + strain catalogue (one-off CSV is fine; periodic refresh would be better) under a clearly attributed licence. No batch-level data, no patient identifiers, just the cultivar reference table.
2. **Phenologue** ingests it as the seed cultivar catalogue, attributing MedBud on every cultivar row and on the public catalogue page.
3. **Phenologue** publishes the aggregate output — chemotype-level outcome statistics across consenting patients, anonymised at n≥30, suppressed below — back to MedBud's Research & Science forum and (if useful) as a structured feed.
4. Either side can withdraw at any time without penalty. Patient-level data never leaves Phenologue.

That's it. No money changes hands. No exclusivity. No control of either side's roadmap.

## Why this works for MedBud

- The catalogue you already maintain becomes the catalogue thousands of structured outcome reports are tied to. Your data gets richer, not less valuable.
- You don't take on platform risk. Phenologue is a separate project, separate code, separate liability. If it goes nowhere, your catalogue is unaffected.
- Public attribution on every cultivar row is a SEO + credibility win.
- The aggregate outcome data we'd publish back is exactly the kind of evidence the Research & Science forum is currently asking for in threads like Grumbleweed's irradiation question and S.O.H™'s terpene chart.

## Why this works for Phenologue

- I don't have to ask 5,000 patients to re-key the same 30 producers and 800 strain names.
- Patients land on Phenologue and immediately see their actual prescription cultivar in the picker. Adoption goes up.
- The volunteer relationship gives me a route to keep the catalogue current as new producers come in, rather than drift.

## What I'd need from you

Minimum viable form:

```
producer,name,thc_label,tier,country_origin,medbud_url
4C Labs,Strawberry Cake,T22,Value,...,https://medbud.wiki/strains/4c-labs/...
4C Labs,Donkey Butter,T24,Premium,...,https://medbud.wiki/strains/4c-labs/...
Aurora,...,...,...
```

If you have terpene profiles, COA links, or irradiation flags as structured fields, those would be gold and Phenologue's schema is ready for them today (`measurement_status`, `terp_*`, `irradiation`, `coa_url`). If you don't, the inference pipeline kicks in and patients fill the rest from their own organoleptic assessments — the methodology has been built specifically to not need everything up front.

## Licensing I'd suggest

The catalogue stays MedBud's data. Phenologue would publish cultivar pages with a clear "**Cultivar metadata © MedBud, used under partnership; outcome data CC BY-SA 4.0 Phenologue**" line on every row, with a link back to the MedBud strain page where the source data lives. Patients log sessions against your cultivar identifiers; they can never overwrite or contradict your fields.

If you'd prefer the catalogue under an explicit licence — CC BY-NC, CC BY-SA, MedBud-proprietary-with-attribution-only — I'll work to whatever fits your charter. The methodology side stays CC BY-SA 4.0; that's a hard constraint of Phenologue, not a position I'd ask you to adopt.

## What this is not

- **Not a data sale.** No money in either direction.
- **Not a Phenologue takeover.** MedBud users are not pushed to register on Phenologue, ever. The two communities can stay separate; the data flow is the only shared piece.
- **Not perpetual.** One-off CSV, six-monthly refresh, or weekly feed — whatever cadence works for both sides, with either side able to stop at any time.
- **Not a replacement for what you do.** MedBud is the directory and the community. Phenologue is the outcome-tracking instrument that pairs with it. Two different jobs.

## Concrete next steps if you're interested

1. A read of the methodology + a look at the Phenologue platform with a real account, so the proposal isn't abstract.
2. A 30-minute call (or async via the volunteer thread, your call) to scope the catalogue export.
3. A first import to Phenologue's `dev` environment, attributed and visible only to me until you've signed off on what users will see.
4. Public launch only after you're happy with the cultivar pages.

---

## Things I am explicitly committing to up front

- I will never scrape MedBud, with or without permission, and I will not import any MedBud data into Phenologue without an explicit yes from you on each batch.
- The aggregate outputs I publish back to MedBud are yours to use as you see fit, including republishing them as your own content.
- If you ever want the relationship wound down, I'll remove every cultivar that came from MedBud's data within 7 days, leaving any patient-logged sessions intact (they were patient-owned data anyway).
- I'll never use this partnership to position Phenologue as MedBud-endorsed beyond the literal attribution on cultivar rows, and any marketing language goes past you before it ships.

— Brendon (Pevreall Technology Solutions / Bloom)

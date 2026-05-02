# Bloom: Strategic Repositioning

**Version:** 0.1 (Working Draft)
**Author:** Brendon Pevreall
**Date:** 26 April 2026
**Status:** Internal strategic document

---

## Summary

Bloom was originally conceived (March 2026) as a CQC-registered digital clinic for UK medical cannabis prescribing. That concept is being filed as a long-term option rather than abandoned. Bloom is being repositioned as a **patient outcomes intelligence and research company** — building tooling, methodology, and data assets in a market that currently lacks all three.

The wedge product is **Phenologue**: an open, free, scientifically transparent patient self-assessment platform for medical cannabis. Phenologue builds the user base, the dataset, and the domain credibility from which Bloom's commercial layers can grow.

---

## Why the original Bloom idea stalled

Honest assessment, not regret:

- **Capital intensity.** £30–50k minimum to stand up a CQC-registered prescribing service, with no revenue for 6–12 months.
- **Clinical co-founder gap.** The clinic model requires a registered prescriber as a clinical lead. Recruiting one before product-market fit is a chicken-and-egg problem.
- **Regulatory burden up front.** CQC registration, GPhC pharmacy partnerships, prescriber indemnity, controlled-drug logistics — all of this has to be built before a single patient is served.
- **Solo founder bandwidth.** Building a clinic in evenings while working full-time as a Field Technical Support Engineer at Hanover is not realistic.
- **First Enterprise Start Up Loan window closed** (rate increase 6 April 2026 deadline missed).

None of this means the clinic concept was wrong. It means it was the wrong *first move*.

---

## Why the platform model is the right first move

The UK medical cannabis market has roughly 50,000+ active patients (estimated, growing rapidly). Clinics dispense based on:

1. Patient self-report ("how did the last one feel?")
2. Manufacturer claims (sativa/indica/hybrid, THC %)
3. Lab COAs where available (cannabinoid + sometimes terpene assays)
4. Clinician experience (highly variable, often anecdotal)

**There is no industry-standard structured patient-reported outcomes (PRO) data.** Producers do not know which of their cultivars actually work for which conditions. Clinics do not have systematic feedback on prescribing decisions. Patients do not have a structured way to document what works for them.

This is a real gap. Filling it does not require:
- A prescribing licence
- Pharmacy partnerships
- Clinical co-founders
- CQC registration
- Significant capital

It does require:
- A defensible methodology (the IP)
- Patient-facing tooling that respects user intelligence
- Time and discipline to build a dataset

That is buildable solo, in evenings, on a free-tier Cloudflare stack, while keeping the day job.

---

## The Bloom value stack

Layered from lowest commitment to highest, each layer building on the previous:

### Layer 1: Phenologue (open, free, public)

The patient self-assessment platform. Free forever. Open methodology. Open data export. Anonymised aggregate dataset shared back to the community.

**Purpose:** Build user base. Build dataset. Build credibility. Establish the methodology as a standard.

**Revenue:** None directly. This is the wedge.

**Risk profile:** Negligible. No regulatory exposure (not medical advice, not prescribing, not dispensing). Hosting cost ~£0/month at hobbyist scale.

### Layer 2: Bloom Patient (freemium consumer)

Phenologue with enhanced features:
- AI-assisted insight generation from personal session data ("your focus scores correlate strongly with limonene-pinene chemotypes")
- Pre-appointment reports formatted for clinician handoff
- Prescription review preparation
- Cohort matching ("patients with similar profiles to yours rated X highly")
- Microscope image analysis tooling
- Vape temperature optimisation per chemotype

**Purpose:** Convert engaged Phenologue users into paying customers. Validate willingness to pay.

**Revenue:** £4.99–9.99/month subscription. At 1% conversion of 5,000 active users, ~£250–500/month.

**Risk profile:** Low. Still patient-facing self-quantification, not medical advice.

### Layer 3: Bloom Clinic (B2B SaaS)

Sold to existing UK clinics (Curaleaf, Sapphire, Releaf, Mamedica, Medicann, Lyphe, et al.).

- Pre-appointment patient outcome summaries
- Cohort-level prescribing intelligence ("Karamel Kandy worked for 23% of ADHD patients vs 67% for L.A. S.A.G.E.")
- Clinician-side dashboard
- Patient adherence and outcome tracking
- Outcome-based prescribing decision support
- White-label option for clinic-branded patient apps

**Purpose:** Capture clinic-side spend. The party with the most willingness to pay is the prescriber.

**Revenue:** £200–1,000/clinician/month. UK has ~300–500 active cannabis prescribers. TAM ~£60k–500k/month.

**Risk profile:** Moderate. B2B sales cycle, requires evidence of patient outcomes improvement, may need ISO 27001 / NHS DSPT compliance.

### Layer 4: Bloom Research (B2B/B2I licensing)

Anonymised, aggregated, structured PRO dataset licensed to:
- Producers (which cultivars work for which conditions — they currently have no idea)
- Researchers (Drug Science, MCCT, Imperial Centre for Psychedelic Research, etc.)
- Regulators (MHRA, NICE)
- Insurance / private health (when UK medical cannabis enters that market)

**Purpose:** Monetise the dataset asset. High-margin. Scales without proportional cost.

**Revenue:** £5k–50k per dataset licence. A handful of producer customers per year covers operating cost of the entire Bloom stack.

**Risk profile:** Moderate. Data governance, ethics review, IRB-equivalent approval for research use.

### Layer 5: Bloom Clinical (the original idea, deferred)

Only attempted once Layers 1–4 are generating revenue, when:
- Bloom has a clinical co-founder
- Bloom has demonstrable patient outcome data
- Bloom has capital from operating revenue or successful fundraise
- Regulatory environment is mature enough to make CQC registration tractable

This is a 3–5 year option, not an immediate goal.

---

## What changes about Bloom's identity

**Old identity:** "A digital clinic for UK medical cannabis."

**New identity:** "We make medical cannabis prescribing evidence-based. We build the tools and the data."

The brand can still be Bloom. The clinic dream isn't dead, it's deferred until the platform makes it tractable.

---

## Why this is defensible

1. **First-mover on structured PRO data.** Nobody is doing this in UK medical cannabis at scale. Once a methodology becomes the de facto standard, switching costs are real.
2. **Compounding data moat.** Every session logged improves the aggregate dataset. Cannot be replicated by a fast follower without time.
3. **Patient trust through transparency.** Open methodology, open data export, scientific honesty. This is the opposite of how every existing clinic platform works (siloed, proprietary, paternalistic).
4. **Multi-sided value.** Patients get insight. Clinics get evidence. Producers get post-market data. Researchers get a dataset. Regulators get visibility. Each side reinforces the others.
5. **Founder-market fit.** Brendon is: a UK medical cannabis patient (primary source), a field engineer (structured data discipline), a developer (can build it), with ADHD (a specific clinical question worth answering, and a cohort that is currently underserved).

---

## Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Existing clinic builds their own | Open standard + first-mover dataset advantage. Clinics that don't license Bloom face a build-vs-buy decision against a 12+ month head start. |
| Producer pushback on negative outcome data | Data is patient-reported, not producer-attributed in public outputs. Producer-facing reports are licensed and contractual. |
| Regulator (MHRA / CQC) intervention | Phenologue is explicitly not medical advice, not a medical device. Bloom Clinic positions as decision-support, not diagnosis. Engage regulators early. |
| Solo founder burnout | Methodology-first build means the protocol is publishable even if the code never ships. Multiple exit paths. |
| Adoption stalls | Phenologue is genuinely useful as a personal tool even with one user (Brendon). Personal use validates and dogfoods the protocol. |
| Data governance failure | UK-resident infrastructure (Cloudflare UK), GDPR-compliant from day one, anonymisation by design, no PII in research dataset. |

---

## What the next 90 days looks like

**Month 1: Methodology + scaffold**
- Phenologue methodology v0.1 published as open document
- Technical scaffold deployed (Cloudflare Workers + D1 + Pages)
- Personal session logging operational (n=1: Brendon)
- First 30 sessions logged across L.A. S.A.G.E. and Karamel Kandy

**Month 2: Public soft launch**
- Phenologue.uk domain live (or chosen alternative)
- Open beta invite to MedBud community
- Volunteer offer to MedBud submitted with Phenologue as portfolio
- 5–10 active beta users

**Month 3: Validation**
- 100+ sessions logged across beta cohort
- Methodology peer review from Drug Science / academic contacts
- Decision point: continue as open project, or begin Bloom Patient layer

---

## Why now

UK medical cannabis is at the inflection point where:
- Patient population is large enough to generate meaningful data (50k+)
- Producer count is high enough to need differentiation (30+ active producers)
- Clinical evidence is thin enough that real-world data is *demanded* by regulators and researchers
- Public discourse is shifting (Drug Science, Better Health Through Cannabis, MCCT all advocating for evidence-based prescribing)

The window for being first is 12–24 months. After that, someone else will build this — likely a clinic with capital, building it badly and proprietarily.

Better that it's built openly, by a patient, with the methodology as a public good.

---

## Bloom in one sentence

> Bloom builds the evidence base UK medical cannabis is missing — starting with Phenologue, an open patient self-assessment tool that respects users as capable scientists of their own experience.

---

*This document supersedes the March 2026 Bloom clinic concept. The clinic concept is preserved as Layer 5 / future option.*

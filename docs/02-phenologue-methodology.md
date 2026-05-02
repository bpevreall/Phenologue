# Phenologue: Patient-Reported Outcomes Methodology

**Version:** 0.1 (Draft for review)
**Author:** Brendon Pevreall, Bloom (Pevreall Technology Solutions)
**Date:** 26 April 2026
**Licence:** CC BY-SA 4.0 (open methodology)
**Status:** Pre-implementation, open for community input

---

## 0. Purpose

Phenologue is a structured patient self-assessment protocol for medical cannabis. It captures session-level outcomes against cultivar chemotypes, builds longitudinal personal data, and produces aggregable anonymised research output.

The protocol exists because UK medical cannabis prescribing is currently driven by:

- Indica/sativa/hybrid labels (largely meaningless at the chemovar level)
- THC percentage (a poor predictor of effect)
- Anecdotal patient reports (unstructured, non-comparable across patients)

What is missing is **structured longitudinal patient data linking chemotype to outcome by condition**. Phenologue is an attempt to build that record, starting with a single patient (n=1) and scaling to a contributable dataset.

This document specifies the protocol. The accompanying technical specification documents the implementation. This methodology is platform-independent — it can be followed with pen and paper.

---

## 1. Design principles

1. **Chemotype over taxonomy.** Strain names and indica/sativa/hybrid labels are unreliable. The unit of analysis is the cannabinoid + terpene profile of a specific batch.
2. **Pre/post comparison.** Every session captures both a pre-state and a post-state on the same scales. Effects are deltas, not absolutes.
3. **Standardised scales.** All subjective ratings use 0–10 visual analogue scales (VAS) with anchored descriptors. Free text is captured separately and never used for quantitative analysis.
4. **Batch fidelity.** Each session is tied to a specific batch number. Batches from the same cultivar are not pooled without explicit producer-confirmed identity.
5. **Method controlled.** Vape temperature, dose, and route are recorded to control for delivery variance.
6. **Inference is flagged.** Where lab COAs are unavailable, terpene profiles are inferred from organoleptic assessment and explicitly tagged as `inferred`, never `measured`.
7. **Patient-led, not clinician-led.** This is a self-quantification tool. It is not a clinical document and does not substitute for medical advice or supervision.
8. **Anonymisable by design.** All data structures support stripping personal identifiers for aggregation, sharing, and research use.
9. **Scientifically literate by default.** The protocol does not dumb down chemistry, pharmacology, or statistical caveats. Patients are treated as capable scientists of their own experience.
10. **Honest about limitations.** Subjective rating data has well-known biases (recall, expectancy, placebo). The protocol does not claim to eliminate these. It claims to make them visible and consistent.

---

## 2. The chemotype model

### 2.1 Why chemotype, not strain

A strain name is a marketing label. Two batches of "Karamel Kandy" from different producers — or even different harvests from the same producer — can have materially different terpene and cannabinoid profiles. Chemotype captures what is actually doing the pharmacology.

### 2.2 Chemotype dimensions captured

A Phenologue chemotype record contains:

**Cannabinoids (mandatory):**
- Δ9-THC (% w/w)
- CBD (% w/w)
- THCV, CBG, CBN, CBC (% w/w, where reported)
- Total cannabinoids (% w/w)

**Terpenes (where available, otherwise inferred):**
- α-Pinene, β-Pinene
- Myrcene
- Limonene
- Terpinolene
- Linalool
- β-Caryophyllene
- α-Humulene
- Ocimene
- α-Bisabolol
- Farnesene
- Other terpenes (free text + value)

**Provenance:**
- Producer
- Country of origin
- Cultivar name (as marketed)
- Batch number
- Harvest date (where available)
- Test date (where available)
- COA source URL (where available)
- Irradiation status (gamma / e-beam / none / unknown)

**Inference flag:**
- `measured` — values from a published COA
- `partially_measured` — cannabinoids measured, terpenes inferred
- `inferred` — values inferred from organoleptic / structural assessment

### 2.3 Chemotype classification

For analytical purposes, each chemotype is classified by its dominant terpene (the terpene with the highest reported or inferred percentage):

- `limonene-dominant`
- `myrcene-dominant`
- `caryophyllene-dominant`
- `terpinolene-dominant`
- `pinene-dominant`
- `linalool-dominant`
- `mixed` (no terpene >25% of total terpene content)

Secondary terpene is also captured for finer-grained analysis. This produces, for example:

> `limonene-dominant / pinene-secondary` — the L.A. S.A.G.E. T26 profile assessed in the founder's reference report.

---

## 3. Session protocol

### 3.1 Session definition

A session is a single discrete consumption event with a defined start, defined dose, and post-effect window of measurement. Continuous redosing within a 4-hour window counts as one session with cumulative dose recorded.

### 3.2 Session record structure

**Pre-session (T–5 to T–0 minutes):**
- Timestamp
- Cultivar + batch reference
- Pre-state ratings (see §4)
- Intended purpose tag (see §5)
- Pre-state free-text note (optional)

**Session execution (T–0 to T+session_end):**
- Route of administration (vaporisation / oil / edible / other)
- For vaporisation: device, temperature(s), duration
- Dose (grams or millilitres)
- Onset time observation (minutes to first noticeable effect)
- Peak time observation (minutes to peak effect)

**Post-session (T+30 to T+90 minutes for inhaled, T+90 to T+180 for oral):**
- Post-state ratings (see §4)
- Effect free-text note
- Adverse effects checklist
- Task completion data (where applicable, see §6)

**Follow-up (T+24 hours, optional):**
- Next-day rating (residual effect, sleep quality, morning state)
- Free-text note

### 3.3 Session integrity rules

- A session record is incomplete (and excluded from analysis) without both a pre-state and a post-state rating set.
- A session may be voided by the patient at any time within 24 hours with a void reason.
- A session cannot be edited after 24 hours; only annotated.
- The protocol does not police honesty. It records what the patient reports.

---

## 4. Standardised rating scales

All ratings are 0–10 visual analogue scales with anchored descriptors at 0, 5, and 10. The same scales are used pre- and post-session.

### 4.1 Core scales (always captured)

| Scale | 0 | 5 | 10 |
|-------|---|---|----|
| **Focus** | Cannot focus at all | Can focus with effort | Effortless deep focus |
| **Anxiety** | None | Moderate | Overwhelming |
| **Pain** | None | Moderate | Worst imaginable |
| **Mood** | Worst possible | Neutral | Best possible |
| **Energy** | Exhausted | Normal | High energy |
| **Appetite** | None | Normal | Strong hunger |
| **Sleep readiness** | Wide awake | Could rest if needed | Falling asleep |

### 4.2 Condition-specific scales (captured per patient profile)

Patients select condition-specific scales relevant to their indication. Examples:

**ADHD:**
- Task initiation difficulty
- Working memory clarity
- Impulse control
- Hyperfocus tendency
- Time perception accuracy

**Chronic pain:**
- Pain localisation distress
- Movement-induced pain
- Pain interference with daily activity

**Anxiety disorders:**
- Anticipatory anxiety
- Social discomfort
- Physical anxiety symptoms (palpitations, tension)

**Sleep disorders:**
- Sleep onset speed
- Sleep continuity (next-day report)
- Morning grogginess

**Generic addable:**
- Custom 0–10 scale with patient-defined anchors

### 4.3 Effect-quality scales (post-session only)

- **Effect intensity** (0 = no effect, 10 = overwhelming)
- **Effect pleasantness** (0 = unpleasant, 5 = neutral, 10 = very pleasant)
- **Functional capacity during effect** (0 = incapacitated, 10 = fully functional)
- **Cognitive clarity** (0 = foggy, 10 = sharp)
- **Body sensation** (0 = heavy/sedated, 5 = neutral, 10 = energised/light)

---

## 5. Purpose tagging

Each session is tagged with one or more intended purposes from a controlled vocabulary:

- `focus` — work/study tasks requiring sustained attention
- `creativity` — ideation, design, music, writing
- `physical_activity` — exercise, manual work, sport
- `social` — social engagement
- `relaxation` — wind-down, decompression
- `sleep_prep` — pre-bedtime use
- `pain_management` — primary pain indication
- `anxiety_management` — primary anxiety indication
- `appetite_stimulation`
- `recreational` — pleasure-led use, no specific clinical target
- `exploratory` — first use of a new cultivar / batch, no specific target

Outcome analysis is filtered by purpose tag. A cultivar that scores poorly for focus may score excellently for sleep_prep, and these are not pooled.

---

## 6. Task completion data (optional, ADHD-relevant)

For sessions tagged `focus`, patients may optionally log task completion data:

- Task description (free text)
- Estimated complexity (1–5)
- Estimated time required (minutes)
- Actual time taken (minutes)
- Completion status (completed / partial / abandoned)
- Self-rated quality (0–10)

This generates objective-adjacent data that complements the subjective focus VAS and is particularly relevant for ADHD outcome tracking.

---

## 7. Organoleptic assessment

Where a COA is unavailable or terpene data is missing, patients may submit an organoleptic assessment that is mapped to an inferred terpene profile. This is the protocol's bridge between qualitative patient experience and quantitative analysis.

### 7.1 Organoleptic descriptors (controlled vocabulary)

Patients select from a checklist:

**Citrus family:** lemon, lime, orange, grapefruit, sour citrus
**Pine/forest family:** pine, fir, eucalyptus, fresh herb, sage, rosemary
**Floral family:** lavender, rose, jasmine, violet
**Fruit family:** berry, tropical, stone fruit, apple, melon
**Sweet family:** vanilla, candy, honey, caramel, butterscotch
**Earth family:** soil, moss, mushroom, damp wood
**Spice/gas family:** pepper, clove, diesel, chemical, skunk
**Dough family:** baked goods, cookie dough, yeast, malt
**Other:** cheese, mint, menthol, coffee, chocolate

### 7.2 Mapping to inferred terpenes

The protocol maintains a published mapping (descriptor → likely terpene) used to infer profiles. This mapping is open, versioned, and refined as data accumulates. Examples:

- Lemon, sour citrus → limonene
- Pine, fresh herb → α-pinene
- Lavender, floral lift → linalool
- Pepper, clove, diesel → β-caryophyllene
- Dough, malt → caryophyllene + myrcene combination
- Sharp herbal, terpene-solvent → terpinolene
- Tropical, mango → myrcene

Inferred profiles are never reported as measured values. The data flag is explicit.

### 7.3 Trichome assessment (optional)

For patients with microscope access, a trichome maturity assessment captures:

- Magnification used
- Distribution: clear / cloudy / amber percentages (estimated)
- Density: low / medium / high / very high
- Damage: intact / partially knocked off / heavily degraded
- Image attachment (optional)

This corroborates the chemotype inference and provides freshness data.

---

## 8. Data ethics and governance

### 8.1 Patient ownership

Every patient owns their own session data. The protocol guarantees:

- Full export at any time, in machine-readable formats (JSON, CSV)
- Full deletion at any time, without retention
- No use of identified data for any purpose without explicit consent
- No sharing with third parties without explicit consent

### 8.2 Anonymisation for aggregation

Patient-level data may be anonymised for aggregate analysis. Anonymisation strips:

- Name, email, address, phone, date of birth
- Free-text notes (unless explicitly tagged shareable by the patient)
- Microscope images (unless explicitly shared)
- Geographic data finer-grained than NUTS-2 region (UK)

What is retained for aggregation:

- Age band (5-year)
- Sex (binary or non-binary)
- Condition tags
- Session ratings and metadata
- Cultivar / chemotype references

### 8.3 Research use

Anonymised aggregate data may be made available to researchers under:

- Open access (descriptive statistics, dashboards)
- Licensed access (raw anonymised dataset, with data sharing agreement)

Patient consent for research use is opt-in, granular, and revocable.

### 8.4 What this protocol is not

- Not a medical device
- Not a diagnostic tool
- Not a substitute for clinical advice
- Not a regulated medical record
- Not a prescribing decision support tool (that is a separate product layer)

---

## 9. Caveats and known limitations

### 9.1 Subjective rating bias

Self-reported ratings are subject to:

- **Expectancy effects** — knowing what a strain is "supposed to" do influences the rating.
- **Recall bias** — post-session ratings drift in retrospect.
- **Anchoring** — pre-session rating influences post-session rating beyond the actual effect.
- **Mood-of-the-day** — exogenous factors are uncontrolled.
- **Tolerance** — chronic users have shifted baselines.

The protocol does not solve these. It mitigates by:

- Capturing pre- and post-state on the same scales
- Logging contextual variables (sleep, food, prior dosing)
- Encouraging multiple sessions per cultivar before drawing conclusions
- Providing aggregate data so individual sessions are contextualised

### 9.2 Inferred terpene reliability

Organoleptic inference is approximate. It correlates with measured profiles in many cases but cannot replace GC-MS analysis. Inferred profiles are flagged and weighted lower in aggregate analysis.

### 9.3 N=1 limitations

Personal data is personal. A patient's chemotype-outcome map applies to that patient. Aggregation across patients reveals trends but does not produce universal prescribing rules.

### 9.4 Selection bias in adoption

Early Phenologue users will skew toward technically-literate, motivated patients. Aggregate findings may not generalise to the broader patient population. This is documented and corrected for where possible.

---

## 10. Versioning and governance

This methodology is published as a versioned open document under CC BY-SA 4.0. Changes follow:

- **Patch versions (0.1.x):** Clarifications, typo fixes, descriptor additions to controlled vocabulary
- **Minor versions (0.x):** New scales, new fields, new analysis approaches (backward-compatible)
- **Major versions (x.0):** Breaking changes to data structure (rare, with migration path)

Community input is welcomed via the Phenologue repository. Substantive changes require:

- Public RFC period (2 weeks minimum)
- Clear migration path for existing data
- Versioning of all generated reports against the methodology version used

---

## 11. References and prior art

### 11.1 Patient-reported outcome instruments

The Phenologue rating scales are inspired by, but not direct lifts of, validated PRO instruments:

- **WHO HRQoL-BREF** for general health PROs
- **ASRS-v1.1** for ADHD self-report items
- **Brief Pain Inventory** for pain items
- **GAD-7** for anxiety items (also the primary anxiety PROM in the UK Medical Cannabis Registry)
- **Pittsburgh Sleep Quality Index** for sleep items
- **EQ-5D-5L** for health-related quality of life (the standard NICE-recognised UK HRQoL instrument)
- **Single-Item Sleep Quality Scale (SQS)** as used by UK MCR

### 11.2 Cannabis chemovar science (peer-reviewed, PubMed-indexed)

The chemotype-first data model is grounded in the following literature:

1. **Sawler J, Stout JM, Gardner KM, Hudson D, Vidmar J, Butler L, Page JE, Myles S** (2015). *The Genetic Structure of Marijuana and Hemp.* PLoS ONE 10(8):e0133292. PMID: 26308334. DOI: [10.1371/journal.pone.0133292](https://doi.org/10.1371/journal.pone.0133292)
   *Direct evidence that "marijuana strain names often do not reflect a meaningful genetic identity" — the foundational reference for moving away from strain-name marketing labels.*

2. **Hazekamp A, Fischedick JT** (2012). *Cannabis — from cultivar to chemovar.* Drug Test Anal 4(7-8):660-7. PMID: 22362625. DOI: [10.1002/dta.407](https://doi.org/10.1002/dta.407)
   *The canonical chemovar paper. Establishes PCA-based chemovar classification across 700+ cultivars.*

3. **Russo EB** (2011). *Taming THC: potential cannabis synergy and phytocannabinoid-terpenoid entourage effects.* Br J Pharmacol 163(7):1344-64. PMID: 21749363. DOI: [10.1111/j.1476-5381.2011.01238.x](https://doi.org/10.1111/j.1476-5381.2011.01238.x)
   *Foundational reference for the entourage effect — why terpenes matter, not just cannabinoids.*

4. **Booth JK, Page JE, Bohlmann J** (2017). *Terpene synthases from Cannabis sativa.* PLoS ONE 12(3):e0173911. PMID: 28355238. DOI: [10.1371/journal.pone.0173911](https://doi.org/10.1371/journal.pone.0173911)
   *Identifies the 9 terpene synthases responsible for myrcene, ocimene, limonene, α-pinene, β-caryophyllene and α-humulene biosynthesis. Foundational chemistry for the chemotype model.*

5. **Booth JK, Yuen MMS, Jancsik S, Madilao LL, Page JE, Bohlmann J** (2020). *Terpene Synthases and Terpene Variation in Cannabis sativa.* Plant Physiol 184(1):130-147. PMID: 32591428. DOI: [10.1104/pp.20.00593](https://doi.org/10.1104/pp.20.00593)
   *Documents large terpene variation both within and between sets of plants labelled as the same cultivar — the empirical basis for batch-level fidelity (§2.3) rather than cultivar-level pooling.*

6. **Cerrato A, Citti C, Cannazza G, Capriotti AL, Cavaliere C, Grassi G, Marini F, Montone CM, Paris R, Piovesana S, Laganà A** (2021). *Phytocannabinomics: Untargeted metabolomics as a tool for cannabis chemovar differentiation.* Talanta 230:122313. PMID: 33934778. DOI: [10.1016/j.talanta.2021.122313](https://doi.org/10.1016/j.talanta.2021.122313)
   *Demonstrates that traditional 5-chemotype classification (THC/CBD/CBG ratios) is insufficient and that minor phytocannabinoids define meaningful subgroups.*

7. **Oswald IWH, Ojeda MA, Pobanz RJ, Koby KA, Buchanan AJ, Del Rosso J, Guzman MA, Martin TJ** (2021). *Identification of a New Family of Prenylated Volatile Sulfur Compounds in Cannabis Revealed by Comprehensive Two-Dimensional Gas Chromatography.* ACS Omega 6(47):31667-31676. PMID: 34869990. DOI: [10.1021/acsomega.1c04196](https://doi.org/10.1021/acsomega.1c04196)
   *Establishes that the "skunk" cannabis aroma is caused by volatile sulfur compounds (VSCs), specifically 3-methyl-2-butene-1-thiol — not terpenes. Reason the terpene_descriptor_map does NOT map "skunk" to a terpene; it is flagged as unmapped pending VSC-class support in v0.2.*

8. **Herwig N, Utgenannt S, Nickl F, Möbius P, Nowak L, Schulz O, Fischer M** (2024). *Classification of Cannabis Strains Based on their Chemical Fingerprint — A Broad Analysis of Chemovars in the German Market.* Cannabis Cannabinoid Res 10(3):409-419. PMID: 39137353. DOI: [10.1089/can.2024.0127](https://doi.org/10.1089/can.2024.0127)
   *140 medicinal cannabis flowers from the German market analysed by GC-MS. Establishes a 6-cluster terpene-profile classification with no statistical correlation between terpene profile and indica/sativa/hybrid genetic label. The most directly relevant peer-reviewed precedent for Phenologue's chemotype dimensions (§2.3).*

### 11.3 Methodological neighbours — UK observational cannabis cohorts

The Phenologue protocol does NOT replace these registries. It complements them by being patient-led, chemotype-tagged, and openly methodologically licensed where they are clinician-recruited and brand-tagged:

9. **Rifkin-Zybutz R, Erridge S, Holvey C, Coomber R, Gaffney J, Lawn W, et al.** (2023). *Clinical outcome data of anxiety patients treated with cannabis-based medicinal products in the United Kingdom: a cohort study from the UK Medical Cannabis Registry.* Psychopharmacology (Berl) 240(8):1735-1745. PMID: 37314478. DOI: [10.1007/s00213-023-06399-3](https://doi.org/10.1007/s00213-023-06399-3)
   *302 GAD patients tracked with GAD-7, SQS, EQ-5D-5L at 1, 3, 6 months. Imperial College London / Sapphire Medical Clinics.*

10. **Wang C, Erridge S, Holvey C, Coomber R, Usmani A, Sajad M, et al.** (2023). *Assessment of clinical outcomes in patients with fibromyalgia: Analysis from the UK Medical Cannabis Registry.* Brain Behav 13(7):e3072. PMID: 37199833. DOI: [10.1002/brb3.3072](https://doi.org/10.1002/brb3.3072)
   *306 fibromyalgia patients, 1/3/6/12 months, the same PROM toolkit.*

11. **Li A, Erridge S, Holvey C, Coomber R, Barros D, Bhoskar U, et al.** (2024). *UK Medical Cannabis Registry: a case series analyzing clinical outcomes of medical cannabis therapy for generalized anxiety disorder patients.* Int Clin Psychopharmacol 39(6):350-360. PMID: 38299624. DOI: [10.1097/YIC.0000000000000536](https://doi.org/10.1097/YIC.0000000000000536)
   *120 GAD patients tracked at 12 months; instrument set is GAD-7 + SQS + EQ-5D-5L.*

### 11.4 Non-PubMed but relevant prior art

- **Drug Science Project Twenty21** (Sakal et al., Schlag A) — UK observational medical cannabis study, published in *Drug Science, Policy and Law* (not PubMed-indexed). https://drugscience.org.uk/project-twenty21/
- **Schwabe AL, McGlaughlin ME** (2019). *Genetic tools weed out misconceptions of strain reliability in Cannabis sativa.* J Cannabis Res — supports the strain-name unreliability claim; not PubMed-indexed at time of writing.
- **MyMD / Releaf / Sapphire patient feedback structures** — commercial, closed.

### 11.5 The Phenologue innovation

The Phenologue innovation is not in the rating scales themselves — those are largely drawn from validated instruments listed in §11.1. The innovation is:

1. The **chemotype-first data model** (grounded in Sawler 2015, Hazekamp 2012, Herwig 2024) replacing strain-name marketing labels
2. The **session-level pre/post structure tied to specific batches** (Booth 2020 establishes within-cultivar variability; this implication has not previously been operationalised in patient-facing protocols)
3. The **organoleptic inference bridge** for batches without lab COA (an explicit, versioned mapping from controlled aroma vocabulary to terpene weights, with `inferred` flagging — extending the chemovar literature into the patient-reported domain)
4. The **open, patient-owned, anonymisable-by-design architecture** (CC BY-SA 4.0 methodology, MIT code) — distinct from the closed, clinician-recruited registries (UK MCR / Sapphire)
5. The **treatment of the patient as a scientific collaborator** rather than a passive subject — a posture validated by the longitudinal PROM-driven UK MCR work but operationalised at lower friction

---

## 12. The founder's first dataset

This methodology was developed in parallel with logging the founder's own sessions starting 26 April 2026. The first cultivars assessed are:

- **L.A. S.A.G.E. T26** (IPS Pharma, Macedonia, batch IPS-PHC-LAS T26) — limonene-dominant / pinene-secondary, inferred from organoleptic assessment
- **Karamel Kandy KSV-9** (Kasa Verde, Canada, batch A363041) — caryophyllene-dominant / myrcene-secondary, inferred from organoleptic assessment

Both assessments are documented in full at session-level and serve as the seed dataset for the Phenologue v0.1 reference implementation.

---

*Phenologue is a project of Bloom. Methodology is open under CC BY-SA 4.0. Comments, criticisms, and contributions are welcomed.*

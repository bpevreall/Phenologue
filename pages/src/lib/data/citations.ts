/**
 * Phenologue methodology citations — mirrors `docs/02-phenologue-methodology.md` §11.
 *
 * If a citation is updated in the canonical methodology document, update it here.
 * Do not invent citations or alter PMIDs/DOIs without checking the source doc.
 */

export type CitationGroup = 'pro' | 'chemovar' | 'neighbours' | 'non_pubmed';

export interface Citation {
  group: CitationGroup;
  authors: string;
  year: number;
  title: string;
  journal?: string;
  volume?: string;
  pages?: string;
  pmid?: string;
  /** Full URL — https://doi.org/... — or another canonical link for non-PubMed entries. */
  doi: string;
  /** One-sentence relevance gloss; mirrors the italic note in the methodology doc. */
  note?: string;
}

export const CITATIONS: Citation[] = [
  // ── 11.1 Patient-reported outcome instruments ─────────────────────────────
  // The PRO instruments are referenced as anchor points, not direct lifts.
  // We list them as a group rather than as individual peer-reviewed citations
  // because the methodology document treats them collectively.
  {
    group: 'pro',
    authors: 'WHO',
    year: 1996,
    title: 'WHO Quality of Life-BREF (WHOQOL-BREF)',
    journal: 'World Health Organization',
    doi: 'https://www.who.int/tools/whoqol/whoqol-bref',
    note: 'General health PROs. Anchor for the 0–10 VAS framing.',
  },
  {
    group: 'pro',
    authors: 'Kessler RC, Adler L, Ames M, et al.',
    year: 2005,
    title: 'The World Health Organization Adult ADHD Self-Report Scale (ASRS-v1.1)',
    journal: 'Psychological Medicine',
    volume: '35(2)',
    pages: '245-256',
    pmid: '15841682',
    doi: 'https://doi.org/10.1017/s0033291704002892',
    note: 'ASRS-v1.1 — anchor for ADHD self-report items.',
  },
  {
    group: 'pro',
    authors: 'Cleeland CS, Ryan KM',
    year: 1994,
    title: 'Pain assessment: global use of the Brief Pain Inventory',
    journal: 'Annals, Academy of Medicine, Singapore',
    volume: '23(2)',
    pages: '129-138',
    pmid: '8080219',
    doi: 'https://pubmed.ncbi.nlm.nih.gov/8080219/',
    note: 'Brief Pain Inventory — anchor for pain items.',
  },
  {
    group: 'pro',
    authors: 'Spitzer RL, Kroenke K, Williams JBW, Löwe B',
    year: 2006,
    title: 'A brief measure for assessing generalized anxiety disorder: the GAD-7',
    journal: 'Archives of Internal Medicine',
    volume: '166(10)',
    pages: '1092-1097',
    pmid: '16717171',
    doi: 'https://doi.org/10.1001/archinte.166.10.1092',
    note: 'GAD-7 — anchor for anxiety items; the primary anxiety PROM in the UK Medical Cannabis Registry.',
  },
  {
    group: 'pro',
    authors: 'Buysse DJ, Reynolds CF 3rd, Monk TH, Berman SR, Kupfer DJ',
    year: 1989,
    title: 'The Pittsburgh Sleep Quality Index: a new instrument for psychiatric practice and research',
    journal: 'Psychiatry Research',
    volume: '28(2)',
    pages: '193-213',
    pmid: '2748771',
    doi: 'https://doi.org/10.1016/0165-1781(89)90047-4',
    note: 'Pittsburgh Sleep Quality Index — anchor for sleep items.',
  },
  {
    group: 'pro',
    authors: 'Herdman M, Gudex C, Lloyd A, et al.',
    year: 2011,
    title: 'Development and preliminary testing of the new five-level version of EQ-5D (EQ-5D-5L)',
    journal: 'Quality of Life Research',
    volume: '20(10)',
    pages: '1727-1736',
    pmid: '21479777',
    doi: 'https://doi.org/10.1007/s11136-011-9903-x',
    note: 'EQ-5D-5L — the standard NICE-recognised UK HRQoL instrument.',
  },
  {
    group: 'pro',
    authors: 'Snyder E, Cai B, DeMuro C, Morrison MF, Ball W',
    year: 2018,
    title: 'A new single-item Sleep Quality Scale: results of psychometric evaluation in patients with chronic primary insomnia and depression',
    journal: 'Journal of Clinical Sleep Medicine',
    volume: '14(11)',
    pages: '1849-1857',
    pmid: '30373682',
    doi: 'https://doi.org/10.5664/jcsm.7478',
    note: 'Single-Item Sleep Quality Scale (SQS) — as used by UK MCR.',
  },

  // ── 11.2 Cannabis chemovar science (peer-reviewed, PubMed-indexed) ────────
  {
    group: 'chemovar',
    authors: 'Sawler J, Stout JM, Gardner KM, Hudson D, Vidmar J, Butler L, Page JE, Myles S',
    year: 2015,
    title: 'The Genetic Structure of Marijuana and Hemp',
    journal: 'PLoS ONE',
    volume: '10(8)',
    pages: 'e0133292',
    pmid: '26308334',
    doi: 'https://doi.org/10.1371/journal.pone.0133292',
    note: 'Direct evidence that "marijuana strain names often do not reflect a meaningful genetic identity" — the foundational reference for moving away from strain-name marketing labels.',
  },
  {
    group: 'chemovar',
    authors: 'Hazekamp A, Fischedick JT',
    year: 2012,
    title: 'Cannabis — from cultivar to chemovar',
    journal: 'Drug Testing and Analysis',
    volume: '4(7-8)',
    pages: '660-667',
    pmid: '22362625',
    doi: 'https://doi.org/10.1002/dta.407',
    note: 'The canonical chemovar paper. Establishes PCA-based chemovar classification across 700+ cultivars.',
  },
  {
    group: 'chemovar',
    authors: 'Russo EB',
    year: 2011,
    title: 'Taming THC: potential cannabis synergy and phytocannabinoid-terpenoid entourage effects',
    journal: 'British Journal of Pharmacology',
    volume: '163(7)',
    pages: '1344-1364',
    pmid: '21749363',
    doi: 'https://doi.org/10.1111/j.1476-5381.2011.01238.x',
    note: 'Foundational reference for the entourage effect — why terpenes matter, not just cannabinoids.',
  },
  {
    group: 'chemovar',
    authors: 'Booth JK, Page JE, Bohlmann J',
    year: 2017,
    title: 'Terpene synthases from Cannabis sativa',
    journal: 'PLoS ONE',
    volume: '12(3)',
    pages: 'e0173911',
    pmid: '28355238',
    doi: 'https://doi.org/10.1371/journal.pone.0173911',
    note: 'Identifies the 9 terpene synthases responsible for myrcene, ocimene, limonene, α-pinene, β-caryophyllene and α-humulene biosynthesis. Foundational chemistry for the chemotype model.',
  },
  {
    group: 'chemovar',
    authors: 'Booth JK, Yuen MMS, Jancsik S, Madilao LL, Page JE, Bohlmann J',
    year: 2020,
    title: 'Terpene Synthases and Terpene Variation in Cannabis sativa',
    journal: 'Plant Physiology',
    volume: '184(1)',
    pages: '130-147',
    pmid: '32591428',
    doi: 'https://doi.org/10.1104/pp.20.00593',
    note: 'Documents large terpene variation both within and between sets of plants labelled as the same cultivar — the empirical basis for batch-level fidelity rather than cultivar-level pooling.',
  },
  {
    group: 'chemovar',
    authors: 'Cerrato A, Citti C, Cannazza G, Capriotti AL, Cavaliere C, Grassi G, Marini F, Montone CM, Paris R, Piovesana S, Laganà A',
    year: 2021,
    title: 'Phytocannabinomics: Untargeted metabolomics as a tool for cannabis chemovar differentiation',
    journal: 'Talanta',
    volume: '230',
    pages: '122313',
    pmid: '33934778',
    doi: 'https://doi.org/10.1016/j.talanta.2021.122313',
    note: 'Demonstrates that traditional 5-chemotype classification (THC/CBD/CBG ratios) is insufficient and that minor phytocannabinoids define meaningful subgroups.',
  },
  {
    group: 'chemovar',
    authors: 'Oswald IWH, Ojeda MA, Pobanz RJ, Koby KA, Buchanan AJ, Del Rosso J, Guzman MA, Martin TJ',
    year: 2021,
    title: 'Identification of a New Family of Prenylated Volatile Sulfur Compounds in Cannabis Revealed by Comprehensive Two-Dimensional Gas Chromatography',
    journal: 'ACS Omega',
    volume: '6(47)',
    pages: '31667-31676',
    pmid: '34869990',
    doi: 'https://doi.org/10.1021/acsomega.1c04196',
    note: 'Establishes that the "skunk" cannabis aroma is caused by volatile sulfur compounds (VSCs), specifically 3-methyl-2-butene-1-thiol — not terpenes. Reason the terpene_descriptor_map does NOT map "skunk" to a terpene; it is flagged as unmapped pending VSC-class support in v0.2.',
  },
  {
    group: 'chemovar',
    authors: 'Herwig N, Utgenannt S, Nickl F, Möbius P, Nowak L, Schulz O, Fischer M',
    year: 2024,
    title: 'Classification of Cannabis Strains Based on their Chemical Fingerprint — A Broad Analysis of Chemovars in the German Market',
    journal: 'Cannabis and Cannabinoid Research',
    volume: '10(3)',
    pages: '409-419',
    pmid: '39137353',
    doi: 'https://doi.org/10.1089/can.2024.0127',
    note: '140 medicinal cannabis flowers from the German market analysed by GC-MS. Establishes a 6-cluster terpene-profile classification with no statistical correlation between terpene profile and indica/sativa/hybrid genetic label. The most directly relevant peer-reviewed precedent for Phenologue\'s chemotype dimensions.',
  },

  // ── 11.3 Methodological neighbours — UK observational cannabis cohorts ────
  {
    group: 'neighbours',
    authors: 'Rifkin-Zybutz R, Erridge S, Holvey C, Coomber R, Gaffney J, Lawn W, et al.',
    year: 2023,
    title: 'Clinical outcome data of anxiety patients treated with cannabis-based medicinal products in the United Kingdom: a cohort study from the UK Medical Cannabis Registry',
    journal: 'Psychopharmacology (Berl)',
    volume: '240(8)',
    pages: '1735-1745',
    pmid: '37314478',
    doi: 'https://doi.org/10.1007/s00213-023-06399-3',
    note: '302 GAD patients tracked with GAD-7, SQS, EQ-5D-5L at 1, 3, 6 months. Imperial College London / Sapphire Medical Clinics.',
  },
  {
    group: 'neighbours',
    authors: 'Wang C, Erridge S, Holvey C, Coomber R, Usmani A, Sajad M, et al.',
    year: 2023,
    title: 'Assessment of clinical outcomes in patients with fibromyalgia: Analysis from the UK Medical Cannabis Registry',
    journal: 'Brain and Behavior',
    volume: '13(7)',
    pages: 'e3072',
    pmid: '37199833',
    doi: 'https://doi.org/10.1002/brb3.3072',
    note: '306 fibromyalgia patients, 1/3/6/12 months, the same PROM toolkit.',
  },
  {
    group: 'neighbours',
    authors: 'Li A, Erridge S, Holvey C, Coomber R, Barros D, Bhoskar U, et al.',
    year: 2024,
    title: 'UK Medical Cannabis Registry: a case series analyzing clinical outcomes of medical cannabis therapy for generalized anxiety disorder patients',
    journal: 'International Clinical Psychopharmacology',
    volume: '39(6)',
    pages: '350-360',
    pmid: '38299624',
    doi: 'https://doi.org/10.1097/YIC.0000000000000536',
    note: '120 GAD patients tracked at 12 months; instrument set is GAD-7 + SQS + EQ-5D-5L.',
  },

  // ── 11.4 Non-PubMed but relevant prior art ────────────────────────────────
  {
    group: 'non_pubmed',
    authors: 'Sakal et al., Schlag A',
    year: 2022,
    title: 'Drug Science Project Twenty21',
    journal: 'Drug Science, Policy and Law',
    doi: 'https://drugscience.org.uk/project-twenty21/',
    note: 'UK observational medical cannabis study; not PubMed-indexed.',
  },
  {
    group: 'non_pubmed',
    authors: 'Schwabe AL, McGlaughlin ME',
    year: 2019,
    title: 'Genetic tools weed out misconceptions of strain reliability in Cannabis sativa',
    journal: 'Journal of Cannabis Research',
    doi: 'https://doi.org/10.1186/s42238-019-0001-1',
    note: 'Supports the strain-name unreliability claim; not PubMed-indexed at time of writing.',
  },
  {
    group: 'non_pubmed',
    authors: 'MyMD / Releaf / Sapphire',
    year: 2024,
    title: 'Patient feedback structures (commercial, closed)',
    doi: 'https://sapphireclinics.com/',
    note: 'Commercial, closed patient feedback platforms — referenced as the closed-source counterpoint to Phenologue.',
  },
];

export const GROUP_LABELS: Record<CitationGroup, string> = {
  pro: '11.1 Patient-reported outcome instruments',
  chemovar: '11.2 Cannabis chemovar science (peer-reviewed, PubMed-indexed)',
  neighbours: '11.3 Methodological neighbours — UK observational cannabis cohorts',
  non_pubmed: '11.4 Non-PubMed but relevant prior art',
};

export const GROUP_ORDER: CitationGroup[] = ['pro', 'chemovar', 'neighbours', 'non_pubmed'];

-- Phenologue methodology v0.1 — terpene descriptor map correction
-- Applied: 2026-05-02
--
-- Removes three descriptor → terpene mappings that are not supported by
-- peer-reviewed evidence:
--
--   - 'skunk'  → caryophyllene  (REMOVED)
--     The skunk-family aroma was characterised by Oswald et al. 2021
--     (ACS Omega, doi:10.1021/acsomega.1c04196, PMID 34869990) as caused
--     by volatile sulfur compounds (VSCs), specifically 3-methyl-2-butene-
--     1-thiol — NOT terpenes. The descriptor remains in the controlled
--     vocabulary but is now unmapped pending VSC-class support in
--     methodology v0.2.
--
--   - 'cheese' → caryophyllene  (REMOVED)
--     Cheese-family cannabis aromas (UK Cheese, Blue Cheese) appear to be
--     dominated by short-chain fatty acid volatiles, not terpenes. No
--     peer-reviewed evidence supports a terpene mapping. Unmapped pending
--     v0.2 non-terpene volatile support.
--
--   - 'diesel' → caryophyllene  (REMOVED)
--     "Diesel" is widely associated with thiols + terpinolene + ocimene
--     mixtures in different chemovars; no clean single-terpene mapping is
--     supported by published evidence. Unmapped pending v0.2.
--
-- Records using these descriptors as input to inferTerpeneProfile() will
-- continue to be parsed as known descriptors and returned in the
-- `unmapped_descriptors` field of InferredProfile, which is the correct
-- semantics. The descriptors stay in the patient-facing vocabulary; they
-- just no longer falsely contribute to a terpene weight.

DELETE FROM terpene_descriptor_map WHERE descriptor_code = 'skunk';
DELETE FROM terpene_descriptor_map WHERE descriptor_code = 'cheese';
DELETE FROM terpene_descriptor_map WHERE descriptor_code = 'diesel';

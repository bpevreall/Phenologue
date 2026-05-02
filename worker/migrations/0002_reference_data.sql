-- Phenologue Reference Data
-- Rating scales and terpene descriptor mappings
-- Versioned with methodology v0.1

-- =============================================================
-- Core rating scales
-- =============================================================

INSERT INTO rating_scale (code, label, anchor_0, anchor_5, anchor_10, category, display_order) VALUES
  ('focus',           'Focus',           'Cannot focus at all',  'Can focus with effort', 'Effortless deep focus',  'core', 10),
  ('anxiety',         'Anxiety',         'None',                 'Moderate',              'Overwhelming',           'core', 20),
  ('pain',            'Pain',            'None',                 'Moderate',              'Worst imaginable',       'core', 30),
  ('mood',            'Mood',            'Worst possible',       'Neutral',               'Best possible',          'core', 40),
  ('energy',          'Energy',          'Exhausted',            'Normal',                'High energy',            'core', 50),
  ('appetite',        'Appetite',        'None',                 'Normal',                'Strong hunger',          'core', 60),
  ('sleep_readiness', 'Sleep readiness', 'Wide awake',           'Could rest if needed',  'Falling asleep',         'core', 70);

-- =============================================================
-- ADHD-specific scales
-- =============================================================

INSERT INTO rating_scale (code, label, anchor_0, anchor_5, anchor_10, category, condition_code, display_order) VALUES
  ('task_initiation', 'Task initiation',  'Cannot start tasks',     'Some difficulty starting', 'Start tasks immediately', 'condition', 'adhd', 110),
  ('working_memory',  'Working memory',   'Cannot hold thoughts',   'Average',                  'Crystal clear',           'condition', 'adhd', 120),
  ('impulse_control', 'Impulse control',  'No control',             'Some control',             'Full control',            'condition', 'adhd', 130),
  ('hyperfocus',      'Hyperfocus tendency','None','Moderate','Locked in','condition', 'adhd', 140),
  ('time_perception', 'Time perception accuracy', 'Time disorientation', 'Some sense of time', 'Accurate time sense', 'condition', 'adhd', 150);

-- =============================================================
-- Pain-specific scales
-- =============================================================

INSERT INTO rating_scale (code, label, anchor_0, anchor_5, anchor_10, category, condition_code, display_order) VALUES
  ('pain_localised',     'Pain localisation distress','Not bothered','Moderate distress','Severe distress','condition','chronic_pain',210),
  ('pain_movement',      'Movement-induced pain',     'No movement pain','Moderate','Cannot move','condition','chronic_pain',220),
  ('pain_interference',  'Pain interference',         'No interference','Some interference','Total interference','condition','chronic_pain',230);

-- =============================================================
-- Anxiety-specific scales
-- =============================================================

INSERT INTO rating_scale (code, label, anchor_0, anchor_5, anchor_10, category, condition_code, display_order) VALUES
  ('anxiety_anticipatory','Anticipatory anxiety',   'None','Moderate','Overwhelming','condition','gad',310),
  ('anxiety_social',     'Social discomfort',       'None','Moderate','Severe','condition','gad',320),
  ('anxiety_physical',   'Physical anxiety symptoms','None','Moderate','Severe','condition','gad',330);

-- =============================================================
-- Sleep-specific scales (next-day phase)
-- =============================================================

INSERT INTO rating_scale (code, label, anchor_0, anchor_5, anchor_10, category, condition_code, display_order) VALUES
  ('sleep_onset_speed',  'Sleep onset speed',       'Hours to sleep','30 minutes','Asleep immediately','condition','sleep',410),
  ('sleep_continuity',   'Sleep continuity',        'Constant waking','A few wakeups','Slept through','condition','sleep',420),
  ('morning_grog',       'Morning grogginess',      'Severe','Moderate','None / refreshed','condition','sleep',430);

-- =============================================================
-- Effect quality scales (post-session only)
-- =============================================================

INSERT INTO rating_scale (code, label, anchor_0, anchor_5, anchor_10, category, display_order) VALUES
  ('effect_intensity',   'Effect intensity',        'No effect','Moderate','Overwhelming','effect_quality',510),
  ('effect_pleasantness','Effect pleasantness',     'Unpleasant','Neutral','Very pleasant','effect_quality',520),
  ('functional_capacity','Functional capacity',     'Incapacitated','Reduced','Fully functional','effect_quality',530),
  ('cognitive_clarity',  'Cognitive clarity',       'Foggy','Average','Sharp','effect_quality',540),
  ('body_sensation',     'Body sensation',          'Heavy / sedated','Neutral','Energised / light','effect_quality',550);

-- =============================================================
-- Terpene descriptor map (organoleptic → inferred terpene)
-- Weights are inference confidence (1.0 = strong, 0.5 = weak)
-- =============================================================

INSERT INTO terpene_descriptor_map (descriptor_code, family, primary_terpene, weight) VALUES
  -- Citrus family → limonene
  ('lemon',         'citrus', 'limonene',     1.0),
  ('lime',          'citrus', 'limonene',     0.9),
  ('orange',        'citrus', 'limonene',     0.8),
  ('grapefruit',    'citrus', 'limonene',     0.9),
  ('sour_citrus',   'citrus', 'limonene',     1.0),

  -- Pine/forest → pinene
  ('pine',          'pine',   'pinene',       1.0),
  ('fir',           'pine',   'pinene',       0.9),
  ('eucalyptus',    'pine',   'pinene',       0.7),
  ('fresh_herb',    'pine',   'pinene',       0.7),
  ('sage',          'pine',   'pinene',       0.6),
  ('rosemary',      'pine',   'pinene',       0.7),
  ('forest',        'pine',   'pinene',       0.9),
  ('green',         'pine',   'pinene',       0.7),

  -- Floral → linalool
  ('lavender',      'floral', 'linalool',     1.0),
  ('rose',          'floral', 'linalool',     0.7),
  ('jasmine',       'floral', 'linalool',     0.7),
  ('violet',        'floral', 'linalool',     0.6),
  ('floral',        'floral', 'linalool',     0.8),

  -- Spice/gas/dough → caryophyllene
  -- NOTE: 'diesel' and 'skunk' are NOT mapped to a terpene. The "skunk" cannabis
  -- aroma was characterised by Oswald et al. 2021 (ACS Omega, doi:10.1021/acsomega.1c04196,
  -- PMID 34869990) as caused by volatile sulfur compounds (VSCs), specifically
  -- 3-methyl-2-butene-1-thiol — not terpenes. "Diesel" is similarly poorly mapped
  -- to any single terpene in the published literature. Both are captured as
  -- descriptors in the controlled vocabulary but are flagged as unmapped pending
  -- VSC-class support in methodology v0.2.
  ('pepper',        'spice',  'caryophyllene',1.0),
  ('clove',         'spice',  'caryophyllene',0.9),
  ('chemical',      'spice',  'caryophyllene',0.6),
  ('dough',         'dough',  'caryophyllene',0.7),
  ('cookie_dough',  'dough',  'caryophyllene',0.8),
  ('yeast',         'dough',  'caryophyllene',0.6),
  ('malt',          'dough',  'caryophyllene',0.6),

  -- Tropical/fruit → myrcene
  ('tropical',      'fruit',  'myrcene',      0.8),
  ('mango',         'fruit',  'myrcene',      0.9),
  ('berry',         'fruit',  'myrcene',      0.5),
  ('stone_fruit',   'fruit',  'myrcene',      0.6),
  ('apple',         'fruit',  'myrcene',      0.5),
  ('melon',         'fruit',  'myrcene',      0.5),

  -- Earthy → myrcene + humulene
  ('soil',          'earth',  'myrcene',      0.6),
  ('moss',          'earth',  'myrcene',      0.5),
  ('mushroom',      'earth',  'humulene',     0.6),
  ('damp_wood',     'earth',  'humulene',     0.5),

  -- Sharp herbal → terpinolene
  ('sharp_herbal',  'herbal', 'terpinolene',  1.0),
  ('terpene_solvent','herbal','terpinolene',  0.9),
  ('hops',          'herbal', 'humulene',     0.9),

  -- Sweet → limonene secondary or specific
  ('vanilla',       'sweet',  'linalool',     0.5),
  ('candy',         'sweet',  'limonene',     0.6),
  ('honey',         'sweet',  'linalool',     0.4),
  ('caramel',       'sweet',  'caryophyllene',0.4),
  ('butterscotch',  'sweet',  'caryophyllene',0.4),

  -- Misc
  -- NOTE: 'cheese' is NOT mapped to a terpene. Cheese-family cannabis aromas
  -- (UK Cheese, Blue Cheese) are dominated by short-chain fatty acid volatiles
  -- (butyric acid family), not terpenes — published terpene-specific evidence is
  -- absent. Captured as a descriptor but unmapped pending v0.2 non-terpene
  -- volatile support.
  ('mint',          'mint',   'pinene',       0.5),
  ('menthol',       'mint',   'pinene',       0.4),
  ('coffee',        'other',  'caryophyllene',0.4),
  ('chocolate',     'other',  'caryophyllene',0.4);

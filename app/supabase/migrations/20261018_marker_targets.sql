-- Thumbprint targets — the second reference point next to every lab range.
--
-- Adam's Oct 14 developer build spec: each marker on the Biology screen shows the
-- lab range exactly as the member's own report printed it, and beside it a
-- Thumbprint target, personalised by sex and age where a row says so. Targets are
-- data, not code, so the medical director can approve or revise them without a
-- release.
--
-- Versioned: a revision is a NEW row with a higher `version`, never an UPDATE, so
-- what a member was shown on a given day stays on file. The app reads the highest
-- version per marker_id.
--
-- Bound semantics (app/src/lib/scorecard.js reads them the same way):
--   lower_better   value must be under target_high          ("Under 100")
--   higher_better  value must be target_low or above        ("40 or above")
--   range          target_low <= value <= target_high
--
-- applies_to: {"sex": "any"|"male"|"female", "age_min": int, "age_max": int,
-- "condition": text}. The most specific matching row wins; a sex- or age-specific
-- row never applies when the member's sex or age is unknown.
--
-- Every seeded row is a PLACEHOLDER: approved_by = 'pending' until Dr. Locker
-- signs off. Values are conservative and guideline-based; where no guideline sets
-- a target the row says so and is labelled Emerging. marker_id follows the
-- escalation matrix (app/agents/library/escalation.json) upper-cased, with LDL_C
-- and HDL_C as the spec names them.
--
-- The same seed is bundled in app/src/lib/markerTargets.js so the screen works
-- before this migration is applied and offline; agents/test/scorecard.test.mjs
-- checks the two agree.
--
-- Reference data, not member data: readable by any signed-in user, writable by
-- nobody through the API (changes go in as migrations or from the SQL editor).
create table if not exists ghai.marker_targets (
  id              uuid primary key default gen_random_uuid(),
  marker_id       text not null,
  unit            text not null,
  applies_to      jsonb not null default '{"sex": "any"}'::jsonb,
  target_low      numeric,
  target_high     numeric,
  direction       text not null check (direction in ('lower_better', 'higher_better', 'range')),
  rationale       text not null,
  evidence_level  text not null check (evidence_level in ('Strong', 'Moderate', 'Emerging')),
  source          text not null,
  approved_by     text not null default 'pending',
  approved_date   date,
  version         int not null default 1,
  created_at      timestamptz not null default now(),
  check (target_low is not null or target_high is not null),
  unique (marker_id, unit, applies_to, version)
);

comment on table ghai.marker_targets is
  'Thumbprint targets shown next to the lab range, versioned per marker. Reference data: read-only to signed-in users; approved_by = pending until medical-director sign-off.';

create index if not exists marker_targets_marker_version_idx
  on ghai.marker_targets (marker_id, version desc);

alter table ghai.marker_targets enable row level security;

revoke all on ghai.marker_targets from anon, authenticated;
grant select on ghai.marker_targets to authenticated;

create policy marker_targets_read_only on ghai.marker_targets
  for select
  to authenticated
  using (true);

insert into ghai.marker_targets
  (marker_id, unit, applies_to, target_low, target_high, direction,
   rationale,
   evidence_level, source, approved_by, approved_date, version)
values
  ('LDL_C', 'mg/dL', '{"sex":"any"}'::jsonb, null, 100, 'lower_better',
   'LDL carries cholesterol into artery walls, and lower LDL over a lifetime means less plaque. Under 100 mg/dL is the level guidelines call optimal for most adults.',
   'Strong', '2018 AHA/ACC Cholesterol Guideline; NCEP ATP III', 'pending', null, 1),
  ('HDL_C', 'mg/dL', '{"sex":"male"}'::jsonb, 40, null, 'higher_better',
   'Low HDL marks higher heart risk, though raising HDL with medication has not been shown to lower that risk. 40 mg/dL is the guideline cut-off for men.',
   'Moderate', 'NCEP ATP III; AHA/NHLBI metabolic syndrome criteria', 'pending', null, 1),
  ('HDL_C', 'mg/dL', '{"sex":"female"}'::jsonb, 50, null, 'higher_better',
   'Low HDL marks higher heart risk, though raising HDL with medication has not been shown to lower that risk. 50 mg/dL is the guideline cut-off for women.',
   'Moderate', 'NCEP ATP III; AHA/NHLBI metabolic syndrome criteria', 'pending', null, 1),
  ('TOTAL_CHOLESTEROL', 'mg/dL', '{"sex":"any"}'::jsonb, null, 200, 'lower_better',
   'Total cholesterol adds the helpful and harmful fractions together, so LDL and ApoB say more. Under 200 mg/dL is the long-standing desirable level.',
   'Moderate', 'NCEP ATP III', 'pending', null, 1),
  ('TRIGLYCERIDES', 'mg/dL', '{"sex":"any"}'::jsonb, null, 150, 'lower_better',
   'Fasting triglycerides above 150 mg/dL travel with insulin resistance and higher heart risk. Diet, alcohol and activity move them quickly.',
   'Moderate', '2018 AHA/ACC Cholesterol Guideline; NCEP ATP III', 'pending', null, 1),
  ('APOB', 'mg/dL', '{"sex":"any"}'::jsonb, null, 90, 'lower_better',
   'ApoB counts the particles that cause plaque, one per particle, so it can show risk that LDL misses. Under 90 mg/dL is a common primary-prevention goal; 130 or above is a recognised risk-enhancing level.',
   'Moderate', 'National Lipid Association 2024 ApoB statement; 2018 AHA/ACC Cholesterol Guideline', 'pending', null, 1),
  ('LPA', 'nmol/L', '{"sex":"any"}'::jsonb, null, 125, 'lower_better',
   'Lp(a) is set mostly by your genes and changes little with lifestyle, so one measurement is usually enough. At 125 nmol/L or above it adds to heart risk, which makes the other lipids more important to keep low.',
   'Moderate', '2022 EAS Lp(a) consensus statement; NLA 2019 Lp(a) statement', 'pending', null, 1),
  ('LPA', 'mg/dL', '{"sex":"any"}'::jsonb, null, 50, 'lower_better',
   'Lp(a) is set mostly by your genes and changes little with lifestyle, so one measurement is usually enough. At 50 mg/dL or above it adds to heart risk, which makes the other lipids more important to keep low.',
   'Moderate', '2022 EAS Lp(a) consensus statement; NLA 2019 Lp(a) statement', 'pending', null, 1),
  ('FASTING_GLUCOSE', 'mg/dL', '{"sex":"any"}'::jsonb, 70, 99, 'range',
   'Fasting glucose of 100 mg/dL or above is the prediabetes range, and below 70 is low. 70–99 is the normal fasting range.',
   'Strong', 'ADA Standards of Care in Diabetes 2025', 'pending', null, 1),
  ('HBA1C', '%', '{"sex":"any"}'::jsonb, null, 5.7, 'lower_better',
   'A1c reflects average blood sugar over about three months. 5.7% or above is the prediabetes range.',
   'Strong', 'ADA Standards of Care in Diabetes 2025', 'pending', null, 1),
  ('FASTING_INSULIN', 'uIU/mL', '{"sex":"any"}'::jsonb, null, 10, 'lower_better',
   'Fasting insulin can rise years before glucose does. No guideline sets a target; under 10 uIU/mL is a cut-off used in research on insulin resistance.',
   'Emerging', 'No guideline target; research cut-offs for insulin resistance (HOMA-IR studies)', 'pending', null, 1),
  ('HS_CRP', 'mg/L', '{"sex":"any"}'::jsonb, null, 2, 'lower_better',
   'hs-CRP measures low-grade inflammation that is linked to heart risk. 2.0 mg/L or above is a recognised risk-enhancing level; a recent cold or injury can raise it for a few weeks.',
   'Moderate', '2018 AHA/ACC Cholesterol Guideline; AHA/CDC 2003 scientific statement', 'pending', null, 1),
  ('WBC', 'x10^9/L', '{"sex":"any"}'::jsonb, 4, 8, 'range',
   'White cells fight infection, so a recent illness moves this number. Large studies link counts toward the top of the lab range to higher heart risk; no guideline sets this narrower target.',
   'Emerging', 'No guideline target; cohort studies of WBC and cardiovascular risk', 'pending', null, 1),
  ('ALBUMIN', 'g/dL', '{"sex":"any"}'::jsonb, 4, 5, 'range',
   'Albumin is made by the liver and reflects nutrition and liver health. Values in the low end of the lab range are linked to poorer outcomes in large studies.',
   'Moderate', 'Adult reference intervals; cohort studies of serum albumin', 'pending', null, 1),
  ('CREATININE', 'mg/dL', '{"sex":"male"}'::jsonb, 0.7, 1.2, 'range',
   'Creatinine is a muscle by-product the kidneys clear, so read it alongside eGFR. More muscle means a higher number without any kidney problem.',
   'Moderate', 'Adult reference intervals; KDIGO 2024 CKD Guideline', 'pending', null, 1),
  ('CREATININE', 'mg/dL', '{"sex":"female"}'::jsonb, 0.5, 1, 'range',
   'Creatinine is a muscle by-product the kidneys clear, so read it alongside eGFR. More muscle means a higher number without any kidney problem.',
   'Moderate', 'Adult reference intervals; KDIGO 2024 CKD Guideline', 'pending', null, 1),
  ('EGFR', 'mL/min/1.73m2', '{"sex":"any"}'::jsonb, 60, null, 'higher_better',
   'eGFR estimates how well the kidneys filter. Below 60 for three months or more defines chronic kidney disease; it drifts down slowly with age, so the trend matters as much as the number.',
   'Strong', 'KDIGO 2024 CKD Guideline', 'pending', null, 1),
  ('ALT', 'U/L', '{"sex":"male"}'::jsonb, null, 33, 'lower_better',
   'ALT is a liver enzyme that rises when liver cells are stressed, most often by fat in the liver. The guideline''s healthy upper limit for men is 33 U/L, lower than many lab ranges.',
   'Moderate', 'ACG Clinical Guideline: Evaluation of Abnormal Liver Chemistries (2017)', 'pending', null, 1),
  ('ALT', 'U/L', '{"sex":"female"}'::jsonb, null, 25, 'lower_better',
   'ALT is a liver enzyme that rises when liver cells are stressed, most often by fat in the liver. The guideline''s healthy upper limit for women is 25 U/L, lower than many lab ranges.',
   'Moderate', 'ACG Clinical Guideline: Evaluation of Abnormal Liver Chemistries (2017)', 'pending', null, 1),
  ('AST', 'U/L', '{"sex":"any"}'::jsonb, null, 35, 'lower_better',
   'AST is found in the liver and in muscle, so a hard workout can raise it for a few days. Read it together with ALT.',
   'Moderate', 'Adult reference intervals; ACG Clinical Guideline (2017)', 'pending', null, 1),
  ('ALP', 'U/L', '{"sex":"any"}'::jsonb, 40, 120, 'range',
   'Alkaline phosphatase comes from the liver and bone. This target matches the usual adult range; values outside it are worth a look alongside the other liver markers.',
   'Moderate', 'Adult reference intervals; ACG Clinical Guideline (2017)', 'pending', null, 1),
  ('HEMOGLOBIN', 'g/dL', '{"sex":"male"}'::jsonb, 13, 17, 'range',
   'Hemoglobin carries oxygen in the blood. Below 13 g/dL in men is the WHO definition of anemia.',
   'Strong', 'WHO 2024 guideline on haemoglobin cut-offs for anaemia', 'pending', null, 1),
  ('HEMOGLOBIN', 'g/dL', '{"sex":"female"}'::jsonb, 12, 15.5, 'range',
   'Hemoglobin carries oxygen in the blood. Below 12 g/dL in non-pregnant women is the WHO definition of anemia.',
   'Strong', 'WHO 2024 guideline on haemoglobin cut-offs for anaemia', 'pending', null, 1),
  ('RDW', '%', '{"sex":"any"}'::jsonb, null, 13.5, 'lower_better',
   'RDW measures how much your red cells vary in size; it widens early in iron or B12 shortage. Large studies link higher RDW, even inside the lab range, to higher overall risk; no guideline sets this target.',
   'Emerging', 'No guideline target; cohort studies of RDW and mortality', 'pending', null, 1),
  ('MCV', 'fL', '{"sex":"any"}'::jsonb, 80, 100, 'range',
   'MCV is the average size of your red cells. Small cells point toward iron shortage and large cells toward B12 or folate shortage.',
   'Strong', 'Standard haematology definitions of microcytosis and macrocytosis', 'pending', null, 1),
  ('VITAMIN_D_25OH', 'ng/mL', '{"sex":"any"}'::jsonb, 20, 50, 'range',
   'The 2024 Endocrine Society guideline advises against routine vitamin D testing, and against aiming for a particular level, in healthy adults under 75. If you have been tested, 20–50 ng/mL is the range the National Academy of Medicine considers adequate and safe.',
   'Emerging', 'Endocrine Society 2024 Clinical Practice Guideline; National Academy of Medicine (IOM) 2011', 'pending', null, 1),
  ('VITAMIN_D_25OH', 'ng/mL', '{"sex":"any","age_min":75}'::jsonb, 20, 50, 'range',
   'For adults 75 and over, the 2024 Endocrine Society guideline suggests a daily vitamin D supplement but still advises against routine testing or aiming for a particular level. 20–50 ng/mL is the range the National Academy of Medicine considers adequate and safe.',
   'Emerging', 'Endocrine Society 2024 Clinical Practice Guideline; National Academy of Medicine (IOM) 2011', 'pending', null, 1),
  ('FERRITIN', 'ng/mL', '{"sex":"male"}'::jsonb, 30, 200, 'range',
   'Ferritin reflects your iron stores. Below 30 ng/mL usually means low iron, and above 200 in a healthy man can point to iron overload; inflammation raises it too.',
   'Moderate', 'WHO 2020 guideline on ferritin to assess iron status', 'pending', null, 1),
  ('FERRITIN', 'ng/mL', '{"sex":"female"}'::jsonb, 30, 150, 'range',
   'Ferritin reflects your iron stores. Below 30 ng/mL usually means low iron, and above 150 in a healthy woman can point to iron overload; inflammation raises it too.',
   'Moderate', 'WHO 2020 guideline on ferritin to assess iron status', 'pending', null, 1),
  ('B12', 'pg/mL', '{"sex":"any"}'::jsonb, 300, 900, 'range',
   'B12 below 200 pg/mL is deficient, and 200–300 is a grey zone where a follow-up test (MMA) can confirm a shortage. Metformin and acid-reducing medicines can lower it.',
   'Moderate', 'BSH 2014 guideline on cobalamin and folate disorders; NIH Office of Dietary Supplements', 'pending', null, 1),
  ('TSH', 'mIU/L', '{"sex":"any"}'::jsonb, 0.45, 4.5, 'range',
   'TSH is the brain''s signal to the thyroid: high suggests an underactive thyroid, low an overactive one. This target matches the usual adult reference range.',
   'Moderate', 'ATA/AACE 2012 Hypothyroidism Guideline; NHANES III reference population', 'pending', null, 1),
  ('TSH', 'mIU/L', '{"sex":"any","age_min":70}'::jsonb, 0.45, 6, 'range',
   'TSH naturally drifts up with age, so a slightly higher value is common and usually healthy after 70. This wider target reflects that.',
   'Moderate', 'ATA/AACE 2012 Hypothyroidism Guideline (age-specific TSH limits)', 'pending', null, 1),
  ('FREE_T4', 'ng/dL', '{"sex":"any"}'::jsonb, 0.8, 1.8, 'range',
   'Free T4 is the main hormone the thyroid releases. Read it with TSH: the pair says more than either number alone.',
   'Moderate', 'ATA/AACE 2012 Hypothyroidism Guideline; adult reference intervals', 'pending', null, 1)
on conflict (marker_id, unit, applies_to, version) do nothing;

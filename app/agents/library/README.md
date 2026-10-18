# Knowledge library

The passages the agents search and cite as (per "Title"). **All 179 of 179 passages are awaiting medical-director approval** (`approved_by: pending`). Agents may read them during development, and each one is labelled "medical-director approval pending" in the prompt. None of them is a Thumbprint target, and none goes in front of a live member until the medical director signs it off.

Each passage is one rule or fact (80 to 250 words) drafted from the guidelines named in the Oct 14 build spec, section 5. Numbers were checked against the source named in its `url`. Adam's documents are guidance, not spec: where a guideline and a "functional" range disagree, the passage states the guideline and labels the tighter target Emerging.

- `reference/<section>/*.md`: the passages. Frontmatter: `title`, `source`, `evidence` (Strong, Moderate or Emerging), `approved_by`, `as_of`, `url`.
- `escalation.json`: the biomarker escalation matrix from the Recommendation Routing spec (#25), as data: per marker, the default lane (self or provider), the self-lane range, and the provider thresholds. Also awaiting approval. hs-CRP thresholds are in mg/L (the spec printed mg/dL by mistake).
- To approve a passage, set `approved_by` to the approver and date, then run `npm run library:readme`.

## activity

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Weekly aerobic activity guideline of 150 to 300 minutes](reference/activity/aerobic-activity-150-to-300-minutes.md) | HHS 2018 Physical Activity Guidelines for Americans, 2nd edition; WHO 2020 Guidelines on Physical Activity and Sedentary Behaviour | Strong | Awaiting medical-director approval |
| [Cardiorespiratory fitness, VO2 max, and long-term mortality](reference/activity/cardiorespiratory-fitness-vo2max-and-longevity.md) | Mandsager et al. 2018 JAMA Network Open, Cardiorespiratory fitness and long-term mortality among adults undergoing exercise treadmill testing | Moderate | Awaiting medical-director approval |
| [Daily step counts and lower mortality - where benefits level off](reference/activity/daily-steps-and-mortality.md) | Paluch et al. 2022 Lancet Public Health, Daily steps and all-cause mortality, meta-analysis of 15 international cohorts | Moderate | Awaiting medical-director approval |
| [Exercise lowers A1C and improves blood sugar control](reference/activity/exercise-and-a1c-blood-sugar.md) | ADA Standards of Care in Diabetes 2026, Section 5 Physical Activity | Strong | Awaiting medical-director approval |
| [Muscle-strengthening activity at least 2 days per week](reference/activity/muscle-strengthening-two-days-per-week.md) | HHS 2018 Physical Activity Guidelines for Americans, 2nd edition; WHO 2020 Guidelines; ADA Standards of Care in Diabetes 2026 | Strong | Awaiting medical-director approval |
| [Balance and multicomponent activity for older adults](reference/activity/older-adults-balance-and-multicomponent-activity.md) | HHS 2018 Physical Activity Guidelines for Americans, 2nd edition; WHO 2020 Guidelines; ADA Standards of Care in Diabetes 2026 | Strong | Awaiting medical-director approval |
| [Resistance training as first-line treatment for sarcopenia](reference/activity/resistance-training-for-sarcopenia.md) | Dent et al. 2018 International Clinical Practice Guidelines for Sarcopenia, ICFSR, Journal of Nutrition, Health and Aging | Strong | Awaiting medical-director approval |
| [Any activity beats none and breaking up sitting time](reference/activity/some-activity-beats-none-and-sitting-less.md) | WHO 2020 Guidelines on Physical Activity and Sedentary Behaviour; HHS 2018 Physical Activity Guidelines; ADA Standards of Care in Diabetes 2026 | Strong | Awaiting medical-director approval |

## bio-age

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [AHA PREVENT equations, what they estimate and what goes in](reference/bio-age/aha-prevent-equations-inputs-and-outputs.md) | Khan et al. 2024, Development and Validation of the American Heart Association PREVENT Equations, Circulation; AHA PREVENT calculator | Strong | Awaiting medical-director approval |
| [How Thumbprint shows cholesterol and blood pressure changes as Heart Age](reference/bio-age/heart-age-shows-cholesterol-and-bp-changes.md) | Thumbprint Health Developer Build Spec, Oct 2026 | Moderate | Awaiting medical-director approval |
| [Markers that do not affect PhenoAge biological age](reference/bio-age/phenoage-excludes-ldl-bp-a1c-hormones.md) | Levine et al. 2018, An epigenetic biomarker of aging for lifespan and healthspan, Aging (Albany NY) | Moderate | Awaiting medical-director approval |
| [The nine blood markers in PhenoAge and the tests they come from](reference/bio-age/phenoage-nine-markers.md) | Levine et al. 2018, An epigenetic biomarker of aging for lifespan and healthspan, Aging (Albany NY) | Moderate | Awaiting medical-director approval |
| [PhenoAge validation population and age range](reference/bio-age/phenoage-validation-age-range.md) | Liu, Kuo, Horvath, Crimmins, Ferrucci, Levine 2018, A new aging measure captures morbidity and mortality risk across diverse subpopulations from NHANES IV, PLOS Medicine | Moderate | Awaiting medical-director approval |
| [Blood-test PhenoAge versus DNA methylation epigenetic clocks](reference/bio-age/phenoage-versus-epigenetic-clocks.md) | Levine et al. 2018, An epigenetic biomarker of aging for lifespan and healthspan, Aging (Albany NY) | Moderate | Awaiting medical-director approval |
| [What PhenoAge biological age is and is not](reference/bio-age/phenoage-what-it-is.md) | Levine et al. 2018, An epigenetic biomarker of aging for lifespan and healthspan, Aging (Albany NY) | Moderate | Awaiting medical-director approval |
| [Heart age from PREVENT risk, the 2025 Northwestern method](reference/bio-age/prevent-heart-age-jama-cardiology-2025.md) | Khan and colleagues, Northwestern University, PREVENT risk age research letter, JAMA Cardiology 2025 | Moderate | Awaiting medical-director approval |
| [Thumbprint rules for calculating and displaying biological age](reference/bio-age/thumbprint-biological-age-calculation-rules.md) | Thumbprint Health Developer Build Spec, Oct 2026 | Moderate | Awaiting medical-director approval |

## blood-iron

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Ferritin rises with inflammation - reading iron stores in context](reference/blood-iron/ferritin-acute-phase-inflammation.md) | Van Vranken 2010, Evaluation of Microcytosis, American Family Physician; AGA 2020 Iron Deficiency Anemia Guideline | Moderate | Awaiting medical-director approval |
| [Ferritin cut-offs for iron deficiency - AGA 45 and NIH 30 ng/mL](reference/blood-iron/ferritin-iron-deficiency-cutoffs.md) | AGA 2020 Clinical Practice Guidelines on the Gastrointestinal Evaluation of Iron Deficiency Anemia; NIH ODS Iron Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Hemochromatosis genotypes, family screening and ferritin over 1000](reference/blood-iron/hemochromatosis-c282y-ferritin-1000.md) | ACG Clinical Guideline Hereditary Hemochromatosis 2019, American Journal of Gastroenterology | Strong | Awaiting medical-director approval |
| [Iron absorption - heme versus nonheme iron and vitamin C](reference/blood-iron/iron-absorption-heme-nonheme-vitamin-c.md) | NIH Office of Dietary Supplements, Iron Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Who is at higher risk of iron deficiency](reference/blood-iron/iron-deficiency-risk-groups.md) | NIH Office of Dietary Supplements, Iron Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Iron interactions with levothyroxine, levodopa and acid reducers](reference/blood-iron/iron-medication-interactions.md) | NIH Office of Dietary Supplements, Iron Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [MCV and RDW - what red blood cell size and size spread mean](reference/blood-iron/mcv-rdw-red-cell-size.md) | Van Vranken 2010, Evaluation of Microcytosis; Kaferle and Strzoda 2009, Evaluation of Macrocytosis, American Family Physician | Moderate | Awaiting medical-director approval |
| [Transferrin saturation of 45 percent and HFE hemochromatosis testing](reference/blood-iron/transferrin-saturation-hemochromatosis-screen.md) | ACG Clinical Guideline Hereditary Hemochromatosis 2019, American Journal of Gastroenterology | Strong | Awaiting medical-director approval |
| [White blood cell count normal range and leukocytosis](reference/blood-iron/wbc-count-normal-range.md) | Riley and Rupert 2015, Evaluation of Patients with Leukocytosis, American Family Physician | Moderate | Awaiting medical-director approval |
| [WHO hemoglobin cut-offs that define anemia in adults](reference/blood-iron/who-hemoglobin-anemia-cutoffs.md) | WHO 2024 Guideline on Haemoglobin Cutoffs to Define Anaemia in Individuals and Populations | Strong | Awaiting medical-director approval |

## hormones-female

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Compounded versus FDA-approved bioidentical menopause hormones](reference/hormones-female/compounded-bioidentical-hormones-menopause.md) | The North American Menopause Society 2022 Hormone Therapy Position Statement | Moderate | Awaiting medical-director approval |
| [Early menopause and POI - hormone therapy until about age 52](reference/hormones-female/early-menopause-poi-hormone-therapy.md) | The North American Menopause Society 2022 Hormone Therapy Position Statement | Moderate | Awaiting medical-director approval |
| [FDA 2025 removal of most boxed warnings on menopause hormone therapy](reference/hormones-female/fda-2025-menopause-hormone-therapy-boxed-warning-change.md) | FDA 2025 request for labeling changes to menopausal hormone therapy; FDA February 2026 label approvals | Strong | Awaiting medical-director approval |
| [FSH blood tests are not needed to diagnose perimenopause after 45](reference/hormones-female/fsh-test-not-needed-perimenopause-over-45.md) | NICE Guideline NG23 Menopause - identification and management | Strong | Awaiting medical-director approval |
| [How long menopause hormone therapy can continue - no fixed stop age](reference/hormones-female/hormone-therapy-duration-no-arbitrary-stop-age.md) | The North American Menopause Society 2022 Hormone Therapy Position Statement | Moderate | Awaiting medical-director approval |
| [Low-dose vaginal estrogen for genitourinary syndrome of menopause](reference/hormones-female/low-dose-vaginal-estrogen-genitourinary-syndrome.md) | The North American Menopause Society 2022 Hormone Therapy Position Statement | Strong | Awaiting medical-director approval |
| [Menopause hormone therapy benefit and risk by age and timing](reference/hormones-female/menopause-hormone-therapy-benefit-risk-by-age.md) | The North American Menopause Society 2022 Hormone Therapy Position Statement | Strong | Awaiting medical-director approval |
| [Supplements and lifestyle measures not recommended for hot flashes](reference/hormones-female/menopause-supplements-not-recommended-hot-flashes.md) | The North American Menopause Society 2023 Nonhormone Therapy Position Statement | Strong | Awaiting medical-director approval |
| [Nonhormone hot flash treatments the Menopause Society recommends](reference/hormones-female/nonhormone-hot-flash-treatments-recommended.md) | The North American Menopause Society 2023 Nonhormone Therapy Position Statement | Strong | Awaiting medical-director approval |
| [Women with a uterus using systemic estrogen need a progestogen](reference/hormones-female/progestogen-needed-with-estrogen-if-uterus.md) | The North American Menopause Society 2022 Hormone Therapy Position Statement | Strong | Awaiting medical-director approval |
| [STRAW+10 stages of the menopause transition](reference/hormones-female/straw-10-menopause-stages.md) | Harlow et al. 2012 Executive Summary of the Stages of Reproductive Aging Workshop + 10, Menopause | Moderate | Awaiting medical-director approval |

## hormones-male

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Estradiol testing in men with low testosterone and breast symptoms](reference/hormones-male/estradiol-testing-in-men.md) | AUA 2018 Evaluation and Management of Testosterone Deficiency Guideline, validity confirmed 2024 | Moderate | Awaiting medical-director approval |
| [Hematocrit monitoring on testosterone - 50 and 54 percent thresholds](reference/hormones-male/hematocrit-monitoring-on-testosterone-therapy.md) | AUA 2018 Evaluation and Management of Testosterone Deficiency Guideline, validity confirmed 2024; Endocrine Society 2018 Testosterone Therapy Guideline | Strong | Awaiting medical-director approval |
| [Diagnosing low testosterone - 300 ng/dL and two early-morning tests](reference/hormones-male/low-testosterone-diagnosis-300-ng-dl-two-morning-tests.md) | AUA 2018 Evaluation and Management of Testosterone Deficiency Guideline, validity confirmed 2024; Endocrine Society 2018 Testosterone Therapy Guideline | Strong | Awaiting medical-director approval |
| [Follow-up tests after low testosterone - LH and prolactin](reference/hormones-male/low-testosterone-workup-lh-prolactin.md) | AUA 2018 Evaluation and Management of Testosterone Deficiency Guideline, validity confirmed 2024; Endocrine Society 2018 Testosterone Therapy Guideline | Strong | Awaiting medical-director approval |
| [PSA testing before and during testosterone therapy](reference/hormones-male/psa-before-and-during-testosterone-therapy.md) | AUA 2018 Evaluation and Management of Testosterone Deficiency Guideline, validity confirmed 2024; Endocrine Society 2018 Testosterone Therapy Guideline | Strong | Awaiting medical-director approval |
| [SHBG and free testosterone - when total testosterone misleads](reference/hormones-male/shbg-and-free-testosterone.md) | Endocrine Society 2018 Testosterone Therapy in Men With Hypogonadism Guideline | Strong | Awaiting medical-director approval |
| [No routine testosterone screening and treatment in men 65 and older](reference/hormones-male/testosterone-screening-and-men-over-65.md) | Endocrine Society 2018 Testosterone Therapy in Men With Hypogonadism Guideline | Moderate | Awaiting medical-director approval |
| [Testosterone therapy suppresses sperm production and fertility](reference/hormones-male/testosterone-therapy-and-male-fertility.md) | AUA 2018 Evaluation and Management of Testosterone Deficiency Guideline, validity confirmed 2024; Endocrine Society 2018 Testosterone Therapy Guideline | Strong | Awaiting medical-director approval |
| [TRAVERSE trial - testosterone therapy and heart attack and stroke risk](reference/hormones-male/traverse-trial-testosterone-heart-safety.md) | Lincoff et al. 2023 TRAVERSE trial, New England Journal of Medicine; AAFP POEM summary 2023 | Strong | Awaiting medical-director approval |

## inflammation

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Lowering homocysteine with B vitamins and heart attack risk](reference/inflammation/homocysteine-lowering-b-vitamin-trials.md) | Marti-Carvajal et al. 2017, Homocysteine-lowering interventions for preventing cardiovascular events, Cochrane Database of Systematic Reviews | Strong | Awaiting medical-director approval |
| [Homocysteine levels and common causes of elevation](reference/inflammation/homocysteine-range-and-causes.md) | MedlinePlus Homocysteine Test, NIH National Library of Medicine; Marroncini et al. 2024, Hyperhomocysteinemia and Disease, International Journal of Molecular Sciences | Moderate | Awaiting medical-director approval |
| [hs-CRP above 10 mg/L suggests acute inflammation and a repeat test](reference/inflammation/hs-crp-above-10-acute-inflammation.md) | Pearson et al. 2003, Markers of Inflammation and Cardiovascular Disease, AHA/CDC Scientific Statement, Circulation | Strong | Awaiting medical-director approval |
| [hs-CRP cardiovascular risk categories under 1, 1 to 3, above 3 mg/L](reference/inflammation/hs-crp-cardiovascular-risk-categories.md) | Pearson et al. 2003, Markers of Inflammation and Cardiovascular Disease, AHA/CDC Scientific Statement, Circulation | Strong | Awaiting medical-director approval |
| [What raises and lowers hs-CRP levels](reference/inflammation/hs-crp-raising-and-lowering-factors.md) | Pearson et al. 2003, Markers of Inflammation and Cardiovascular Disease, AHA/CDC Scientific Statement, Circulation | Moderate | Awaiting medical-director approval |
| [hs-CRP as a risk-enhancing factor in the 2026 lipid guideline](reference/inflammation/hs-crp-risk-enhancer-lipid-guideline.md) | 2026 ACC/AHA/multisociety Guideline on the Management of Dyslipidemia | Strong | Awaiting medical-director approval |
| [MTHFR variants, homocysteine and why routine testing is not advised](reference/inflammation/mthfr-variants-and-testing.md) | ACMG 2013 Practice Guideline, Lack of evidence for MTHFR polymorphism testing, Genetics in Medicine | Strong | Awaiting medical-director approval |
| [White blood cell count and lymphocyte percent as inflammation context](reference/inflammation/wbc-and-lymphocytes-inflammation-context.md) | Pearson et al. 2003, Markers of Inflammation and Cardiovascular Disease, AHA/CDC Scientific Statement, Circulation; Levine et al. 2018 PhenoAge, Aging | Moderate | Awaiting medical-director approval |

## kidney-liver

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Healthy ALT upper limits - 33 U/L men and 25 U/L women](reference/kidney-liver/alt-upper-limit-normal.md) | ACG Clinical Guideline Evaluation of Abnormal Liver Chemistries 2017; AASLD 2023 Practice Guidance on NAFLD | Moderate | Awaiting medical-director approval |
| [AST to ALT ratio - alcohol, muscle and fatty liver patterns](reference/kidney-liver/ast-alt-ratio-patterns.md) | ACG Clinical Guideline Evaluation of Abnormal Liver Chemistries 2017, American Journal of Gastroenterology | Moderate | Awaiting medical-director approval |
| [eGFR equations - the race-free 2021 CKD-EPI equation](reference/kidney-liver/ckd-epi-2021-race-free-egfr.md) | KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease | Strong | Awaiting medical-director approval |
| [What raises or lowers creatinine besides kidney function](reference/kidney-liver/creatinine-muscle-mass-diet-creatine.md) | KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease | Moderate | Awaiting medical-director approval |
| [Cystatin C to confirm eGFR when creatinine may mislead](reference/kidney-liver/cystatin-c-egfr-confirmation.md) | KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease | Strong | Awaiting medical-director approval |
| [FIB-4 score for fatty liver fibrosis risk - AASLD cut-offs](reference/kidney-liver/fib4-masld-fibrosis-risk.md) | AASLD 2023 Practice Guidance on the Clinical Assessment and Management of Nonalcoholic Fatty Liver Disease, Hepatology | Strong | Awaiting medical-director approval |
| [KDIGO albuminuria categories A1 to A3 and urine ACR testing](reference/kidney-liver/kdigo-albuminuria-categories-uacr.md) | KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease | Strong | Awaiting medical-director approval |
| [KDIGO definition of chronic kidney disease](reference/kidney-liver/kdigo-ckd-definition.md) | KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease | Strong | Awaiting medical-director approval |
| [KDIGO GFR categories G1 to G5 for kidney function](reference/kidney-liver/kdigo-gfr-categories.md) | KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease | Strong | Awaiting medical-director approval |
| [Liver stiffness on FibroScan - the AASLD 8 and 12 kPa thresholds](reference/kidney-liver/liver-stiffness-elastography-fibroscan.md) | AASLD 2023 Practice Guidance on the Clinical Assessment and Management of Nonalcoholic Fatty Liver Disease, Hepatology | Moderate | Awaiting medical-director approval |
| [NAFLD renamed MASLD - the 2023 steatotic liver disease nomenclature](reference/kidney-liver/masld-nomenclature-2023.md) | 2023 multisociety Delphi consensus on steatotic liver disease nomenclature, AASLD with EASL and ALEH | Strong | Awaiting medical-director approval |

## lipids-cardio

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [ApoB testing and its role in the 2026 lipid guideline](reference/lipids-cardio/apob-testing-2026-lipid-guideline.md) | 2026 ACC/AHA/multisociety Guideline on the Management of Dyslipidemia | Strong | Awaiting medical-director approval |
| [Blood pressure categories in the 2025 AHA/ACC guideline](reference/lipids-cardio/blood-pressure-categories-2025-guideline.md) | 2025 AHA/ACC/multisociety Guideline for the Prevention, Detection, Evaluation and Management of High Blood Pressure in Adults | Strong | Awaiting medical-director approval |
| [Blood pressure treatment thresholds and targets in the 2025 guideline](reference/lipids-cardio/blood-pressure-treatment-thresholds-and-targets-2025.md) | 2025 AHA/ACC/multisociety Guideline for the Prevention, Detection, Evaluation and Management of High Blood Pressure in Adults | Strong | Awaiting medical-director approval |
| [LDL cholesterol and non-HDL goals by PREVENT risk tier](reference/lipids-cardio/ldl-and-non-hdl-goals-by-prevent-risk-tier.md) | 2026 ACC/AHA/multisociety Guideline on the Management of Dyslipidemia | Strong | Awaiting medical-director approval |
| [LDL and non-HDL goals for established heart disease and very high risk](reference/lipids-cardio/ldl-goals-established-ascvd-very-high-risk.md) | 2026 ACC/AHA/multisociety Guideline on the Management of Dyslipidemia | Strong | Awaiting medical-director approval |
| [When the 2026 lipid guideline skips the risk calculator, and CAC scoring](reference/lipids-cardio/lipid-therapy-without-risk-calculation-and-cac.md) | 2026 ACC/AHA/multisociety Guideline on the Management of Dyslipidemia | Strong | Awaiting medical-director approval |
| [Lipoprotein a risk bands in NLA and EAS consensus statements](reference/lipids-cardio/lipoprotein-a-nla-eas-risk-bands.md) | National Lipid Association 2024 Focused Update on Lipoprotein(a); European Atherosclerosis Society Lp(a) consensus statement | Moderate | Awaiting medical-director approval |
| [Lipoprotein a measured once in adulthood and its risk threshold](reference/lipids-cardio/lipoprotein-a-once-in-adulthood.md) | 2026 ACC/AHA/multisociety Guideline on the Management of Dyslipidemia | Strong | Awaiting medical-director approval |
| [PREVENT 10-year ASCVD risk tiers in the 2026 lipid guideline](reference/lipids-cardio/prevent-ascvd-risk-tiers-2026-lipid-guideline.md) | 2026 ACC/AHA/multisociety Guideline on the Management of Dyslipidemia | Strong | Awaiting medical-director approval |
| [Risk-enhancing factors in the 2026 lipid guideline](reference/lipids-cardio/risk-enhancing-factors-2026-lipid-guideline.md) | 2026 ACC/AHA/multisociety Guideline on the Management of Dyslipidemia | Strong | Awaiting medical-director approval |
| [Triglyceride thresholds in the 2026 lipid guideline](reference/lipids-cardio/triglyceride-thresholds-2026-lipid-guideline.md) | 2026 ACC/AHA/multisociety Guideline on the Management of Dyslipidemia | Strong | Awaiting medical-director approval |

## medications

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Biotin supplements can distort lab test results](reference/medications/biotin-lab-test-interference.md) | FDA Safety Communication on biotin interference with lab tests, 2017, updated 2019 | Strong | Awaiting medical-director approval |
| [GLP-1 drugs, muscle loss and other oral medications](reference/medications/glp1-lean-mass-and-oral-medications.md) | FDA prescribing information for Zepbound tirzepatide and Wegovy semaglutide, revised 2026 | Strong | Awaiting medical-director approval |
| [GLP-1 drugs semaglutide and tirzepatide, label warnings](reference/medications/glp1-semaglutide-tirzepatide-side-effects.md) | FDA prescribing information for Wegovy semaglutide, revised 2026 | Strong | Awaiting medical-director approval |
| [Grapefruit juice with simvastatin, lovastatin and atorvastatin](reference/medications/grapefruit-simvastatin-lovastatin-atorvastatin.md) | FDA prescribing information for Zocor simvastatin, revised 2023 | Strong | Awaiting medical-director approval |
| [What reduces levothyroxine absorption](reference/medications/levothyroxine-absorption-interactions.md) | FDA prescribing information for Synthroid levothyroxine sodium tablets, revised 2024 | Strong | Awaiting medical-director approval |
| [Metformin and vitamin B12 deficiency](reference/medications/metformin-vitamin-b12.md) | American Diabetes Association Standards of Care in Diabetes 2025, Section 9 Pharmacologic Approaches to Glycemic Treatment | Strong | Awaiting medical-director approval |
| [Long-term PPIs, low magnesium and vitamin B12](reference/medications/ppi-long-term-magnesium-b12.md) | FDA Drug Safety Communication 2011 on PPIs and low magnesium; FDA prescribing information for omeprazole | Strong | Awaiting medical-director approval |
| [SSRIs with St John's wort and serotonin syndrome](reference/medications/ssri-st-johns-wort-serotonin-syndrome.md) | FDA prescribing information for Zoloft sertraline 2023; NCCIH St. John's Wort fact sheet 2025 | Strong | Awaiting medical-director approval |
| [Statins and muscle pain in blinded trials](reference/medications/statins-muscle-symptoms-blinded-trials.md) | Cholesterol Treatment Trialists' Collaboration, Lancet 2022, Effect of statin therapy on muscle symptoms | Strong | Awaiting medical-director approval |
| [Warfarin, vitamin K foods and supplements](reference/medications/warfarin-vitamin-k-diet-supplements.md) | FDA prescribing information for Coumadin warfarin sodium; NIH Office of Dietary Supplements Vitamin K Fact Sheet 2021 | Strong | Awaiting medical-director approval |

## metabolic

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [When hemoglobin A1c is unreliable - anemia, variants, kidney failure](reference/metabolic/a1c-reliability-caveats.md) | American Diabetes Association Standards of Care in Diabetes 2026, Section 2 Diagnosis and Classification | Strong | Awaiting medical-director approval |
| [ADA diagnostic criteria for diabetes by A1c, fasting glucose and OGTT](reference/metabolic/ada-diabetes-diagnostic-criteria.md) | American Diabetes Association Standards of Care in Diabetes 2026, Section 2 Diagnosis and Classification | Strong | Awaiting medical-director approval |
| [ADA screening age and retest interval for prediabetes and diabetes](reference/metabolic/ada-diabetes-screening-age-interval.md) | American Diabetes Association Standards of Care in Diabetes 2026, Section 2 Diagnosis and Classification | Strong | Awaiting medical-director approval |
| [ADA prediabetes ranges for A1c, fasting glucose and 2-hour glucose](reference/metabolic/ada-prediabetes-ranges.md) | American Diabetes Association Standards of Care in Diabetes 2026, Section 2 Diagnosis and Classification | Strong | Awaiting medical-director approval |
| [Fasting insulin has no guideline reference range or target](reference/metabolic/fasting-insulin-no-guideline-range.md) | American Diabetes Association Standards of Care in Diabetes 2026, Section 2; 2017 population-based inter-laboratory HOMA-IR study | Emerging | Awaiting medical-director approval |
| [HOMA-IR is a research index without a guideline cut-off](reference/metabolic/homa-ir-research-tool.md) | Wallace, Levy and Matthews 2004, Use and Abuse of HOMA Modeling, Diabetes Care | Emerging | Awaiting medical-director approval |
| [Metabolic syndrome criteria - the 2009 harmonized definition](reference/metabolic/metabolic-syndrome-harmonized-criteria.md) | Alberti et al. 2009, Harmonizing the Metabolic Syndrome, joint IDF, NHLBI, AHA, WHF, IAS and IASO statement, Circulation | Strong | Awaiting medical-director approval |
| [Triglycerides of 500 mg/dL or higher and acute pancreatitis risk](reference/metabolic/severe-hypertriglyceridemia-pancreatitis.md) | 2021 ACC Expert Consensus Decision Pathway on the Management of ASCVD Risk Reduction in Patients With Persistent Hypertriglyceridemia | Strong | Awaiting medical-director approval |

## nutrition

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [AHA 2021 dietary guidance for heart health](reference/nutrition/aha-2021-heart-healthy-eating-pattern.md) | American Heart Association 2021 Dietary Guidance to Improve Cardiovascular Health, Circulation | Strong | Awaiting medical-director approval |
| [Alcohol and cancer risk - 2025 Surgeon General advisory](reference/nutrition/alcohol-and-cancer-risk-2025-advisory.md) | US Surgeon General 2025 Advisory on Alcohol and Cancer Risk; Dietary Guidelines for Americans 2025-2030 | Strong | Awaiting medical-director approval |
| [Daily sodium limit in the Dietary Guidelines](reference/nutrition/daily-sodium-limit.md) | USDA and HHS 2026 Dietary Guidelines for Americans, 2025-2030; ADA Standards of Care in Diabetes 2026 | Strong | Awaiting medical-director approval |
| [DASH eating pattern and lower sodium for blood pressure](reference/nutrition/dash-eating-pattern-blood-pressure.md) | Sacks et al. 2001 NEJM DASH-Sodium trial, as summarized in CMAJ 2001 | Strong | Awaiting medical-director approval |
| [Added sugar limits in the 2025-2030 Dietary Guidelines](reference/nutrition/dga-2025-2030-added-sugar-limit.md) | USDA and HHS 2026 Dietary Guidelines for Americans, 2025-2030 | Strong | Awaiting medical-director approval |
| [Saturated fat limit of 10 percent of daily calories](reference/nutrition/dga-2025-2030-saturated-fat-limit.md) | USDA and HHS 2026 Dietary Guidelines for Americans, 2025-2030 | Strong | Awaiting medical-director approval |
| [Daily dietary fiber target scaled to calories](reference/nutrition/dietary-fiber-target.md) | ADA Standards of Care in Diabetes 2026, Section 5; Dietary Guidelines for Americans 2020-2025 | Strong | Awaiting medical-director approval |
| [Mediterranean diet and heart disease - the PREDIMED trial](reference/nutrition/mediterranean-diet-predimed-evidence.md) | Estruch et al. 2018 NEJM PREDIMED republication; ADA Standards of Care in Diabetes 2026 | Strong | Awaiting medical-director approval |
| [Daily protein intake targets for adults](reference/nutrition/protein-intake-targets-adults.md) | USDA and HHS 2026 Dietary Guidelines for Americans, 2025-2030; National Academies protein RDA | Moderate | Awaiting medical-director approval |
| [Higher protein needs in adults over 65](reference/nutrition/protein-needs-older-adults.md) | Bauer et al. 2013 PROT-AGE Study Group position paper, JAMDA | Moderate | Awaiting medical-director approval |
| [Time-restricted eating and intermittent fasting evidence](reference/nutrition/time-restricted-eating-evidence.md) | Liu et al. 2022 NEJM calorie restriction with or without time-restricted eating; ADA Standards of Care in Diabetes 2026 | Emerging | Awaiting medical-director approval |

## peptides

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [BPC-157 FDA compounding status as of October 2026](reference/peptides/bpc-157-fda-compounding-status-2026.md) | FDA Certain Bulk Drug Substances for Use in Compounding that May Present Significant Safety Risks, April 2026; FDA Pharmacy Compounding Advisory Committee July 2026 | Strong | Awaiting medical-director approval |
| [BPC-157 benefits - human evidence is limited](reference/peptides/bpc-157-human-evidence-is-limited.md) | FDA Category 2 safety evaluation of BPC-157, 2023; FDA Pharmacy Compounding Advisory Committee July 2026 | Emerging | Awaiting medical-director approval |
| [FDA safety concerns with compounded semaglutide and tirzepatide](reference/peptides/compounded-glp1-fda-safety-concerns.md) | FDA Concerns with Unapproved GLP-1 Drugs Used for Weight Loss, updated 2026 | Strong | Awaiting medical-director approval |
| [FDA 503A compounding rules and Category 1, 2 and 3 substances](reference/peptides/fda-503a-bulks-list-compounding-categories.md) | FDA Bulk Drug Substances Used in Compounding Under Section 503A of the FD&C Act, page current May 2026 | Strong | Awaiting medical-director approval |
| [FDA-approved peptide drugs versus unapproved research peptides](reference/peptides/fda-approved-peptide-drugs-vs-research-peptides.md) | FDA Concerns with Unapproved GLP-1 Drugs Used for Weight Loss, updated 2026; FDA 2010 approval of Egrifta tesamorelin | Strong | Awaiting medical-director approval |
| [Peptides FDA still lists in Category 2 for safety concerns](reference/peptides/peptides-in-fda-category-2.md) | FDA Certain Bulk Drug Substances for Use in Compounding that May Present Significant Safety Risks, page current April 22, 2026 | Strong | Awaiting medical-director approval |
| [Research use only peptides - FDA position and quality risks](reference/peptides/research-use-only-peptides-quality-risks.md) | FDA Concerns with Unapproved GLP-1 Drugs Used for Weight Loss, updated 2026; FDA warning letter to USApeptide.com, February 2025 | Strong | Awaiting medical-director approval |
| [WADA anti-doping rules prohibit BPC-157 and many peptides](reference/peptides/wada-prohibits-bpc-157-and-other-peptides.md) | World Anti-Doping Agency 2026 Prohibited List, sections S0 and S2 | Strong | Awaiting medical-director approval |

## pharmacogenomics

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Consumer pharmacogenetic test results need clinical confirmation](reference/pharmacogenomics/consumer-pgx-tests-confirm-before-acting.md) | FDA Safety Communication on genetic tests with unapproved claims to predict medication response, 2018; FDA Table of Pharmacogenetic Associations, updated 2026 | Strong | Awaiting medical-director approval |
| [What CPIC level A and level B gene-drug pairs mean](reference/pharmacogenomics/cpic-levels-a-and-b.md) | Clinical Pharmacogenetics Implementation Consortium, Assignment of CPIC Levels for Genes and Drugs | Strong | Awaiting medical-director approval |
| [CYP2C19 and clopidogrel](reference/pharmacogenomics/cyp2c19-clopidogrel.md) | CPIC Guideline for CYP2C19 Genotype and Clopidogrel Therapy, 2022 Update | Strong | Awaiting medical-director approval |
| [CYP2C19 and CYP2D6 with SSRI antidepressants](reference/pharmacogenomics/cyp2c19-cyp2d6-ssri-antidepressants.md) | CPIC Guideline for CYP2D6, CYP2C19, CYP2B6, SLC6A4 and HTR2A Genotypes and Serotonin Reuptake Inhibitor Antidepressants, 2023 | Strong | Awaiting medical-director approval |
| [CYP2C19 and proton pump inhibitors](reference/pharmacogenomics/cyp2c19-proton-pump-inhibitors.md) | CPIC Guideline for CYP2C19 and Proton Pump Inhibitor Dosing, 2020 | Moderate | Awaiting medical-director approval |
| [CYP2C9, VKORC1 and CYP4F2 with warfarin](reference/pharmacogenomics/cyp2c9-vkorc1-cyp4f2-warfarin.md) | CPIC Guideline for Pharmacogenetics-Guided Warfarin Dosing, 2017 Update | Strong | Awaiting medical-director approval |
| [CYP2D6 and codeine or tramadol](reference/pharmacogenomics/cyp2d6-codeine-tramadol.md) | CPIC Guideline for CYP2D6, OPRM1 and COMT Genotypes and Select Opioid Therapy, 2021 | Strong | Awaiting medical-director approval |
| [DPYD testing before fluorouracil or capecitabine](reference/pharmacogenomics/dpyd-fluorouracil-capecitabine.md) | FDA Safety Labeling Update for capecitabine and fluorouracil, 2026; CPIC DPYD and Fluoropyrimidine Guideline | Strong | Awaiting medical-director approval |
| [HLA-B*57:01 with abacavir and HLA-B*15:02 with carbamazepine](reference/pharmacogenomics/hla-b-abacavir-carbamazepine.md) | CPIC Guidelines for HLA-B and Abacavir, 2014 Update, and for HLA-B, HLA-A and Carbamazepine or Oxcarbazepine, 2017 Update | Strong | Awaiting medical-director approval |
| [Poor, intermediate, normal, rapid and ultrarapid metabolizer](reference/pharmacogenomics/metabolizer-phenotype-terms.md) | CPIC consensus terms for pharmacogenetic test results, Caudle et al., Genetics in Medicine 2017 | Strong | Awaiting medical-director approval |
| [MTHFR gene variants and why testing is not recommended](reference/pharmacogenomics/mthfr-testing-not-recommended.md) | ACMG Practice Guideline, Lack of evidence for MTHFR polymorphism testing, 2013, reaffirmed 2020 | Strong | Awaiting medical-director approval |
| [SLCO1B1, ABCG2 and CYP2C9 with statins](reference/pharmacogenomics/slco1b1-abcg2-cyp2c9-statins.md) | CPIC Guideline for SLCO1B1, ABCG2 and CYP2C9 Genotypes and Statin-Associated Musculoskeletal Symptoms, 2022 | Strong | Awaiting medical-director approval |
| [TPMT and NUDT15 with azathioprine and mercaptopurine](reference/pharmacogenomics/tpmt-nudt15-thiopurines.md) | CPIC Guideline for Thiopurine Dosing Based on TPMT and NUDT15 Genotypes, 2018 Update | Strong | Awaiting medical-director approval |

## preventive

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [USPSTF abdominal aortic aneurysm screening by sex and smoking](reference/preventive/uspstf-abdominal-aortic-aneurysm-screening.md) | USPSTF 2019 Final Recommendation Statement, Abdominal Aortic Aneurysm: Screening | Strong | Awaiting medical-director approval |
| [USPSTF breast cancer screening every 2 years from 40 to 74](reference/preventive/uspstf-breast-cancer-screening.md) | USPSTF 2024 Final Recommendation Statement, Breast Cancer: Screening | Strong | Awaiting medical-director approval |
| [USPSTF cervical cancer screening by age and test](reference/preventive/uspstf-cervical-cancer-screening.md) | USPSTF 2018 Final Recommendation Statement, Cervical Cancer: Screening | Strong | Awaiting medical-director approval |
| [USPSTF colorectal cancer screening from age 45](reference/preventive/uspstf-colorectal-cancer-screening.md) | USPSTF 2021 Final Recommendation Statement, Colorectal Cancer: Screening | Strong | Awaiting medical-director approval |
| [USPSTF hepatitis C screening for adults 18 to 79](reference/preventive/uspstf-hepatitis-c-screening.md) | USPSTF 2020 Final Recommendation Statement, Hepatitis C Virus Infection in Adolescents and Adults: Screening | Strong | Awaiting medical-director approval |
| [USPSTF blood pressure screening for adults 18 and older](reference/preventive/uspstf-hypertension-screening.md) | USPSTF 2021 Final Recommendation Statement, Hypertension in Adults: Screening | Strong | Awaiting medical-director approval |
| [USPSTF lung cancer screening for adults 50 to 80 who smoked](reference/preventive/uspstf-lung-cancer-screening.md) | USPSTF 2021 Final Recommendation Statement, Lung Cancer: Screening | Strong | Awaiting medical-director approval |
| [USPSTF osteoporosis screening for women 65 and older](reference/preventive/uspstf-osteoporosis-screening.md) | USPSTF 2025 Final Recommendation Statement, Osteoporosis to Prevent Fractures: Screening | Strong | Awaiting medical-director approval |
| [USPSTF prediabetes and type 2 diabetes screening ages 35 to 70](reference/preventive/uspstf-prediabetes-diabetes-screening.md) | USPSTF 2021 Final Recommendation Statement, Prediabetes and Type 2 Diabetes: Screening | Strong | Awaiting medical-director approval |
| [USPSTF prostate cancer PSA screening as an individual decision](reference/preventive/uspstf-prostate-cancer-screening.md) | USPSTF 2018 Final Recommendation Statement, Prostate Cancer: Screening | Moderate | Awaiting medical-director approval |
| [USPSTF statin use for primary prevention of heart disease](reference/preventive/uspstf-statin-primary-prevention.md) | USPSTF 2022 Final Recommendation Statement, Statin Use for the Primary Prevention of Cardiovascular Disease in Adults | Strong | Awaiting medical-director approval |

## sleep

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Adults need 7 or more hours of sleep per night](reference/sleep/adult-sleep-duration-seven-hours.md) | AASM and Sleep Research Society 2015 Joint Consensus Statement on Adult Sleep Duration; CDC | Strong | Awaiting medical-director approval |
| [Caffeine taken 6 hours before bed can still disrupt sleep](reference/sleep/caffeine-timing-and-sleep.md) | Drake et al. 2013 Journal of Clinical Sleep Medicine, Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed | Moderate | Awaiting medical-director approval |
| [CBT-I is the first-line treatment for chronic insomnia](reference/sleep/cbt-i-first-line-for-chronic-insomnia.md) | ACP 2016 Clinical Practice Guideline on Chronic Insomnia Disorder; AASM 2021 Behavioral and Psychological Treatments Guideline | Strong | Awaiting medical-director approval |
| [Consistent sleep and wake times support health](reference/sleep/consistent-sleep-schedule-regularity.md) | National Sleep Foundation 2023 Sleep Timing and Variability Consensus Statement, Sleep Health | Moderate | Awaiting medical-director approval |
| [Reading HRV - heart rate variability against personal baseline](reference/sleep/hrv-heart-rate-variability-trends.md) | Shaffer and Ginsberg 2017 An Overview of Heart Rate Variability Metrics and Norms, Frontiers in Public Health | Emerging | Awaiting medical-director approval |
| [Sleep apnea screening with STOP-Bang and how OSA is diagnosed](reference/sleep/obstructive-sleep-apnea-screening-stop-bang.md) | AASM 2017 Clinical Practice Guideline for Diagnostic Testing for Adult Obstructive Sleep Apnea; Chung STOP-Bang questionnaire | Strong | Awaiting medical-director approval |
| [Resting heart rate from wearables varies widely between people](reference/sleep/resting-heart-rate-personal-baseline.md) | Quer et al. 2020 PLOS ONE, inter- and intraindividual variability in daily resting heart rate in 92,457 adults | Emerging | Awaiting medical-director approval |
| [Sleep problems and blood sugar - ADA sleep health guidance](reference/sleep/sleep-and-diabetes-ada-2026.md) | ADA Standards of Care in Diabetes 2026, Section 5 Sleep Health | Strong | Awaiting medical-director approval |
| [How accurate wearable sleep tracking and sleep stages are](reference/sleep/wearable-sleep-tracking-accuracy.md) | Chinoy et al. 2021 Sleep, seven consumer sleep-tracking devices vs polysomnography; AASM 2018 Consumer Sleep Technology Position Statement | Moderate | Awaiting medical-director approval |

## supplements

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Ashwagandha, liver injury reports and thyroid effects](reference/supplements/ashwagandha-liver-and-thyroid.md) | NIH Office of Dietary Supplements, Ashwagandha Health Professional Fact Sheet 2025; LiverTox Ashwagandha 2024 | Moderate | Awaiting medical-director approval |
| [Berberine for blood sugar and weight, evidence and interactions](reference/supplements/berberine-evidence-and-interactions.md) | NCCIH, Berberine and Weight Loss: What You Need To Know, 2023 | Emerging | Awaiting medical-director approval |
| [How to choose a supplement product, USP and NSF seals](reference/supplements/choosing-a-supplement-product-usp-nsf.md) | NIH Office of Dietary Supplements, Dietary Supplements: What You Need to Know, 2023; FDA Questions and Answers on Dietary Supplements | Strong | Awaiting medical-director approval |
| [Creatine supplements, kidney safety and serum creatinine](reference/supplements/creatine-kidneys-and-serum-creatinine.md) | International Society of Sports Nutrition position stand on creatine, 2017; NIH ODS Exercise and Athletic Performance Fact Sheet 2024; KDIGO 2024 CKD Guideline | Moderate | Awaiting medical-director approval |
| [Magnesium supplement forms and caution with kidney disease](reference/supplements/magnesium-forms-and-kidney-disease.md) | NIH Office of Dietary Supplements, Magnesium Health Professional Fact Sheet, updated 2026; IOM Dietary Reference Intakes | Strong | Awaiting medical-director approval |
| [Fish oil supplements, the VITAL trial and atrial fibrillation](reference/supplements/omega-3-fish-oil-vital-and-afib.md) | NIH Office of Dietary Supplements, Omega-3 Fatty Acids Health Professional Fact Sheet, updated 2025 | Moderate | Awaiting medical-director approval |
| [Red yeast rice contains monacolin K, the same molecule as lovastatin](reference/supplements/red-yeast-rice-monacolin-k.md) | NCCIH, Red Yeast Rice fact sheet, updated 2022 | Strong | Awaiting medical-director approval |
| [St John's wort weakens many medications](reference/supplements/st-johns-wort-drug-interactions.md) | NCCIH, St. John's Wort fact sheet, updated 2025 | Strong | Awaiting medical-director approval |
| [Tolerable upper intake levels for vitamins and minerals](reference/supplements/tolerable-upper-intake-levels.md) | NIH Office of Dietary Supplements, Frequently Asked Questions, upper limits for vitamins and minerals; National Academies Dietary Reference Intakes | Strong | Awaiting medical-director approval |
| [Turmeric and curcumin supplements and liver injury](reference/supplements/turmeric-curcumin-liver-injury.md) | NIH LiverTox, Turmeric monograph, updated 2025 | Strong | Awaiting medical-director approval |
| [Vitamin D with vitamin K2, what the evidence shows](reference/supplements/vitamin-d-with-k2-claims.md) | NIH Office of Dietary Supplements, Vitamin K Health Professional Fact Sheet, updated 2021 | Emerging | Awaiting medical-director approval |

## thyroid

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Biotin supplements can distort thyroid blood test results](reference/thyroid/biotin-interferes-with-thyroid-blood-tests.md) | American Thyroid Association Clinical Thyroidology for the Public 2018; FDA biotin safety communication 2017, updated 2019 | Strong | Awaiting medical-director approval |
| [Levothyroxine absorption - timing with food, calcium and iron](reference/thyroid/levothyroxine-timing-with-food-calcium-iron.md) | AACE/ATA 2012 Hypothyroidism Guidelines; ATA 2014 Guidelines for the Treatment of Hypothyroidism | Moderate | Awaiting medical-director approval |
| [Subclinical versus overt hypothyroidism - TSH and free T4 criteria](reference/thyroid/subclinical-vs-overt-hypothyroidism-definitions.md) | AACE/ATA 2012 Clinical Practice Guidelines for Hypothyroidism in Adults | Strong | Awaiting medical-director approval |
| [TPO antibodies and the risk of progressing to overt hypothyroidism](reference/thyroid/tpo-antibodies-predict-hypothyroidism-progression.md) | AACE/ATA 2012 Clinical Practice Guidelines for Hypothyroidism in Adults | Moderate | Awaiting medical-director approval |
| [TSH above 10 mIU/L and when guidelines consider thyroid treatment](reference/thyroid/tsh-above-10-treatment-consideration.md) | AACE/ATA 2012 Clinical Practice Guidelines for Hypothyroidism in Adults | Moderate | Awaiting medical-director approval |
| [TSH is the first-line blood test for thyroid function](reference/thyroid/tsh-first-line-thyroid-screening-test.md) | AACE/ATA 2012 Clinical Practice Guidelines for Hypothyroidism in Adults | Strong | Awaiting medical-director approval |
| [When TSH is rechecked after starting or changing thyroid medication](reference/thyroid/tsh-recheck-after-levothyroxine-change.md) | AACE/ATA 2012 Hypothyroidism Guidelines; ATA 2014 Guidelines for the Treatment of Hypothyroidism | Strong | Awaiting medical-director approval |
| [TSH reference ranges shift upward with age](reference/thyroid/tsh-reference-range-rises-with-age.md) | AACE/ATA 2012 Clinical Practice Guidelines for Hypothyroidism in Adults | Moderate | Awaiting medical-director approval |
| [USPSTF position on thyroid screening in adults without symptoms](reference/thyroid/uspstf-thyroid-screening-asymptomatic-adults.md) | USPSTF 2015 Final Recommendation Statement - Thyroid Dysfunction Screening | Strong | Awaiting medical-director approval |

## vitamins

| Passage | Source | Evidence | Status |
|---|---|---|---|
| [Endocrine Society 2024 advises against routine vitamin D testing](reference/vitamins/endocrine-2024-vitamin-d-testing.md) | Endocrine Society 2024 Clinical Practice Guideline, Vitamin D for the Prevention of Disease | Moderate | Awaiting medical-director approval |
| [Groups the Endocrine Society says may benefit from vitamin D](reference/vitamins/endocrine-2024-vitamin-d-who-benefits.md) | Endocrine Society 2024 Clinical Practice Guideline, Vitamin D for the Prevention of Disease | Moderate | Awaiting medical-director approval |
| [Medications that lower folate - methotrexate, antiseizure drugs](reference/vitamins/folate-medication-interactions.md) | NIH Office of Dietary Supplements, Folate Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Folate blood tests and the folate and vitamin B12 interaction](reference/vitamins/folate-status-tests-b12-masking.md) | NIH Office of Dietary Supplements, Folate Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Magnesium depletion from PPIs, diuretics and diabetes](reference/vitamins/magnesium-depletion-medications-risk-groups.md) | NIH Office of Dietary Supplements, Magnesium Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Serum magnesium poorly reflects total body magnesium](reference/vitamins/magnesium-serum-poor-marker.md) | NIH Office of Dietary Supplements, Magnesium Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Who is at higher risk of vitamin B12 deficiency](reference/vitamins/vitamin-b12-deficiency-risk-groups.md) | NIH Office of Dietary Supplements, Vitamin B12 Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Metformin and acid reducers can lower vitamin B12](reference/vitamins/vitamin-b12-metformin-ppi-effects.md) | NIH Office of Dietary Supplements, Vitamin B12 Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Vitamin B12 blood levels and methylmalonic acid confirmation](reference/vitamins/vitamin-b12-serum-mma-testing.md) | NIH Office of Dietary Supplements, Vitamin B12 Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |
| [Vitamin D blood level cut-offs from the National Academies](reference/vitamins/vitamin-d-25ohd-nasem-cutoffs.md) | NIH Office of Dietary Supplements, Vitamin D Fact Sheet for Health Professionals, citing the NASEM Food and Nutrition Board | Strong | Awaiting medical-director approval |
| [The 50 to 80 ng/mL functional vitamin D target is not guideline-based](reference/vitamins/vitamin-d-functional-50-80-range-emerging.md) | Endocrine Society 2024 Vitamin D for the Prevention of Disease; NIH ODS Vitamin D Fact Sheet citing NASEM | Emerging | Awaiting medical-director approval |
| [Who is at higher risk of low vitamin D](reference/vitamins/vitamin-d-risk-groups.md) | NIH Office of Dietary Supplements, Vitamin D Fact Sheet for Health Professionals | Strong | Awaiting medical-director approval |

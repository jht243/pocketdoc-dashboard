/**
 * Intake questionnaire content — single source of truth.
 *
 * This encodes the "Personal Health Intake & Screening Questionnaire" (Aug 10 2025
 * revision) as data so both the onboarding health-intake step and the standalone
 * Health History screen render exactly the same questions from one place. Only the
 * *content* lives here; each screen supplies its own look/feel (the `variant` prop
 * on <IntakeForm>).
 *
 * Field-key stability: a handful of answer keys are read elsewhere (persistence in
 * profileStore.js, the AI system prompt, test-mode snapshots). Those keys are kept
 * exactly as they were so nothing downstream breaks:
 *   primaryConcern, conditions, medications, pastEvents, familyHistory,
 *   exercise, sleep, alcohol, goals
 * Every other key is new and currently lives in-session only.
 *
 * Question types:
 *   single   — pick one (radio). value: string
 *   multi    — pick any (checkbox chips). value: string[]. optional `max`
 *   tokens   — free-text add/remove list. value: string[]
 *   text     — one-line input. value: string
 *   textarea — multi-line input. value: string
 *   note     — informational only, no input (`tone`: "info" | "warn")
 *
 * `showIf(a)` — question/section is only rendered when it returns true (`a` = answers).
 */

// ---- Section 1 — demographics & basic profile (beyond name/DOB/sex) ----
// Top level is deliberately Man / Woman / Other / Prefer not to say. Listing every
// identity up front reads as taking a stance and is presumptive for the majority of
// users; picking "Other" opens the specific choices, and only those specific choices
// open the gender-affirming hormone therapy question.
const GENDER_IDENTITY = ["Man", "Woman", "Other", "Prefer not to say"];
const GENDER_IDENTITY_OTHER = [
  "Non-binary", "Transgender man", "Transgender woman",
  "Genderqueer / gender fluid", "Agender", "Prefer to self-describe",
];
// Identities for whom the GAHT questions are relevant.
const GAHT_RELEVANT = [
  "Non-binary", "Transgender man", "Transgender woman",
  "Genderqueer / gender fluid", "Agender", "Prefer to self-describe",
];
const asksAboutGAHT = (a) => a.genderIdentity === "Other" && GAHT_RELEVANT.includes(a.genderIdentityDetail);
const RACE_ETHNICITY = [
  "White / Caucasian", "Black / African American", "Hispanic / Latino",
  "Asian / Pacific Islander", "Native American / Alaska Native",
  "Middle Eastern / North African", "Mixed / Multiracial", "Prefer not to say",
];
const EDUCATION = ["< High school", "High school / GED", "Some college", "Bachelor's", "Graduate degree"];
const EMPLOYMENT = ["Employed full-time", "Employed part-time", "Self-employed", "Retired", "Not employed"];

// ---- Section 2 — personal health history ----
const DIAGNOSED_CONDITIONS = [
  "Type 1 Diabetes", "Type 2 Diabetes", "Pre-diabetes / insulin resistance",
  "High blood pressure (hypertension)", "High cholesterol / dyslipidemia",
  "Heart disease / coronary artery disease", "Heart attack (myocardial infarction)",
  "Stroke or TIA (mini-stroke)", "Atrial fibrillation (AFib) or arrhythmia",
  "Peripheral artery disease (PAD)", "Asthma", "COPD / emphysema", "Sleep apnea",
  "Thyroid disorder (hypo/hyperthyroid, Hashimoto's, Graves')",
  "Autoimmune condition (lupus, MS, RA, IBD, celiac, psoriasis)",
  "Kidney disease / CKD", "Liver disease / fatty liver / cirrhosis",
  "Osteoporosis or osteopenia", "Osteoarthritis or joint disease",
  "Anxiety disorder", "Depression", "ADHD", "PTSD", "Bipolar disorder",
  "Cancer", "HIV / AIDS", "Hepatitis B or C", "GERD / acid reflux", "IBS or IBD",
  "Migraine", "Epilepsy / seizure disorder", "Anemia", "Clotting disorder",
  "Polycystic ovary syndrome (PCOS)", "Endometriosis", "None of the above",
];
const GAHT_TYPES = [
  "Estrogen — oral (pill)", "Estrogen — transdermal patch", "Estrogen — topical gel / cream",
  "Estrogen — injectable (estradiol valerate, estradiol cypionate)", "Progesterone / progestin",
  "Testosterone — injectable (cypionate, enanthate)", "Testosterone — topical gel / cream",
  "Testosterone — subcutaneous pellets",
  "Androgen blocker / anti-androgen (spironolactone, bicalutamide, finasteride)",
  "GnRH agonist / puberty blocker (leuprolide, histrelin)", "Other", "No longer on GAHT",
];
const GAHT_SURGERIES = [
  "Orchiectomy (removal of testes)", "Vaginoplasty", "Phalloplasty / metoidioplasty",
  "Mastectomy / top surgery", "Breast augmentation", "Hysterectomy / oophorectomy",
  "Facial feminization surgery", "None", "Prefer not to disclose",
];
const TRT_FORMS = [
  "Injectable — Testosterone Cypionate", "Injectable — Testosterone Enanthate",
  "Injectable — Testosterone Propionate", "Injectable — Testosterone Undecanoate (Aveed / Nebido)",
  "Topical gel (AndroGel, Testim, Vogelxo)", "Topical cream (compounded)",
  "Transdermal patch (Androderm)", "Subcutaneous pellets (Testopel)",
  "Oral (Jatenzo / testosterone undecanoate oral)", "Buccal (Striant)",
  "Sublingual (compounded)", "Nasal gel (Natesto)", "Other",
];
const TRT_ANCILLARIES = [
  "HCG (human chorionic gonadotropin)", "Enclomiphene or clomiphene citrate (Clomid)",
  "Anastrozole (aromatase inhibitor)", "Exemestane or letrozole (AI)",
  "Progesterone", "DHEA", "Pregnenolone", "None", "Other",
];
const PEPTIDES = [
  "Sermorelin (GHRH analog)", "CJC-1295 (with or without DAC)", "Ipamorelin (GHRP)",
  "Tesamorelin (GHRH analog)", "GHRP-2", "GHRP-6", "MK-677 / Ibutamoren",
  "BPC-157 (Body Protection Compound)", "TB-500 / Thymosin Beta-4", "GHK-Cu (copper peptide)",
  "KPV", "LL-37", "Semaglutide (Ozempic / Wegovy) — prescribed", "Semaglutide — compounded / grey market",
  "Tirzepatide (Mounjaro / Zepbound) — prescribed", "Tirzepatide — compounded / grey market",
  "AOD-9604", "MOTS-c", "Humanin", "PT-141 / Bremelanotide", "Melanotan II", "Dihexa",
  "Semax", "Selank", "Epithalon / Epitalon", "Pinealon", "Thymosin Alpha-1 (Ta1)", "Thymulin",
  "SS-31 (Elamipretide)", "Hexarelin", "Other — not listed",
];
const PEPTIDE_REASONS = [
  "Recovery / injury healing", "Anti-aging / longevity", "Growth hormone optimization",
  "Fat loss / body composition", "Cognitive enhancement", "Sexual function",
  "Immune support", "Gut / GI healing", "Sleep improvement", "Athletic performance", "Other",
];

// ---- Section 3 — family history ----
const FAMILY_CONDITIONS = [
  "Type 2 Diabetes", "Heart disease / coronary artery disease",
  "High cholesterol / familial hypercholesterolemia", "High blood pressure", "Stroke",
  "Atrial fibrillation", "Colorectal cancer", "Breast cancer", "Ovarian cancer",
  "Prostate cancer", "Pancreatic cancer", "Melanoma / skin cancer", "Lung cancer",
  "Stomach / gastric cancer", "Alzheimer's disease or dementia", "Parkinson's disease",
  "Osteoporosis", "Autoimmune disease (lupus, MS, RA, celiac, IBD)", "Kidney disease",
  "Aneurysm", "Hemochromatosis (iron overload)", "Clotting disorders (Factor V Leiden, etc.)",
  "None of the above known", "Unknown family history",
];

// ---- Section 4 — lifestyle ----
const EXERCISE_TYPES = [
  "Strength / resistance training", "Cardio / aerobic (running, cycling, rowing)",
  "High-intensity interval training (HIIT) / CrossFit", "Yoga / Pilates / flexibility",
  "Team sports", "Walking / low-intensity movement", "I don't exercise regularly",
];
const SLEEP_ISSUES = [
  "Difficulty falling asleep", "Waking frequently during the night", "Waking unrefreshed",
  "Loud snoring (reported by partner)", "Gasping or stopping breathing during sleep",
  "Daytime fatigue or sleepiness", "Restless legs",
];
const STRESS_MANAGEMENT = [
  "Meditation / mindfulness", "Therapy / counseling", "Exercise",
  "Social support / community", "Nature / outdoor time", "None",
];

// ---- Section 5 — preventive care & screening history ----
const SCREENINGS_COMPLETED = [
  "Colonoscopy or colorectal cancer screening (stool DNA, FIT, sigmoidoscopy)", "Mammogram",
  "Pap smear / cervical cancer screening", "PSA (prostate-specific antigen) test",
  "Skin cancer / dermatology screening", "Bone density scan (DEXA)",
  "Cardiac calcium score (CAC)", "Carotid intima-media thickness (CIMT)",
  "EKG or echocardiogram", "Pulmonary function test (spirometry)",
  "Low-dose CT lung scan (LDCT)", "Full-body MRI",
  "Genetic / genomic testing (23andMe, Ancestry, clinical WGS)", "Pharmacogenomic (PGx) testing",
  "Food sensitivity testing", "Continuous glucose monitoring (CGM)",
  "Testosterone / hormone panel", "IGF-1 level (growth hormone axis)",
  "Thyroid panel (TSH, Free T3, Free T4)", "Full iron panel / ferritin",
  "Advanced lipid panel (LDL-P, Lp(a), ApoB)", "Inflammatory markers (hsCRP, IL-6, homocysteine)",
  "Heavy metals panel", "Microbiome testing", "Hearing evaluation / audiogram", "None of the above",
];

// ---- Section 6 — environmental & occupational ----
const EXPOSURES = [
  "Loud noise / high-decibel environments", "Chemical or solvent exposure",
  "Heavy metals (lead, mercury, cadmium)", "Pesticides / herbicides",
  "Dust or respiratory irritants", "Radiation", "Shift work / irregular sleep schedule",
  "High psychological job stress", "None of the above",
];

// ---- Section 7 — goals & priorities ----
const GOALS = [
  "Lose or manage weight", "Build strength and muscle", "Improve cardiovascular fitness",
  "Optimize longevity / slow biological aging", "Improve energy and reduce fatigue",
  "Optimize sleep", "Manage a chronic condition", "Reduce disease risk (family history)",
  "Improve mental clarity / cognitive performance", "Hormone optimization",
  "Gut health / digestion", "Sexual health / libido", "Reduce stress and improve resilience",
  "Understand my genetics and biomarkers",
];
const BARRIERS = [
  "Time / schedule", "Cost / access to care", "Lack of clear guidance",
  "Motivation / habit formation", "Physical limitations / pain", "Mental health",
  "Past negative experiences with healthcare", "I'm already doing well — no major barriers",
];

// Helper: is a multi-answer including a given value?
const has = (a, key, val) => Array.isArray(a[key]) && a[key].includes(val);

// ---- anatomy gates ----
// Which reproductive questions apply is a question of anatomy, not identity. Start
// from biological sex (collected at onboarding step 1) and adjust for any reported
// gender-affirming surgery, so nobody is asked about anatomy they don't have.
// Dose units. Testosterone is dosed in milligrams — a gram would be ~5x a month's
// supply in one shot — so "g" is deliberately absent from the TRT unit list.
const TRT_DOSE_UNITS = ["mg", "mL", "IU", "pellets", "clicks", "pumps"];
const DOSE_FREQUENCIES = [
  "Daily", "Twice daily", "Every other day", "Every 3.5 days (twice weekly)",
  "Weekly", "Every 2 weeks", "Every 3 weeks", "Monthly", "Every 3 months", "As needed",
];

const familyCancerReported = (a) =>
  Array.isArray(a.familyHistory) && a.familyHistory.some((c) => /cancer|melanoma/i.test(c));

const onTRT = (a) => Boolean(a.testosteroneUse) && a.testosteroneUse !== "No";
const onPeptides = (a) => Boolean(a.peptideUse) && a.peptideUse !== "No";
// Accepts "54", "54%", "54.2" — anything that parses above the 52% risk threshold.
const hctAbove52 = (a) => {
  const n = parseFloat(String(a.trtHct || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 52;
};

const sexIs = (p, s) => String(p?.sex || "").toLowerCase() === s;
const hasFemaleRepro = (a, p) =>
  (sexIs(p, "female") && !has(a, "gahtSurgeries", "Hysterectomy / oophorectomy")) ||
  has(a, "gahtSurgeries", "Vaginoplasty");
const hasMaleRepro = (a, p) =>
  (sexIs(p, "male") && !has(a, "gahtSurgeries", "Orchiectomy (removal of testes)")) ||
  has(a, "gahtSurgeries", "Phalloplasty / metoidioplasty");

export const INTAKE_SECTIONS = [
  {
    id: "focus",
    title: "What matters most",
    questions: [
      {
        id: "primaryConcern", type: "textarea",
        label: "What's the one health thing you most want help with?",
        placeholder: "e.g. I've been feeling tired all the time and can't figure out why, or I want to understand my cholesterol results better...",
      },
    ],
  },
  {
    id: "demographics",
    title: "About you",
    intro: "A few basics that shape which screenings and risk calculations apply to you. Everything is optional.",
    questions: [
      { id: "genderIdentity", type: "single", label: "Current gender identity (optional)", options: GENDER_IDENTITY },
      { id: "genderIdentityDetail", type: "single", label: "Which best describes you?", options: GENDER_IDENTITY_OTHER, showIf: (a) => a.genderIdentity === "Other" },
      { id: "genderIdentitySelf", type: "text", label: "How would you describe your gender identity?", placeholder: "In your own words", showIf: (a) => a.genderIdentity === "Other" && a.genderIdentityDetail === "Prefer to self-describe" },
      { id: "gaht", type: "single", label: "Are you currently receiving gender-affirming hormone therapy (GAHT)?", options: ["No", "Yes — currently", "Yes — past only"], showIf: asksAboutGAHT },
      { id: "raceEthnicity", type: "multi", label: "Race / ethnicity (select all that apply)", options: RACE_ETHNICITY, exclusive: ["Prefer not to say"] },
      { id: "height", type: "text", label: "Height", placeholder: "e.g. 5 ft 10 in" },
      { id: "weight", type: "text", label: "Current weight", placeholder: "e.g. 175 lbs" },
      { id: "education", type: "single", label: "Highest level of education completed", options: EDUCATION },
      { id: "employment", type: "single", label: "Current employment status", options: EMPLOYMENT },
    ],
  },
  {
    id: "conditions",
    title: "Current conditions",
    intro: "Have you ever been diagnosed with any of the following? Select all that apply.",
    questions: [
      { id: "conditions", type: "chips", label: "Diagnosed conditions", options: DIAGNOSED_CONDITIONS, addLabel: "Add another condition...", exclusive: ["None of the above"] },
      { id: "autoimmuneDetail", type: "text", label: "Specify autoimmune condition", placeholder: "e.g. Hashimoto's, lupus, RA...", showIf: (a) => has(a, "conditions", "Autoimmune condition (lupus, MS, RA, IBD, celiac, psoriasis)") },
      { id: "cancerDetail", type: "text", label: "Cancer — type and year diagnosed", placeholder: "e.g. Melanoma, 2019", showIf: (a) => has(a, "conditions", "Cancer") },
    ],
  },
  {
    id: "surgical",
    title: "Surgeries & hospitalizations",
    questions: [
      { id: "pastEvents", type: "textarea", label: "Surgeries and hospitalizations", help: "List any procedures with approximate year, plus any non-surgical hospitalizations in the past 5 years.", placeholder: "e.g. Appendectomy 2018, kidney stone hospitalization 2022..." },
    ],
  },
  {
    id: "medications",
    title: "Medications & supplements",
    questions: [
      { id: "medications", type: "tokens", label: "Current medications, supplements & OTC", help: "Include prescriptions, vitamins, and anything you take regularly. You can manage these in more detail from your medication screen.", placeholder: "e.g. Lisinopril 10mg, Vitamin D3..." },
    ],
  },
  {
    id: "allergies",
    title: "Allergies",
    questions: [
      { id: "hasAllergies", type: "single", label: "Do you have known allergies? (medications, foods, environmental)", options: ["No known allergies", "Yes"] },
      { id: "allergiesList", type: "text", label: "List your allergies", placeholder: "e.g. Penicillin, shellfish, pollen", showIf: (a) => a.hasAllergies === "Yes" },
    ],
  },
  {
    id: "reproductive",
    title: "Reproductive & hormonal health",
    intro: "Based on the anatomy you told us about — we only ask what applies to you.",
    showIf: (a, p) => hasFemaleRepro(a, p) || hasMaleRepro(a, p),
    questions: [
      { id: "menopauseStatus", type: "single", label: "Current menstrual / menopausal status", options: ["Pre-menopausal", "Peri-menopausal", "Post-menopausal", "Surgical menopause"], showIf: (a, p) => hasFemaleRepro(a, p) },
      { id: "pregnancy", type: "single", label: "Are you currently pregnant or breastfeeding?", options: ["No", "Pregnant", "Breastfeeding"], showIf: (a, p) => hasFemaleRepro(a, p) && a.menopauseStatus !== "Post-menopausal" && a.menopauseStatus !== "Surgical menopause" },
      { id: "hormonalContraception", type: "single", label: "Have you ever used hormonal birth control or menopausal HRT?", options: ["No", "Yes — currently", "Yes — past only"], showIf: (a, p) => hasFemaleRepro(a, p) },
      { id: "lowTEval", type: "single", label: "Have you been evaluated for low testosterone or hormonal imbalance?", options: ["No", "Yes — treated", "Yes — not treated"], showIf: (a, p) => hasMaleRepro(a, p) },
      { id: "urinarySymptoms", type: "single", label: "Any urinary symptoms (frequency, urgency, weak stream, incomplete emptying)?", options: ["No", "Mild", "Moderate", "Severe"] },
    ],
  },
  {
    id: "gaht",
    title: "Gender-affirming hormone therapy",
    intro: "Shown because you indicated current or past GAHT.",
    showIf: (a) => a.gaht === "Yes — currently" || a.gaht === "Yes — past only",
    questions: [
      { id: "gahtTypes", type: "multi", label: "What type of GAHT are you on? (select all that apply)", options: GAHT_TYPES },
      { id: "gahtTypesOther", type: "text", label: "Other GAHT — specify", showIf: (a) => has(a, "gahtTypes", "Other") },
      { id: "gahtPrescriber", type: "single", label: "Who prescribes and monitors your GAHT?", options: ["Endocrinologist", "Primary care physician", "Planned Parenthood / community clinic", "Telehealth service", "Self-managed / no current prescriber"] },
      { id: "gahtTelehealth", type: "text", label: "Telehealth service name", showIf: (a) => a.gahtPrescriber === "Telehealth service" },
      { id: "gahtSelfManagedNote", type: "note", tone: "warn", text: "Self-managed GAHT without medical oversight carries significant cardiovascular, hematologic, and bone-health risks. We strongly recommend working with a qualified, affirming prescriber.", showIf: (a) => a.gahtPrescriber === "Self-managed / no current prescriber" },
      { id: "gahtDuration", type: "single", label: "How long have you been on GAHT?", options: ["< 6 months", "6-12 months", "1-3 years", "3-5 years", "5+ years", "N/A"] },
      { id: "gahtSurgeries", type: "multi", label: "Any gender-affirming surgeries? (select all that apply)", options: GAHT_SURGERIES, exclusive: ["None", "Prefer not to disclose"] },
      { id: "gahtOrganNote", type: "note", tone: "info", text: "Retained organs need anatomy-appropriate cancer screening regardless of gender identity — a cervix needs Pap smears, breast tissue needs mammography, a prostate needs PSA discussion, per age guidelines. We'll only schedule screenings for the anatomy you have.", showIf: (a) => Array.isArray(a.gahtSurgeries) && a.gahtSurgeries.length > 0 && !has(a, "gahtSurgeries", "Prefer not to disclose") },
    ],
  },
  {
    id: "trt",
    title: "Testosterone replacement therapy (TRT)",
    intro: "For testosterone used for replacement, optimization, or performance — prescribed or otherwise.",
    questions: [
      { id: "testosteroneUse", type: "single", label: "Are you currently using testosterone in any form?", options: ["No", "Yes — prescribed TRT", "Yes — self-administered (not prescribed)"] },
      { id: "trtForm", type: "multi", label: "What form of testosterone are you using? (select all that apply)", options: TRT_FORMS, showIf: (a) => a.testosteroneUse && a.testosteroneUse !== "No" },
      { id: "trtFormOther", type: "text", label: "Other testosterone form — specify", showIf: (a) => has(a, "trtForm", "Other") },
      { id: "trtDose", type: "dose", label: "Current dose and frequency", units: TRT_DOSE_UNITS, frequencies: DOSE_FREQUENCIES, amountPlaceholder: "200", showIf: (a) => a.testosteroneUse && a.testosteroneUse !== "No" },
      { id: "trtAncillaries", type: "multi", label: "Ancillary medications used with TRT (select all that apply)", options: TRT_ANCILLARIES, showIf: (a) => a.testosteroneUse && a.testosteroneUse !== "No" },
      { id: "trtAncillariesOther", type: "text", label: "Other ancillary medications — specify", showIf: (a) => has(a, "trtAncillaries", "Other") },
      { id: "trtManager", type: "single", label: "Who manages your TRT?", options: ["Urologist", "Endocrinologist", "Men's health / TRT clinic", "Primary care physician", "Telehealth TRT service", "Self-managed"], showIf: (a) => a.testosteroneUse && a.testosteroneUse !== "No" },
      { id: "trtTelehealth", type: "text", label: "Telehealth service name", showIf: (a) => a.trtManager === "Telehealth TRT service" },
      { id: "trtMonitorFreq", type: "single", label: "How often is your TRT monitored with bloodwork?", options: ["Every 3 months", "Every 6 months", "Annually", "Rarely / never", "Variable — I manage myself"], showIf: (a) => a.testosteroneUse && a.testosteroneUse !== "No" },
      { id: "trtKnowLevels", type: "single", label: "Do you know your most recent testosterone levels?", options: ["No", "Yes"], showIf: (a) => a.testosteroneUse && a.testosteroneUse !== "No" },
      { id: "trtTotalT", type: "text", label: "Total T (ng/dL)", showIf: (a) => a.testosteroneUse && a.testosteroneUse !== "No" && a.trtKnowLevels === "Yes" },
      { id: "trtFreeT", type: "text", label: "Free T (pg/mL or pmol/L)", showIf: (a) => a.testosteroneUse && a.testosteroneUse !== "No" && a.trtKnowLevels === "Yes" },
      { id: "trtHct", type: "text", label: "Most recent hematocrit (%) or hemoglobin (g/dL), if known", showIf: (a) => a.testosteroneUse && a.testosteroneUse !== "No" },
      { id: "trtHctNote", type: "note", tone: "warn", text: "Elevated hematocrit (>52%) from TRT significantly increases clotting risk (stroke, DVT, PE). Your reported value is above that threshold — please get this reviewed.", showIf: (a) => onTRT(a) && hctAbove52(a) },
      { id: "trtMonitorNote", type: "note", tone: "warn", text: "Testosterone raises hematocrit over time, which increases clotting risk. Without regular bloodwork that goes unseen — we'd recommend a panel every 3–6 months.", showIf: (a) => onTRT(a) && (a.trtMonitorFreq === "Rarely / never" || a.trtMonitorFreq === "Annually") },
    ],
  },
  {
    id: "peptides",
    title: "Peptide therapy",
    intro: "Most peptides are not FDA-approved and are sourced from research-chemical or compounding pharmacies. Reporting here is for monitoring and safety only — it is confidential and never shared with law enforcement or third parties. This platform does not prescribe peptides.",
    questions: [
      { id: "peptideUse", type: "single", label: "Are you currently using, or have you recently used, any peptide therapies?", options: ["No", "Yes — prescribed", "Yes — self-administered (research / grey market)"] },
      { id: "peptidesUsed", type: "multi", label: "Which peptides are you using? (select all that apply)", options: PEPTIDES, showIf: (a) => a.peptideUse && a.peptideUse !== "No" },
      { id: "peptidesOther", type: "text", label: "Other peptides not listed (name / source / dose if known)", showIf: (a) => has(a, "peptidesUsed", "Other — not listed") },
      { id: "peptideReason", type: "multi", label: "Primary reason for using peptides (select all that apply)", options: PEPTIDE_REASONS, showIf: (a) => a.peptideUse && a.peptideUse !== "No" },
      { id: "peptideReasonOther", type: "text", label: "Other reason — specify", showIf: (a) => has(a, "peptideReason", "Other") },
      { id: "peptideSource", type: "single", label: "Where do you source your peptides?", options: ["Compounding pharmacy (via prescription)", "Research chemical vendor online", "Overseas / international source", "From a practitioner directly", "Prefer not to say"], showIf: (a) => a.peptideUse && a.peptideUse !== "No" },
      { id: "peptideMonitored", type: "single", label: "Are any of your peptides monitored by a physician or practitioner?", options: ["Yes — all of them", "Yes — some of them", "No — fully self-managed"], showIf: (a) => a.peptideUse && a.peptideUse !== "No" },
      { id: "peptideSideEffects", type: "single", label: "Have you experienced any side effects from peptide use?", options: ["No", "Yes"], showIf: (a) => a.peptideUse && a.peptideUse !== "No" },
      { id: "peptideSideEffectsDetail", type: "text", label: "Describe the side effects", showIf: (a) => a.peptideUse && a.peptideUse !== "No" && a.peptideSideEffects === "Yes" },
    ],
  },
  {
    id: "family",
    title: "Family history",
    intro: "First-degree relatives (parents, siblings, children) and grandparents where known. Family history is one of the strongest predictors of personal risk.",
    questions: [
      { id: "familyEarlyCVD", type: "single", label: "Has any first-degree relative had a heart attack or stroke?", options: ["No", "Yes — before age 55 (male relative)", "Yes — before age 65 (female relative)", "Yes — after those ages", "Unknown"] },
      { id: "familyHistory", type: "multi", label: "Has any family member been diagnosed with the following? (select all that apply)", options: FAMILY_CONDITIONS, exclusive: ["None of the above known", "Unknown family history"] },
      { id: "familyCancerGenetics", type: "single", label: "For the cancer(s) above — was genetic testing (BRCA, Lynch, etc.) done?", options: ["No testing done", "Yes — positive result", "Yes — negative result", "Unknown"], showIf: (a) => familyCancerReported(a) },
      { id: "familySuddenCardiac", type: "single", label: "Has any family member had sudden cardiac death before age 50?", options: ["No", "Yes", "Unknown"] },
      { id: "familySuddenCardiacRel", type: "text", label: "Relationship", placeholder: "e.g. Father, maternal uncle", showIf: (a) => a.familySuddenCardiac === "Yes" },
      { id: "parentsDementia", type: "single", label: "Did either parent have Alzheimer's or dementia?", options: ["No", "One parent", "Both parents", "Unknown"] },
    ],
  },
  {
    id: "activity",
    title: "Physical activity",
    questions: [
      { id: "exercise", type: "single", label: "How many days per week do you do intentional exercise?", options: ["0 days", "1-2 days", "3-4 days", "5-6 days", "Daily"] },
      { id: "exerciseTypes", type: "multi", label: "What types of exercise do you primarily do? (select all that apply)", options: EXERCISE_TYPES },
      { id: "fitnessLevel", type: "single", label: "How would you rate your current fitness level?", options: ["Sedentary", "Lightly active", "Moderately active", "Very active", "Athlete / elite level"] },
    ],
  },
  {
    id: "nutrition",
    title: "Nutrition & diet",
    questions: [
      { id: "eatingPattern", type: "single", label: "Which best describes your current eating pattern?", options: ["No specific pattern", "Mediterranean", "Keto / low-carb", "Carnivore", "Vegan / plant-based", "Vegetarian", "Intermittent fasting", "Other"] },
      { id: "eatingPatternOther", type: "text", label: "Other eating pattern — specify", showIf: (a) => a.eatingPattern === "Other" },
      { id: "produceServings", type: "single", label: "Servings of vegetables and fruit per day, on average?", options: ["0-1", "2-3", "4-5", "6+"] },
      { id: "processedFoods", type: "single", label: "How often do you eat ultra-processed foods (fast food, packaged snacks, sugary drinks)?", options: ["Rarely / never", "1-2x/week", "3-4x/week", "Daily"] },
      { id: "foodSensitivities", type: "single", label: "Any known food sensitivities or intolerances?", options: ["No", "Yes"] },
      { id: "foodSensitivitiesList", type: "text", label: "List your food sensitivities", showIf: (a) => a.foodSensitivities === "Yes" },
    ],
  },
  {
    id: "sleep",
    title: "Sleep",
    questions: [
      { id: "sleepHours", type: "single", label: "How many hours of sleep do you average per night?", options: ["< 5 hours", "5-6 hours", "7-8 hours", "9+ hours"] },
      { id: "sleep", type: "single", label: "How would you rate your sleep quality overall?", options: ["Poor", "Fair", "Good", "Excellent"] },
      { id: "sleepIssues", type: "multi", label: "Do you experience any of the following? (select all that apply)", options: SLEEP_ISSUES },
    ],
  },
  {
    id: "substances",
    title: "Substance use",
    questions: [
      { id: "tobacco", type: "single", label: "Do you currently smoke cigarettes or use tobacco?", options: ["Never smoked", "Former smoker", "Current smoker", "Cigars / pipe / chew (non-cigarette)"] },
      { id: "tobaccoDetail", type: "text", label: "Quit year, or packs per day", showIf: (a) => a.tobacco === "Former smoker" || a.tobacco === "Current smoker" },
      { id: "vaping", type: "single", label: "Do you use e-cigarettes or vaping products?", options: ["No", "Occasionally", "Daily"] },
      { id: "alcohol", type: "single", label: "How many alcoholic drinks per week, on average?", options: ["0", "1-7 (low)", "8-14 (moderate)", "15-21 (heavy)", "22+ (very heavy)"] },
      { id: "substances", type: "multi", label: "Do you use recreational or non-prescribed substances? (select all that apply)", options: ["No", "Marijuana / cannabis", "Stimulants", "Opioids", "Other"] },
      { id: "substancesOther", type: "text", label: "Other substance — specify", showIf: (a) => has(a, "substances", "Other") },
    ],
  },
  {
    id: "mental",
    title: "Stress & mental health",
    questions: [
      { id: "stressLevel", type: "single", label: "How would you rate your current stress level?", options: ["Low", "Moderate", "High", "Very high / overwhelming"] },
      { id: "moodSymptoms", type: "single", label: "Do you currently experience symptoms of anxiety or depression?", options: ["No", "Mild symptoms", "Moderate — not treated", "Moderate — currently treated", "Severe symptoms"] },
      { id: "stressManagement", type: "multi", label: "Do you have a regular stress-management practice? (select all that apply)", options: STRESS_MANAGEMENT },
    ],
  },
  {
    id: "preventive",
    title: "Preventive care & screening history",
    questions: [
      { id: "lastPhysical", type: "single", label: "When was your last comprehensive physical / annual wellness visit?", options: ["Within the past year", "1-2 years ago", "2-5 years ago", "More than 5 years ago", "Never"] },
      { id: "lastBloodPanel", type: "single", label: "When was your last blood panel (lipids, glucose, CBC, metabolic)?", options: ["Within the past year", "1-2 years ago", "2-5 years ago", "5+ years ago / never"] },
      { id: "screeningsCompleted", type: "multi", label: "Which of the following have you completed? (select all that apply)", options: SCREENINGS_COMPLETED },
      { id: "vaccinations", type: "single", label: "Are you up to date on vaccinations?", options: ["Yes", "No / unsure", "Partially — some missing"] },
      { id: "hasPCP", type: "single", label: "Do you have a primary care physician you see regularly?", options: ["Yes", "No — I don't have one", "No — I use urgent care / specialists only"] },
    ],
  },
  {
    id: "environment",
    title: "Environmental & occupational health",
    questions: [
      { id: "livingEnvironment", type: "single", label: "What is your current living environment?", options: ["Urban", "Suburban", "Rural"] },
      { id: "exposures", type: "multi", label: "Are you currently exposed to any of the following? (select all that apply)", options: EXPOSURES },
      { id: "hearingProtection", type: "single", label: "Do you use hearing protection in loud environments?", options: ["N/A", "Always", "Sometimes", "Rarely / never"] },
      { id: "airQuality", type: "single", label: "How would you rate the air quality in your home and workplace?", options: ["Good", "Fair", "Poor (smoking, mold, poor ventilation)"] },
    ],
  },
  {
    id: "goals",
    title: "Health goals & priorities",
    questions: [
      { id: "goals", type: "multi", max: 3, label: "Your top health goals right now (choose up to three)", options: GOALS },
      { id: "motivation", type: "single", label: "How motivated are you to make significant lifestyle changes if recommended?", options: ["Not very motivated", "Somewhat motivated", "Very motivated", "Already highly optimized — looking for fine-tuning"] },
      { id: "barriers", type: "multi", max: 2, label: "Your biggest barriers to better health (choose up to two)", options: BARRIERS },
      { id: "additionalNotes", type: "textarea", label: "Anything else about your health history or concerns you want us to know?", placeholder: "Share anything that didn't fit the questions above..." },
    ],
  },
  {
    id: "aiConversation",
    title: "Tell us more",
    questions: [
      { id: "aiConversationNote", type: "note", tone: "info", text: "No form can capture everything. After you submit, your AI health companion will read your full profile and open a private, judgment-free conversation — inviting you to share your health story, concerns, and anything that didn't fit above. You can return to it anytime from your dashboard." },
    ],
  },
];

// Build the initial answers object with correct empty types for every question.
export function emptyAnswers() {
  const a = {};
  for (const section of INTAKE_SECTIONS) {
    for (const q of section.questions) {
      if (q.type === "multi" || q.type === "chips" || q.type === "tokens") a[q.id] = [];
      else if (q.type === "note") continue;
      else a[q.id] = "";
    }
  }
  return a;
}

/** True when an answer holds nothing the user actually entered. */
export function isBlankAnswer(v) {
  if (v == null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v).every((x) => x == null || x === "");
  return false;
}

/**
 * Answer keys whose question is currently hidden by a showIf branch.
 *
 * A hidden branch's answers are stale — the user has since said something that
 * contradicts them (e.g. switching testosterone use back to "No" while a dose is
 * still recorded). Callers clear these so contradictory data never reaches the
 * database or the AI prompt.
 */
export function hiddenAnswerKeys(answers, profile) {
  const hidden = [];
  for (const section of INTAKE_SECTIONS) {
    const sectionVisible = !section.showIf || section.showIf(answers, profile);
    for (const q of section.questions) {
      if (q.type === "note") continue;
      const visible = sectionVisible && (!q.showIf || q.showIf(answers, profile));
      if (!visible) hidden.push(q.id);
    }
  }
  return hidden;
}

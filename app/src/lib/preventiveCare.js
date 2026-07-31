import { Home } from "lucide-react";

// ---- PREVENTIVE CARE ENGINE ----
// Builds a personalized screening schedule from age, sex, and a small set of
// risk factors. Source: USPSTF guidelines, ACS recommendations, ATA, and ACR.
// This runs entirely from onboarding inputs with no external API or wearable needed,
// which is why it belongs in the MVP rather than the place-marked section.
function buildPreventiveCareSchedule(profile) {
  const { age, sex, smoker, familyEarlyHeartDisease, familyOrPersonalCancer, diabetesOrPrediabetes } = profile;
  const items = [];

  // COLORECTAL — family or personal cancer history moves screening start to 40
  const colonAge = familyOrPersonalCancer ? 40 : 45;
  if (age >= colonAge) {
    items.push({
      id: "colonoscopy", category: "Cancer screening",
      name: "Colonoscopy",
      frequency: "Every 10 years (or FIT test annually)",
      startAge: colonAge,
      note: familyOrPersonalCancer ? "Earlier start due to personal or family cancer history" : "Average risk",
      urgency: age >= colonAge + 2 ? "overdue" : "due_soon",
    });
  }

  // BREAST
  if (sex === "female" && age >= 40) {
    items.push({
      id: "mammogram", category: "Cancer screening",
      name: "Mammogram",
      frequency: "Annually from 40",
      startAge: 40,
      note: familyOrPersonalCancer ? "Given personal or family cancer history, discuss earlier or more frequent screening with your physician" : "Average risk",
      urgency: "due_soon",
    });
  }

  // CERVICAL
  if (sex === "female" && age >= 21 && age <= 65) {
    items.push({
      id: "pap", category: "Cancer screening",
      name: "Pap smear / cervical screening",
      frequency: "Every 3 years (or every 5 years with HPV co-test from age 30)",
      startAge: 21,
      note: "Stops at 65 with adequate prior screening history",
      urgency: "due_soon",
    });
  }

  // LUNG
  if (age >= 50 && age <= 80 && smoker) {
    items.push({
      id: "lung_ct", category: "Cancer screening",
      name: "Annual low-dose lung CT scan",
      frequency: "Annually",
      startAge: 50,
      note: "For current or former smokers with 20+ pack-year history",
      urgency: "due_soon",
    });
  }

  // PROSTATE
  if (sex === "male" && age >= 40) {
    const psa_age = familyOrPersonalCancer ? 40 : 50;
    items.push({
      id: "psa", category: "Cancer screening",
      name: "PSA / prostate discussion",
      frequency: "Shared decision with your physician",
      startAge: psa_age,
      note: familyOrPersonalCancer ? "Given your cancer history, discuss PSA testing earlier with your physician" : "Not automatic — discuss with your doctor whether testing is right for you",
      urgency: (familyOrPersonalCancer && age >= 40) || age >= 55 ? "due_soon" : "upcoming",
    });
  }

  // SKIN
  if (age >= 35) {
    items.push({
      id: "derm", category: "Cancer screening",
      name: "Annual skin cancer / dermatology exam",
      frequency: "Annually",
      startAge: 35,
      note: "Full-body skin check by a dermatologist",
      urgency: "due_soon",
    });
  }

  // CARDIOVASCULAR
  items.push({
    id: "bp", category: "Cardiovascular",
    name: "Blood pressure check",
    frequency: "Annually",
    startAge: 18,
    note: "Home monitoring counts if done consistently",
    urgency: "due_soon",
  });

  if (age >= 20) {
    items.push({
      id: "lipids", category: "Cardiovascular",
      name: "Full lipid panel (including ApoB and Lp(a))",
      frequency: familyEarlyHeartDisease ? "Annually given family history" : "Every 5 years if normal, more often with risk factors",
      startAge: 20,
      note: familyEarlyHeartDisease ? "Family history of early heart disease significantly elevates your risk — ApoB and Lp(a) are especially important to track" : "ApoB and Lp(a) are often skipped at routine physicals but are among the strongest predictors of cardiovascular risk",
      urgency: familyEarlyHeartDisease || age >= 30 ? "due_soon" : "upcoming",
    });
  }

  if (sex === "male" && age >= 65) {
    items.push({
      id: "aaa", category: "Cardiovascular",
      name: "Abdominal aortic aneurysm ultrasound",
      frequency: "One-time screening",
      startAge: 65,
      note: "Recommended once for men 65-75 who have ever smoked",
      urgency: smoker ? "due_soon" : "upcoming",
    });
  }

  // METABOLIC
  const glucoseStart = diabetesOrPrediabetes ? 18 : 35;
  if (age >= glucoseStart) {
    items.push({
      id: "glucose", category: "Metabolic",
      name: "Fasting glucose / HbA1c",
      frequency: diabetesOrPrediabetes ? "Annually" : "Every 3 years from 35, more often with risk factors",
      startAge: glucoseStart,
      note: diabetesOrPrediabetes ? "Given your personal or family history of diabetes, annual monitoring is important" : "Earlier with family history of diabetes or excess weight",
      urgency: diabetesOrPrediabetes ? "overdue" : "due_soon",
    });
  }

  // BONE
  const dexaAge = sex === "female" ? 65 : 70;
  if (age >= dexaAge - 5) {
    items.push({
      id: "dexa", category: "Bone health",
      name: "DEXA bone density scan",
      frequency: "Every 2 years or as directed",
      startAge: dexaAge,
      note: sex === "male" ? "Earlier if on long-term steroids or testosterone therapy" : "Standard recommendation for women at 65",
      urgency: age >= dexaAge ? "due_soon" : "upcoming",
    });
  }

  // VISION
  if (age >= 40) {
    items.push({
      id: "eye", category: "Vision",
      name: "Comprehensive eye exam",
      frequency: "Every 1-2 years from 40, annually from 60",
      startAge: 40,
      note: "Includes glaucoma screening — risk increases with age",
      urgency: age >= 60 ? "due_soon" : "upcoming",
    });
  }

  // HEARING
  if (age >= 50) {
    items.push({
      id: "hearing", category: "Hearing",
      name: "Baseline audiogram / hearing test",
      frequency: "Baseline at 50, every 3 years if normal, annually if loss detected",
      startAge: 50,
      note: "Untreated hearing loss is one of the most modifiable risk factors for cognitive decline",
      urgency: age >= 55 ? "due_soon" : "upcoming",
    });
  }

  // DENTAL
  items.push({
    id: "dental", category: "Dental",
    name: "Dental cleaning and exam",
    frequency: "Twice per year",
    startAge: 0,
    note: "Oral health connects directly to cardiovascular and metabolic outcomes",
    urgency: "due_soon",
  });

  // MENTAL HEALTH
  items.push({
    id: "mental", category: "Mental health",
    name: "Depression and anxiety screening",
    frequency: "Annually",
    startAge: 18,
    note: "USPSTF grade B recommendation — often skipped at routine visits",
    urgency: "upcoming",
  });

  // THYROID
  if (age >= 35) {
    items.push({
      id: "thyroid", category: "Thyroid",
      name: "TSH thyroid screening",
      frequency: "Every 5 years from 35 (American Thyroid Association)",
      startAge: 35,
      note: "Not universally ordered at annual physicals — worth requesting specifically",
      urgency: age >= 40 ? "due_soon" : "upcoming",
    });
  }

  // IMMUNIZATIONS
  items.push({ id: "flu", category: "Immunizations", name: "Annual flu vaccine", frequency: "Annually, every fall", startAge: 0, note: "Best protection when given before flu season peaks", urgency: "due_soon" });
  if (age >= 50) items.push({ id: "shingrix", category: "Immunizations", name: "Shingles vaccine (Shingrix)", frequency: "Two-dose series, then done", startAge: 50, note: "Two doses 2-6 months apart — highly effective", urgency: "due_soon" });
  if (age >= 60) items.push({ id: "rsv", category: "Immunizations", name: "RSV vaccine", frequency: "Single dose", startAge: 60, note: "Newer recommendation — often not yet on standard checklists", urgency: "due_soon" });
  items.push({ id: "tdap", category: "Immunizations", name: "Tdap booster", frequency: "Every 10 years", startAge: 18, note: "Covers tetanus, diphtheria, and pertussis", urgency: "upcoming" });

  return items;
}

export { buildPreventiveCareSchedule };

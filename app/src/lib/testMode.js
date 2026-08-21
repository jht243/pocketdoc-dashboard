import { buildPreventiveCareSchedule } from "./preventiveCare";
import { isConfigured, supabase } from "./supabase";
import { calculateBloodworkScore } from "./bloodworkScore";
import { calculateWearableScore } from "./wearableScore";

// Test data intentionally lives in its own table. It must never be mixed with a
// person's real profile, uploads, or screenings just to make the demo look full.
const DEMO_PROFILE = {
  name: "Adam Locker",
  dob: "1974-04-12",
  sex: "male",
  smoker: false,
  familyEarlyHeartDisease: true,
  familyOrPersonalCancer: false,
  diabetesOrPrediabetes: false,
};

const DEMO_INTAKE = {
  conditions: ["Hashimoto's thyroiditis", "High cholesterol"],
  medications: ["Rosuvastatin 10mg", "Testosterone cypionate", "Vitamin D3 + K2"],
  familyHistory: ["Heart disease", "Type 2 diabetes"],
  pastEvents: "Appendectomy (2014)",
  primaryConcern: "Understand my energy, thyroid trend, and cardiovascular risk.",
  exercise: "4–5 sessions per week",
  sleep: "Usually 7–8 hours",
  conditionInput: "",
  medInput: "",
};

const TEST_SNAPSHOT_VERSION = 5;

// Dated relative to the demo's "today" so the bloodwork score reads as current
// rather than ageing into its stale state as the snapshot sits in the repo.
const DEMO_LAB_DATE = "2026-06-14T00:00:00.000Z";
const demoLab = (name, value, unit, status) => ({
  name, value, unit, status, date: "Jun 2026", created_at: DEMO_LAB_DATE,
});

const DEMO_LABS = [
  demoLab("ApoB", "78", "mg/dL", "normal"),
  demoLab("Lp(a)", "18", "mg/dL", "normal"),
  demoLab("Triglycerides", "134", "mg/dL", "normal"),
  demoLab("HDL Cholesterol", "51", "mg/dL", "normal"),
  demoLab("LDL Cholesterol", "104", "mg/dL", "high"),
  demoLab("Hemoglobin A1c", "5.6", "%", "normal"),
  demoLab("Glucose, Fasting", "97", "mg/dL", "normal"),
  demoLab("Fasting Insulin", "9.4", "uIU/mL", "high"),
  demoLab("hs-CRP", "1.8", "mg/L", "high"),
  demoLab("eGFR", "88", "mL/min/1.73", "normal"),
  demoLab("ALT (SGPT)", "34", "U/L", "high"),
  demoLab("Vitamin D", "28", "ng/mL", "low"),
  demoLab("Ferritin", "62", "ng/mL", "normal"),
  demoLab("TSH", "2.1", "mIU/L", "normal"),
  demoLab("TPO antibodies", "118", "IU/mL", "high"),
];

/**
 * 21 days of raw daily rows behind the demo's numbers.
 *
 * The wearable score is calculated, never hand-written: a snapshot with a typed-in
 * score would drift from the rubric the moment a weight changed, and the demo would
 * then be showing a number the live engine could not produce. These rows put the
 * demo member where the copy already says he is — HRV drifting down and resting
 * heart rate climbing over the last few days, on top of a steady prior fortnight.
 */
function demoWearableRows() {
  const rows = [];
  for (let i = 0; i < 21; i += 1) {
    const date = new Date("2026-08-21T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - i);
    // The last four days carry the decline the demo's vitals chips describe.
    const declining = i < 4;
    rows.push({
      day: date.toISOString().slice(0, 10),
      source: "oura",
      hrv_ms: declining ? 42 + i * 2 : 50 + ((i % 5) - 2),
      resting_hr: declining ? 64 - i : 52 + ((i % 3) - 1),
      average_hr: 58,
      sleep_efficiency: 0.91,
      total_sleep_minutes: declining ? 452 : 448 + ((i % 6) * 5),
      deep_sleep_minutes: 78,
      rem_sleep_minutes: 96,
      awake_minutes: 41,
      spo2_percent: 96,
      temp_deviation_c: declining ? 0.4 : 0.1,
      steps: 8420 - ((i % 4) * 300),
      active_calories: 512,
      medium_activity_minutes: 44,
      high_activity_minutes: 12,
      zone2_minutes: 56,
      sleep_score: 82,
      readiness_score: declining ? 68 : 78,
      activity_score: 88,
    });
  }
  return rows;
}

function completedSchedule() {
  const schedule = buildPreventiveCareSchedule({
    ...DEMO_PROFILE,
    age: 52,
  }).map((item) => ({ ...item, urgency: "done" }));
  return {
    schedule,
    completedItems: Object.fromEntries(schedule.map((item) => [item.id, true])),
  };
}

export function createTestSnapshot() {
  const { schedule, completedItems } = completedSchedule();
  const wearableRows = demoWearableRows();
  const wearableScore = calculateWearableScore(wearableRows[0], wearableRows);
  // Same rule as the wearable score: calculated by the live engine, never typed in.
  const bloodworkScore = calculateBloodworkScore(DEMO_LABS, { sex: DEMO_PROFILE.sex });
  return {
    version: TEST_SNAPSHOT_VERSION,
    profile: {
      profile: DEMO_PROFILE,
      intake: DEMO_INTAKE,
      schedule,
      completedItems,
      onboardingStep: 5,
      onboardingCompletedAt: "2026-07-20T14:00:00.000Z",
    },
    healthHistory: {
      conditions: DEMO_INTAKE.conditions,
      medications: DEMO_INTAKE.medications,
      pastEvents: DEMO_INTAKE.pastEvents,
    },
    health: {
      vitals: [
        { label: "HRV", value: "42ms", sub: "8ms below baseline", color: "warning" },
        { label: "RHR", value: "64 bpm", sub: "+12 vs baseline", color: "warning" },
        { label: "Readiness", value: "68", sub: "Below typical", color: "warning" },
      ],
      today: {
        readiness: 68,
        readinessTypical: 78,
        restingHR: 64,
        restingHRBaseline: 52,
        averageHR: 58,
        hrv: 42,
        hrvBaseline: 50,
        skinTempDeviation: 0.4,
        spo2: 96,
        sleepScore: 82,
        sleepEfficiency: 0.91,
        totalSleepMinutes: 452,
        timeInBedMinutes: 483,
        deepSleepMinutes: 78,
        remSleepMinutes: 96,
        awakeMinutes: 41,
        activityScore: 88,
        steps: 8420,
        activeCalories: 512,
        mediumActivityMinutes: 44,
        highActivityMinutes: 12,
        zone2Minutes: 56,
        strainYesterday: "high",
        zone2MinutesPlanned: 30,
        vitaminD: 28,
        tpoAntibodiesTrend: "rising",
        recentSymptoms: ["fatigue", "cold sensitivity"],
        nutritionEnabled: false,
        nutritionLoggedToday: false,
        proteinLowOnTrainingDays: true,
        bodyFatTrend: "down",
        weightTrend: "flat",
        goalAchieved: false,
      },
      // The raw daily rows the demo score was calculated from. Present so the Body
      // screen, the AI context and the score all read the same underlying days
      // rather than the score being the only thing with history behind it.
      history: wearableRows,
      // Latest reading + trailing 30-day range for every collected metric — powers the
      // "All collected metrics" expander on the Body screen in test mode.
      metrics: [
        { key: "readiness_score", label: "Readiness", current: "68", low: "61", typical: "78", high: "88", samples: 30 },
        { key: "sleep_score", label: "Sleep score", current: "82", low: "64", typical: "80", high: "91", samples: 30 },
        { key: "activity_score", label: "Activity score", current: "88", low: "70", typical: "84", high: "95", samples: 30 },
        { key: "hrv_ms", label: "HRV", current: "42 ms", low: "38 ms", typical: "50 ms", high: "61 ms", samples: 30 },
        { key: "resting_hr", label: "Resting heart rate", current: "64 bpm", low: "50 bpm", typical: "53 bpm", high: "66 bpm", samples: 30 },
        { key: "average_hr", label: "Avg heart rate (sleep)", current: "58 bpm", low: "54 bpm", typical: "59 bpm", high: "67 bpm", samples: 30 },
        { key: "total_sleep_minutes", label: "Total sleep", current: "7h 32m", low: "5h 48m", typical: "7h 20m", high: "8h 41m", samples: 30 },
        { key: "deep_sleep_minutes", label: "Deep sleep", current: "1h 18m", low: "42m", typical: "1h 22m", high: "1h 51m", samples: 30 },
        { key: "rem_sleep_minutes", label: "REM sleep", current: "1h 36m", low: "58m", typical: "1h 40m", high: "2h 12m", samples: 30 },
        { key: "awake_minutes", label: "Awake time", current: "41 min", low: "18 min", typical: "38 min", high: "72 min", samples: 30 },
        { key: "sleep_efficiency", label: "Sleep efficiency", current: "91%", low: "84%", typical: "92%", high: "97%", samples: 30 },
        { key: "spo2_percent", label: "Blood oxygen (SpO₂)", current: "96%", low: "94%", typical: "96%", high: "98%", samples: 30 },
        { key: "temp_deviation_c", label: "Skin temp deviation", current: "0.4°C", low: "-0.3°C", typical: "0.1°C", high: "0.6°C", samples: 30 },
        { key: "steps", label: "Steps", current: "8,420", low: "3,110", typical: "7,900", high: "14,220", samples: 30 },
        { key: "active_calories", label: "Active calories", current: "512 kcal", low: "180 kcal", typical: "480 kcal", high: "820 kcal", samples: 30 },
        { key: "medium_activity_minutes", label: "Medium activity", current: "44 min", low: "12 min", typical: "40 min", high: "88 min", samples: 30 },
        { key: "high_activity_minutes", label: "High activity", current: "12 min", low: "0 min", typical: "9 min", high: "34 min", samples: 30 },
        { key: "zone2_minutes", label: "Active minutes (MET 4+)", current: "56 min", low: "14 min", typical: "49 min", high: "102 min", samples: 30 },
      ],
      score: {
        baseItems: [
          { name: "Annual physical", status: "current", detail: "Completed Mar 2026", pts: 8, max: 8 },
          { name: "Comprehensive bloodwork", status: "current", detail: "Completed Jan 2026", pts: 8, max: 8 },
          { name: "TRT monitoring panel", status: "current", detail: "Completed Jul 2026", pts: 8, max: 8 },
          { name: "Colonoscopy", status: "current", detail: "Completed May 2026", pts: 10, max: 10 },
          { name: "PSA screening", status: "current", detail: "Completed Mar 2026", pts: 8, max: 8 },
          { name: "Skin cancer screening", status: "current", detail: "Completed Apr 2026", pts: 8, max: 8 },
        ],
        // Calculated from `wearableRows` by the same engine the live app runs, so the
        // demo can never show a score the rubric wouldn't produce.
        wearable: wearableScore,
        bloodwork: bloodworkScore,
        sleepScore: 82,
        sleepNote: "Good night last night",
        zone2Minutes: 34,
        wakeupLogged: true,
        wakeupNote: "Felt rested",
      },
      // A realistic panel rather than a handful of markers: the bloodwork score
      // withholds itself below a minimum coverage, so a five-marker demo would have
      // shown the empty state forever and never exercised the thing it demonstrates.
      // TPO antibodies and the lipid fractions aren't scored — they're here because a
      // real panel carries plenty the rubric doesn't weight.
      labs: DEMO_LABS,
      labHistory: [
        {
          name: "TPO antibodies",
          unit: "IU/mL",
          results: [
            { date: "Apr 2025", value: 64 },
            { date: "Oct 2025", value: 91 },
            { date: "Jan 2026", value: 118 },
          ],
        },
        {
          name: "TSH",
          unit: "mIU/L",
          results: [
            { date: "Apr 2025", value: 2.0 },
            { date: "Oct 2025", value: 2.2 },
            { date: "Jan 2026", value: 2.1 },
          ],
        },
      ],
      body: {
        weight: "202 lb", weightGoal: "195 lb", bodyFat: "17.5%", bodyFatGoal: "14%", vo2Max: "46.2",
        // Weekly readings (oldest → today) powering the tap-in trend view in test mode.
        weightSeries: [211, 210, 209, 208.5, 207, 206, 205.5, 204, 203.5, 203, 202.5, 202],
        bodyFatSeries: [19.8, 19.5, 19.1, 18.8, 18.5, 18.2, 17.9, 17.8, 17.7, 17.6, 17.5, 17.5],
      },
      genetics: [
        "MTHFR C677T heterozygous — methylfolate is preferred over folic acid.",
        "VDR Taq1 TT — vitamin D status deserves closer follow-up.",
        "CYP1A2 slow metabolizer — late caffeine can affect sleep and recovery.",
        "SLCO1B1 variant — discuss statin tolerance with the prescriber.",
      ],
      medications: [
        { name: "Rosuvastatin", dose: "10mg", frequency: "Nightly", type: "prescription" },
        { name: "Testosterone cypionate", dose: "As prescribed", frequency: "Weekly", type: "prescription" },
        { name: "Vitamin D3 + K2", dose: "5,000 IU", frequency: "Daily", type: "supplement" },
      ],
      records: [
        { name: "Comprehensive panel, Jan 2026", type: "Lab result" },
        { name: "Endocrinology visit notes", type: "Appointment note" },
        { name: "Thyroid panel, Oct 2025", type: "Lab result" },
      ],
    },
  };
}

export async function loadTestModeSnapshot(userId) {
  if (!isConfigured || !userId) return { enabled: false, snapshot: null };
  const { data, error } = await supabase
    .from("test_mode_snapshots")
    .select("enabled, snapshot")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("loadTestModeSnapshot", error);
    return { enabled: false, snapshot: null, error };
  }
  return { enabled: Boolean(data?.enabled), snapshot: data?.snapshot || null };
}

export async function enableTestMode(userId) {
  if (!isConfigured || !userId) return { snapshot: null, error: new Error("not configured") };
  const current = await loadTestModeSnapshot(userId);
  const snapshot = current.snapshot?.version >= TEST_SNAPSHOT_VERSION
    ? current.snapshot
    : createTestSnapshot();
  const { error } = await supabase.from("test_mode_snapshots").upsert(
    {
      user_id: userId,
      enabled: true,
      snapshot,
      seeded_at: current.snapshot?.version >= TEST_SNAPSHOT_VERSION ? undefined : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) console.error("enableTestMode", error);
  return { snapshot, error };
}

export async function disableTestMode(userId) {
  if (!isConfigured || !userId) return { error: null };
  const { error } = await supabase
    .from("test_mode_snapshots")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) console.error("disableTestMode", error);
  return { error };
}

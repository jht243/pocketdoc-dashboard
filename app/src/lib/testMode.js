import { buildPreventiveCareSchedule } from "./preventiveCare";
import { isConfigured, supabase } from "./supabase";

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

const TEST_SNAPSHOT_VERSION = 2;

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
        hrv: 42,
        hrvBaseline: 50,
        skinTempDeviation: 0.4,
        sleepEfficiency: 0.91,
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
      score: {
        baseItems: [
          { name: "Annual physical", status: "current", detail: "Completed Mar 2026", pts: 8, max: 8 },
          { name: "Comprehensive bloodwork", status: "current", detail: "Completed Jan 2026", pts: 8, max: 8 },
          { name: "TRT monitoring panel", status: "current", detail: "Completed Jul 2026", pts: 8, max: 8 },
          { name: "Colonoscopy", status: "current", detail: "Completed May 2026", pts: 10, max: 10 },
          { name: "PSA screening", status: "current", detail: "Completed Mar 2026", pts: 8, max: 8 },
          { name: "Skin cancer screening", status: "current", detail: "Completed Apr 2026", pts: 8, max: 8 },
        ],
        sleepScore: 82,
        sleepNote: "Good night last night",
        zone2Minutes: 34,
        wakeupLogged: true,
        wakeupNote: "Felt rested",
      },
      labs: [
        { name: "Vitamin D", value: "28", unit: "ng/mL", status: "low", date: "Jan 2026" },
        { name: "TSH", value: "2.1", unit: "mIU/L", status: "normal", date: "Jan 2026" },
        { name: "TPO antibodies", value: "118", unit: "IU/mL", status: "high", date: "Jan 2026" },
        { name: "ApoB", value: "78", unit: "mg/dL", status: "normal", date: "Jan 2026" },
        { name: "Ferritin", value: "62", unit: "ng/mL", status: "normal", date: "Jan 2026" },
      ],
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
      body: { weight: "202 lb", weightGoal: "195 lb", bodyFat: "17.5%", bodyFatGoal: "14%", vo2Max: "46.2" },
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

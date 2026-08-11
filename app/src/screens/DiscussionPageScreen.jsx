import React, { useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, FileText, Sparkles, Upload } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";
import { callAI, firstText } from "../lib/api";

// ---- DISCUSSION PAGE (for next doctor appointment) ----
// The Summary and Suggested questions are generated from the user's real profile,
// labs, and device data via the OpenAI gateway. Symptom pattern and device signals
// are read from healthData where present, with a graceful fallback when the app is
// running without a populated snapshot.

// Build a compact, model-readable description of everything we know about the user.
function buildContext(userProfile, healthData) {
  const profile = userProfile?.profile || {};
  const intake = userProfile?.intake || {};
  const today = healthData?.today;

  const age = profile.dob
    ? new Date().getFullYear() - new Date(profile.dob).getFullYear()
    : "unknown";

  const labs = healthData?.labs?.length
    ? healthData.labs.map((l) => `- ${l.name}: ${l.value} ${l.unit} (${l.status}, ${l.date})`).join("\n")
    : "No lab results on file.";

  const labTrends = healthData?.labHistory?.length
    ? healthData.labHistory
        .map((s) => {
          const vals = (s.results || []).map((r) => `${r.value}`).join(" → ");
          return `- ${s.name}: ${vals} ${s.unit || ""}`.trim();
        })
        .join("\n")
    : "No longitudinal lab trends on file.";

  const vitals = today
    ? `Readiness ${today.readiness} (typical ${today.readinessTypical}); HRV ${today.hrv}ms (baseline ${today.hrvBaseline}); resting heart rate ${today.restingHR} bpm (baseline ${today.restingHRBaseline}); overnight skin-temp deviation ${today.skinTempDeviation}°F.`
    : "No wearable/device data connected.";

  const symptoms = today?.recentSymptoms?.length
    ? today.recentSymptoms.join(", ")
    : "None recorded.";

  return `PATIENT: ${profile.name || "Unknown"}, ${age} years old, ${profile.sex || "unspecified"}
CONDITIONS: ${(intake.conditions || []).join(", ") || "None recorded"}
MEDICATIONS: ${(intake.medications || []).join(", ") || "None recorded"}
FAMILY HISTORY: ${(intake.familyHistory || []).join(", ") || "None recorded"}
PRIMARY CONCERN: ${intake.primaryConcern || "None recorded"}
RECENTLY REPORTED SYMPTOMS: ${symptoms}

CURRENT LABS:
${labs}

LAB TRENDS (oldest → newest):
${labTrends}

DEVICE / VITALS:
${vitals}`;
}

// Static content used when no real snapshot is available (keeps the demo intact).
const FALLBACK = {
  summary:
    "Over the past 6 weeks, fatigue and cold sensitivity have been reported repeatedly in daily check-ins, alongside a steady rise in TPO antibodies across the last 3 lab panels while TSH has stayed in normal range. Device data shows a parallel rise in resting heart rate and reduced HRV. None of these signals alone would stand out at a single visit. Together, they're a pattern worth discussing — not a diagnosis, but a reason to ask whether further testing is warranted.",
  questions: [
    "Given the rising TPO antibodies, should we run a full thyroid antibody panel and consider a thyroid ultrasound?",
    "Could the fatigue and cold sensitivity be related, even with TSH in normal range?",
    "Is there a reason to monitor more frequently given the 6-week trend?",
  ],
};

const FALLBACK_SYMPTOMS = [
  { date: "Jun 14", note: "Fatigue, cold sensitivity" },
  { date: "Jun 19", note: "Mild fatigue, brain fog" },
  { date: "Jun 23", note: "Cold sensitivity, hair thinning noted" },
  { date: "Jun 27", note: "Fatigue, low mood, cold sensitivity" },
];

const FALLBACK_SIGNALS = [
  { label: "Resting heart rate", detail: "Trending up 6 bpm over 3 weeks", source: "Oura" },
  { label: "Overnight body temp", detail: "Elevated 2 of last 4 nights", source: "Oura" },
  { label: "HRV", detail: "Below baseline 5 of last 7 days", source: "Oura" },
  { label: "Sleep quality", detail: "Restorative sleep down 14% over 2 weeks", source: "Eight Sleep" },
];

function DiscussionPageScreen({ setActive, userProfile, healthData }) {
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(FALLBACK.summary);
  const [questions, setQuestions] = useState(FALLBACK.questions);

  const hasRealData = Boolean(userProfile?.profile || healthData?.today || healthData?.labs?.length);

  // Device signals derived from real vitals where we have them.
  const today = healthData?.today;
  const deviceSignals = today
    ? [
        today.restingHR != null && {
          label: "Resting heart rate",
          detail: `${today.restingHR} bpm (baseline ${today.restingHRBaseline})`,
          source: "Device",
        },
        today.hrv != null && {
          label: "HRV",
          detail: `${today.hrv}ms (baseline ${today.hrvBaseline})`,
          source: "Device",
        },
        today.skinTempDeviation != null && {
          label: "Overnight body temp",
          detail: `${today.skinTempDeviation > 0 ? "+" : ""}${today.skinTempDeviation}°F vs. baseline`,
          source: "Device",
        },
        today.readiness != null && {
          label: "Readiness",
          detail: `${today.readiness} (typical ${today.readinessTypical})`,
          source: "Device",
        },
      ].filter(Boolean)
    : FALLBACK_SIGNALS;

  const symptomPattern =
    today?.recentSymptoms?.length
      ? today.recentSymptoms.map((note) => ({ date: "Recent", note }))
      : FALLBACK_SYMPTOMS;

  useEffect(() => {
    if (!hasRealData) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const context = buildContext(userProfile, healthData);
        const data = await callAI({
          system:
            "You are a health advocate preparing a patient for a doctor's appointment. From the data provided, write a concise visit-prep summary and a short list of specific questions the patient should raise. You are not a clinician: never diagnose or prescribe, and frame everything as a pattern worth discussing. Reference the patient's actual values where relevant. Respond with ONLY a JSON object, no markdown or backticks, of the exact shape: {\"summary\": \"one paragraph, 4-6 sentences\", \"questions\": [\"...\", \"...\", \"...\"]}. Provide 3 to 4 questions.",
          messages: [{ role: "user", content: [{ type: "text", text: context }] }],
          maxTokens: 700,
        });
        const raw = firstText(data, "").replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(raw);
        if (!cancelled && parsed?.summary && Array.isArray(parsed?.questions)) {
          setSummary(parsed.summary);
          setQuestions(parsed.questions);
        }
      } catch {
        // Keep the fallback content on any failure — the page still renders.
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasRealData, userProfile, healthData]);

  const privateLabFiles = [
    { name: "Thyroid antibody panel, self-pay", date: "Jun 21, 2026", source: "Quest Diagnostics (direct order)", size: "412 KB" },
    { name: "Comprehensive metabolic panel", date: "Jun 21, 2026", source: "Quest Diagnostics (direct order)", size: "286 KB" },
  ];

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("records")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Records
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Discussion page</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
        For your next appointment
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 22 }}>
        A summary of what's been reported, the pattern across it, and private labs to share.
      </div>

      <SectionLabel>Summary</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.gold}50`, background: COLORS.warnDim }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Sparkles size={18} color={COLORS.gold} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
            {loading ? "Preparing your summary from your latest data…" : summary}
          </div>
        </div>
      </Card>

      <SectionLabel>Reported symptom pattern</SectionLabel>
      <Card>
        {symptomPattern.map((s, i) => (
          <div key={`${s.date}-${i}`} style={{
            display: "flex", gap: 12, padding: "9px 0",
            borderBottom: i < symptomPattern.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, width: 48, flexShrink: 0 }}>{s.date}</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{s.note}</span>
          </div>
        ))}
      </Card>

      <SectionLabel>Device signals</SectionLabel>
      <Card>
        {deviceSignals.map((w, i) => (
          <div key={w.label} style={{
            display: "flex", justifyContent: "space-between", padding: "9px 0",
            borderBottom: i < deviceSignals.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div>
              <span style={{ fontSize: 13 }}>{w.label}</span>
              <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 6 }}>({w.source})</span>
            </div>
            <span style={{ fontSize: 12, color: COLORS.warning }}>{w.detail}</span>
          </div>
        ))}
      </Card>

      <SectionLabel>Suggested questions to raise</SectionLabel>
      <Card>
        {(loading ? FALLBACK.questions : questions).map((q, i, arr) => (
          <div key={i} style={{
            display: "flex", gap: 8, padding: "9px 0",
            borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 13, color: COLORS.gold, flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>{q}</span>
          </div>
        ))}
      </Card>

      <SectionLabel>Private lab files to share</SectionLabel>
      <Card>
        {privateLabFiles.map((f, i) => (
          <div key={f.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: i < privateLabFiles.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <FileText size={16} color={COLORS.tealLight} />
              <div>
                <div style={{ fontSize: 13 }}>{f.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{f.source} &middot; {f.date} &middot; {f.size}</div>
              </div>
            </div>
            <ChevronRight size={14} color={COLORS.textMuted} />
          </div>
        ))}
      </Card>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
        These were ordered and paid for directly, outside insurance, and haven't yet been
        seen by your doctor.
      </div>

      <button onClick={() => setShared(true)} style={{
        width: "100%", background: shared ? COLORS.bgCardAlt : COLORS.teal,
        border: shared ? `1px solid ${COLORS.tealLight}` : "none",
        color: shared ? COLORS.tealLight : COLORS.onAccent,
        fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>
        {shared ? <CheckCircle2 size={16} /> : <Upload size={16} />}
        {shared ? "Ready to share" : "Share / Export as PDF"}
      </button>
      {shared && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 10, textAlign: "center" }}>
          Export as PDF, email it directly to your provider, or print for your visit.
        </div>
      )}

      <div style={{
        marginTop: 20, padding: 12, background: COLORS.bgCardAlt, borderRadius: 10,
        fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5
      }}>
        This page summarizes patterns in your reported symptoms and data. It is not a
        diagnosis and does not replace clinical judgment. Only a licensed provider can
        diagnose or treat a medical condition.
      </div>
    </div>
  );
}

export { DiscussionPageScreen };

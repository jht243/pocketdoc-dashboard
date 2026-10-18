import React, { useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, FileText, Sparkles, Upload } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, DISPLAY } from "../theme/tokens";
import { callAI, firstText } from "../lib/api";
import { track } from "../lib/analytics";
import { buildHealthContext } from "../lib/healthContext";

// ---- DISCUSSION PAGE (for next doctor appointment) ----
// The Summary and Suggested questions are generated from the user's real profile,
// labs, and device data via the OpenAI gateway. Symptom pattern and device signals
// are read from healthData where present, with a graceful fallback when the app is
// running without a populated snapshot.

// Neutral fallback for the AI-generated fields only — used if the model call fails.
// It invents no specifics (no fake labs, symptoms, or trends) so nothing here can be
// mistaken for the user's real data.
const FALLBACK = {
  summary:
    "Your visit summary will appear here once your latest data has been reviewed. Bring any recent lab results, symptoms, and questions to your appointment.",
  questions: [
    "Are there any results in my recent labs that need follow-up?",
    "Given my history, is there anything you'd recommend monitoring more closely?",
    "Are there screenings or tests I'm due for?",
  ],
};

// The page is the member's own prep sheet, and they may hand it across the desk. So
// the summary is written as them, speaking to their clinician ("I'm 54…"): the old
// prompt produced "Test Member is a 54-year-old male…" on the member's own screen.
// And every question is one a clinician can act on from the record — a live page
// asked "Can we discuss any potential reasons for the lack of recent lab results?",
// which no doctor can answer; the useful version asks for the test.
const VISIT_PREP_SYSTEM = `You write a one-page visit-prep sheet for a member of a health app, in the member's own voice. They read it before an appointment and may show it to their clinician, so it must work for both. You are not a clinician: never diagnose, never guess at a cause, never give a dose, and never suggest starting, stopping or changing a medication.

SUMMARY: one paragraph, 4 to 6 short sentences, in the first person, the member speaking to their clinician. Example opening: "I'm 54 and I've been tired most afternoons for about two months."
- Never use the member's name, and never "he", "she", "they", "the patient" or "the member" for them. It is always "I" and "my".
- Plain and specific: age, and sex where it matters; what has been bothering them and for how long; the measured results that matter, each with its value, unit and date; medications that bear on it; what they want from this visit.
- Take values from the most recent LAB RESULTS. A number typed at intake from memory is not a measurement: if you use one, say "I reported" it.
- If there are no lab results on file, say so plainly ("I don't have recent bloodwork"). Never mention the app, and never comment on why data is missing.
- Call a screening overdue only if the schedule says "overdue". "Not on file" or no record means "I don't have a record of my last …".

QUESTIONS: 3 or 4, in the first person, each under 25 words, each something the clinician can act on in this visit from this record:
- Ask for a specific test, interpret a specific result (name its value and date), recheck a marker, or confirm which screening is due.
- For missing data, ask for the test itself: "Could we run a CBC and a metabolic panel?" A symptom with nothing measured behind it gets the tests that investigate it (fatigue: CBC, ferritin, TSH, metabolic panel).
- Never ask about the app, about why results are missing, or to "discuss potential reasons". Never a question the clinician cannot answer from the visit.

Respond with ONLY a JSON object, no markdown or backticks, of the exact shape: {"summary": "...", "questions": ["...", "...", "..."]}`;

// Belt and braces for the rule above: a question about the app or about why data is
// missing is dropped rather than shown. If nothing usable is left, the neutral
// fallback questions stand in.
const UNACTIONABLE = /\b(?:the app|this app|thumbprint|this platform)\b|\b(?:why|reasons?)\b[^?]*\b(?:lack|missing|absence|no recent|haven'?t|have not|don'?t have)\b/i;

function actionableQuestions(list) {
  const kept = (Array.isArray(list) ? list : [])
    .map((q) => String(q || "").trim())
    .filter((q) => q && !UNACTIONABLE.test(q))
    .slice(0, 4);
  return kept.length ? kept : FALLBACK.questions;
}

function DiscussionPageScreen({ setActive, userProfile, healthData, healthHistory }) {
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(FALLBACK.summary);
  const [questions, setQuestions] = useState(FALLBACK.questions);

  const hasRealData = Boolean(userProfile?.profile || healthData?.today || healthData?.labs?.length);

  // Device signals derived only from real vitals. No fabricated Oura/Eight Sleep
  // readings for users who have no device connected — the section simply hides.
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
    : [];

  // Only the user's own recorded symptoms — never a demo list.
  const symptomPattern =
    today?.recentSymptoms?.length
      ? today.recentSymptoms.map((note) => ({ date: "Recent", note }))
      : [];

  // Files to share are the user's real uploaded records. Nothing is shown until they
  // have actually uploaded something.
  const privateLabFiles = (healthData?.records || []).map((r) => ({
    name: r.name,
    source: r.type,
  }));

  useEffect(() => {
    if (!hasRealData) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // The same full picture the chat gets — intake answers, genetics, every
        // synced wearable metric and the preventive-care schedule included. Visit
        // prep built off four fields missed most of what the user had told us.
        const context = buildHealthContext({ userProfile, healthData, healthHistory });
        const data = await callAI({
          system: VISIT_PREP_SYSTEM,
          messages: [{ role: "user", content: [{ type: "text", text: context }] }],
          maxTokens: 700,
        });
        const raw = firstText(data, "").replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(raw);
        if (!cancelled && parsed?.summary && Array.isArray(parsed?.questions)) {
          setSummary(String(parsed.summary).trim());
          setQuestions(actionableQuestions(parsed.questions));
        }
      } catch {
        // Keep the fallback content on any failure — the page still renders.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      // A superseded run must not leave "Preparing…" pinned on: its own
      // setLoading(false) is skipped via the cancelled guard (so it can't stomp a
      // newer run's spinner), so clear it here — a newer run re-sets it itself.
      cancelled = true;
      setLoading(false);
    };
  }, [hasRealData, userProfile, healthData]);

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("records")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Records
      </button>

      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>Discussion page</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
        For your next appointment
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 22 }}>
        A summary of what's been reported, the pattern across it, and private labs to share.
      </div>

      <SectionLabel>Summary</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.accent}50`, background: COLORS.accentDim }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Sparkles size={18} color={COLORS.accent} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
            {loading ? "Preparing your summary from your latest data…" : summary}
            {/* The generated summary speaks as the member; say so, so it reads as
                theirs to use rather than as the app describing them. */}
            {!loading && summary !== FALLBACK.summary && (
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>
                Written in your words, to read or show your clinician.
              </div>
            )}
          </div>
        </div>
      </Card>

      {symptomPattern.length > 0 && (<>
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
      </>)}

      {deviceSignals.length > 0 && (<>
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
      </>)}

      <SectionLabel>Suggested questions to raise</SectionLabel>
      <Card>
        {(loading ? FALLBACK.questions : questions).map((q, i, arr) => (
          <div key={i} style={{
            display: "flex", gap: 8, padding: "9px 0",
            borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 13, color: COLORS.accent, flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>{q}</span>
          </div>
        ))}
      </Card>

      {privateLabFiles.length > 0 && (<>
        <SectionLabel>Lab files to share</SectionLabel>
        <Card>
          {privateLabFiles.map((f, i) => (
            <div key={`${f.name}-${i}`} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < privateLabFiles.length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <FileText size={16} color={COLORS.tealLight} />
                <div>
                  <div style={{ fontSize: 13 }}>{f.name}</div>
                  {f.source && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{f.source}</div>}
                </div>
              </div>
              <ChevronRight size={14} color={COLORS.textMuted} />
            </div>
          ))}
        </Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
          Your uploaded records, ready to bring to your appointment.
        </div>
      </>)}

      <button onClick={() => { if (!shared) track("discussion_export"); setShared(true); }} style={{
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

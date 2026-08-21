import React, { useState } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { COLORS, SERIF } from "../theme/tokens";
import { IntakeForm } from "../components/IntakeForm";
import { emptyAnswers } from "../lib/intakeContent";

// ---- HEALTH HISTORY SCREEN ----
// Post-onboarding questionnaire. Collected after the user has seen value, not before.
// Feeds the AI chat, the Discussion Page, and the preventive care schedule.
// Content is data-driven (lib/intakeContent.js) and rendered via <IntakeForm>.
function HealthHistoryScreen({ setActive, onSave, userProfile, healthHistory }) {
  // Hydrate from what was already answered (onboarding or a previous visit) the same
  // way onboarding does. Starting blank collapsed every conditional branch, so the two
  // surfaces rendered different forms from identical rules — and saving from that blank
  // state overwrote the stored answers with an un-branched set.
  const profile = userProfile?.profile;
  const [answers, setAnswers] = useState(() => ({
    ...emptyAnswers(),
    ...(userProfile?.intake || {}),
    ...(healthHistory || {}),
  }));
  const [saved, setSaved] = useState(false);

  const setValue = (key, value) => setAnswers((a) => ({ ...a, [key]: value }));

  const handleSave = () => {
    // Preserve the payload shape existing consumers read (Home, test-mode snapshot,
    // AI prompt) while also passing the full answer set forward.
    const healthHistory = {
      ...answers,
      conditions: answers.conditions || [],
      medications: answers.medications || [],
      pastEvents: answers.pastEvents || "",
      familyHistory: answers.familyHistory || [],
      lifestyle: { exercise: answers.exercise, sleep: answers.sleep, alcohol: answers.alcohol },
      goals: answers.goals || [],
    };
    onSave(healthHistory);
    setSaved(true);
    setTimeout(() => setActive("home"), 1200);
  };

  if (saved) {
    return (
      <div style={{ padding: "24px 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <CheckCircle2 size={48} color={COLORS.tealLight} style={{ marginBottom: 16 }} />
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 8 }}>Health history saved</div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: "center" }}>
          Your advocate now has more context to give you specific, relevant guidance.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Your health history</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
        This stays private and makes every recommendation more specific to you. Nothing here is required — share what you can.
      </div>

      <IntakeForm answers={answers} onChange={setValue} variant="history" profile={profile} />

      <button onClick={handleSave} style={{
        width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent,
        fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer",
        marginTop: 8, marginBottom: 10
      }}>
        Save my health history
      </button>
      <button onClick={() => setActive("home")} style={{
        width: "100%", background: "none", border: "none", color: COLORS.textMuted,
        fontSize: 12, padding: "8px", cursor: "pointer"
      }}>
        Skip for now
      </button>
    </div>
  );
}

export { HealthHistoryScreen };

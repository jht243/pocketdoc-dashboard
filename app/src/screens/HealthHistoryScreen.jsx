import React, { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { COLORS, DISPLAY } from "../theme/tokens";
import { SectionedIntake } from "../components/SectionedIntake";
import { emptyAnswers, intakeProgressSummary } from "../lib/intakeContent";

// How long typing has to pause before the answers are written. Short enough that
// closing the tab mid-section loses at most a few keystrokes.
const AUTOSAVE_MS = 1500;

// ---- HEALTH HISTORY SCREEN ----
// Post-onboarding questionnaire, split into parts the member can finish over several
// visits. Feeds the AI chat, the Discussion Page, and the preventive care schedule.
// Content is data-driven (lib/intakeContent.js) and rendered via <SectionedIntake>.
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
  const lastSaved = useRef(JSON.stringify(answers));
  // Inside a part, the part has its own "All sections" back link and title.
  const [inSection, setInSection] = useState(false);

  const persist = (next) => {
    const serialized = JSON.stringify(next);
    if (serialized === lastSaved.current) return;
    lastSaved.current = serialized;
    // Preserve the payload shape existing consumers read (Home, test-mode snapshot,
    // AI prompt) while also passing the full answer set forward.
    onSave({
      ...next,
      conditions: next.conditions || [],
      medications: next.medications || [],
      pastEvents: next.pastEvents || "",
      familyHistory: next.familyHistory || [],
      lifestyle: { exercise: next.exercise, sleep: next.sleep, alcohol: next.alcohol },
      goals: next.goals || [],
    });
  };

  // Autosave after a pause in typing, so "Saved as you go" holds even if the member
  // closes the app without pressing a button. The explicit buttons save immediately.
  const latest = useRef(answers);
  latest.current = answers;
  useEffect(() => {
    const t = setTimeout(() => persist(answers), AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);
  // Leaving the screen inside the autosave window still writes the last edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => persist(latest.current), []);

  const setValue = (key, value) => setAnswers((a) => ({ ...a, [key]: value }));
  const saveNow = (next) => { setAnswers(next); persist(next); };

  const { complete } = intakeProgressSummary(answers);

  return (
    <div style={{ padding: "24px 18px" }}>
      {!inSection && <>
      <button onClick={() => { persist(answers); setActive("home"); }} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
      </button>

      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>Your health history</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
        Five short sections. Do one now and come back for the rest. Everything saves as you go, and nothing is required.
      </div>
      </>}

      <SectionedIntake
        answers={answers}
        onChange={setValue}
        onSave={saveNow}
        profile={profile}
        variant="history"
        onOpenChange={(id) => setInSection(Boolean(id))}
        footer={(
          <button onClick={() => { persist(answers); setActive("home"); }} style={{
            width: "100%", background: complete ? COLORS.teal : "none",
            border: complete ? "none" : `1px solid ${COLORS.border}`,
            color: complete ? COLORS.onAccent : COLORS.textSecondary,
            fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer", marginTop: 8,
          }}>
            {complete ? "Done" : "Finish later"}
          </button>
        )}
      />
    </div>
  );
}

export { HealthHistoryScreen };

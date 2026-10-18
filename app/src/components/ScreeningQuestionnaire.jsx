import React, { useState } from "react";
import { ChevronLeft, Phone, ShieldCheck, X } from "lucide-react";
import { COLORS, DISPLAY, RADIUS } from "../theme/tokens";
import {
  QUESTIONNAIRES, resultMessage, scoreQuestionnaire, visibleQuestions,
} from "../lib/screeningQuestionnaires";

/** Today as the member's local YYYY-MM-DD — the day they answered, not UTC's. */
function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A short validated screening questionnaire, one question per screen, opened over
 * Preventive care from a "Take the 2-minute check" button.
 *
 * Wording and scoring come from lib/screeningQuestionnaires.js. On the last answer
 * the result is handed to `onComplete` (which stores it and marks the schedule item
 * done) and the member sees a calm one-paragraph result — a positive screen is
 * "worth raising with your clinician", never a diagnosis.
 */
function ScreeningQuestionnaire({ instrument, sex, onComplete, onClose }) {
  const def = QUESTIONNAIRES[instrument];
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(-1); // -1 = intro
  const [result, setResult] = useState(null);
  const [saveError, setSaveError] = useState(null);

  if (!def) return null;
  const questions = visibleQuestions(instrument, answers);

  const answer = async (question, value) => {
    const next = { ...answers, [question.id]: value };
    // Drop answers to questions this one has just hidden (AUDIT-C for non-drinkers),
    // so what's stored is only what was asked.
    const shown = visibleQuestions(instrument, next);
    const kept = Object.fromEntries(shown.filter((q) => q.id in next).map((q) => [q.id, next[q.id]]));
    setAnswers(kept);
    const position = shown.findIndex((q) => q.id === question.id);
    if (position < shown.length - 1) {
      setIndex(position + 1);
      return;
    }
    const scored = scoreQuestionnaire(instrument, kept, { sex });
    if (!scored.complete) return;
    setResult(scored);
    const { error } = (await onComplete?.({
      instrument,
      scheduleKey: def.scheduleId,
      answers: kept,
      score: scored.score,
      positive: scored.positive,
      cutoff: scored.cutoff,
      completedOn: localDay(),
    })) || {};
    if (error) setSaveError("Your answers couldn't be stored just now, but the screening is still marked done on your schedule.");
  };

  const shell = (children) => (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%", zIndex: 100,
      background: COLORS.bgDeep, display: "flex", flexDirection: "column", padding: "20px 18px 40px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.textMuted }}>
          {def.title} · {def.name}
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          background: COLORS.bgCardAlt, border: "none", borderRadius: 16, width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}><X size={16} color={COLORS.textSecondary} /></button>
      </div>
      {children}
    </div>
  );

  if (result) {
    const message = resultMessage(instrument, result);
    return shell(<>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.accentDim, display: "grid", placeItems: "center", marginBottom: 14 }}>
        <ShieldCheck size={22} color={COLORS.accent} />
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
        {result.positive ? "Worth raising with your clinician" : "Thanks — that's done"}
      </div>
      <div style={{ fontSize: 14, color: COLORS.textPrimary, lineHeight: 1.6, marginBottom: 14 }}>{message.text}</div>
      {message.show988 && (
        <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: "14px 16px", display: "flex", gap: 10, marginBottom: 14 }}>
          <Phone size={18} color={COLORS.accent} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.55 }}>
            If you're having thoughts of harming yourself, you can call or text <a href="tel:988" style={{ color: COLORS.accent, fontWeight: 700 }}>988</a>, the
            Suicide &amp; Crisis Lifeline, any time, day or night. If you're in immediate danger, call 911.
          </div>
        </div>
      )}
      <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.55, background: COLORS.bgCardAlt, borderRadius: RADIUS.md, padding: "10px 12px" }}>
        This is a screening, not a diagnosis. We've marked it done for this month on your Preventive care schedule
        {def.max ? `, and kept your answers (${result.score} of ${def.max})` : ", and kept your answer"} so you can share them with your clinician.
      </div>
      {saveError && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 10 }}>{saveError}</div>}
      <button onClick={onClose} style={{ ...primaryBtn, marginTop: 22 }}>Done</button>
    </>);
  }

  if (index < 0) {
    return shell(<>
      <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Take the 2-minute check</div>
      <div style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>{def.intro}</div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.55, marginBottom: 22 }}>
        This is the {def.name}, the same short questionnaire used in primary care. Finishing it marks this screening done.
      </div>
      <button onClick={() => setIndex(0)} style={primaryBtn}>Start</button>
    </>);
  }

  const q = questions[Math.min(index, questions.length - 1)];
  const value = answers[q.id];
  return shell(<>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <button onClick={() => setIndex(index - 1)} style={backBtn}><ChevronLeft size={14} /> Previous</button>
      <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}>{index + 1} of {questions.length}</span>
    </div>
    <div style={{ height: 5, borderRadius: 3, background: COLORS.ringTrack, overflow: "hidden", marginBottom: 24 }}>
      <div style={{ width: `${((index + 1) / questions.length) * 100}%`, height: "100%", background: COLORS.accent, transition: "width 0.2s" }} />
    </div>
    {def.stem && <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>{def.stem}</div>}
    <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, lineHeight: 1.35, marginBottom: 20 }}>{q.text}</div>
    <div style={{ display: "grid", gap: 10 }}>
      {q.options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button key={opt.label} onClick={() => answer(q, opt.value)} style={{
            minHeight: 52, padding: "12px 14px", borderRadius: RADIUS.md, cursor: "pointer",
            fontSize: 15, fontWeight: 600, textAlign: "left",
            background: selected ? COLORS.accent : COLORS.bgCard,
            color: selected ? COLORS.onAccent : COLORS.textPrimary,
            border: `1px solid ${selected ? COLORS.accent : COLORS.border}`,
          }}>{opt.label}</button>
        );
      })}
    </div>
  </>);
}

const primaryBtn = {
  width: "100%", background: COLORS.accent, border: "none", color: COLORS.onAccent,
  fontSize: 15, fontWeight: 700, padding: 15, borderRadius: 12, cursor: "pointer",
};

const backBtn = {
  background: "none", border: "none", display: "flex", alignItems: "center", gap: 4,
  color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0,
};

export { ScreeningQuestionnaire };

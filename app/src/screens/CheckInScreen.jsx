import React, { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, Flame, Sparkles, Sun } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { callAI, firstText } from "../lib/api";
import { saveCheckIn } from "../lib/checkInStore";
import { buildHealthContext } from "../lib/healthContext";
import { detectUrgentPatterns, violatesForbiddenOutput } from "../lib/clinicalRules";
import {
  NOTE_MAX, SKIPS_PER_14_DAYS, WINDOW_CLOSE_HOUR, WINDOW_OPEN_HOUR,
  answerSummary, checkInContextLines, checkInQuestions, computeStreak, fallbackReply,
  localDay, skipsUsed, windowState,
} from "../lib/checkInContent";
import { COLORS, DISPLAY, RADIUS } from "../theme/tokens";

// The reply has to land while the member is still looking (doc 19: under 3 seconds).
// Past that, the deterministic reply is shown instead of a spinner.
const REPLY_BUDGET_MS = 3000;

// Physical emergencies typed into the note stop the flow — urgency overrides
// everything (clinical rules spec, Section 7). Crisis language is checked by the
// shared detector so the chat and the check-in can never disagree.
const EMERGENCY_PHRASES = [
  "chest pain", "chest pressure", "can't breathe", "cannot breathe", "trouble breathing",
  "pain radiating", "stroke", "face drooping", "numb on one side", "severe bleeding", "overdose", "passed out",
];

function safetyCheck(note) {
  const text = String(note || "").toLowerCase();
  if (!text.trim()) return null;
  const crisis = detectUrgentPatterns({ healthData: {}, messages: [{ role: "user", text }] }).find((u) => u.id === "crisis");
  if (crisis) return { title: "Please reach out now", body: crisis.message };
  if (EMERGENCY_PHRASES.some((p) => text.includes(p))) {
    return {
      title: "This needs attention now",
      body: "What you described can be a medical emergency. If it's happening now, call 911 or go to the nearest emergency department. Don't wait for an appointment.",
    };
  }
  return null;
}

const REPLY_SYSTEM = `You are Thumbprint Health's morning check-in. The member just answered their daily check-in.
Write ONE sentence (at most 40 words) back to them that connects what they reported today to something specific in their own data: a pattern across their recent check-ins, a lab value, or their wearable.
Rules: never diagnose, never name a condition they might have, never recommend starting, stopping or changing a medication or dose, never alarm. Note patterns calmly; when something is worth raising, say it's worth discussing with their provider. If nothing specific connects, acknowledge today and name one trend. No greetings, no emoji, no lists.`;

async function generateReply({ answers, note, checkIns, userProfile, healthData, healthHistory }) {
  const today = localDay();
  const fallback = fallbackReply(answers, checkIns, today);
  try {
    const context = buildHealthContext({ userProfile, healthData, healthHistory, testModeEnabled: false });
    const request = callAI({
      system: REPLY_SYSTEM,
      maxTokens: 120,
      messages: [{
        role: "user",
        content: `${context}\n\nRECENT CHECK-INS (newest first):\n${checkInContextLines(checkIns, today) || "(this is their first)"}\n\nTODAY'S CHECK-IN: ${answerSummary(answers, note)}`,
      }],
    }).then((data) => firstText(data).trim());
    const timeout = new Promise((resolve) => setTimeout(() => resolve(""), REPLY_BUDGET_MS));
    const text = await Promise.race([request, timeout]);
    if (!text || violatesForbiddenOutput(text)) return fallback;
    return text;
  } catch {
    return fallback;
  }
}

// ---- MORNING CHECK-IN ----
// One question per screen, large tap targets, a progress line, and one personal
// sentence back at the end. Open 5–11 AM local time; test mode ignores the window.
// Answers are always saved, Test mode included: they are the member's own answers,
// not demo data, and dropping them silently is what kept the streak at 0.
function CheckInScreen({ setActive, userProfile, healthData, healthHistory, testModeEnabled, checkIns = [], onSaved }) {
  const { user } = useAuth();
  const today = localDay();
  const todays = checkIns.find((c) => c.day === today);
  const questions = useMemo(() => checkInQuestions(userProfile, healthData), [userProfile, healthData]);
  const windowNow = testModeEnabled ? "open" : windowState();
  const streak = computeStreak(checkIns, today);
  const skipsLeft = Math.max(0, SKIPS_PER_14_DAYS - skipsUsed(checkIns, today));

  const [stage, setStage] = useState(todays && !todays.skipped ? "done" : "intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [note, setNote] = useState("");
  const [reply, setReply] = useState(todays?.response || "");
  const [emergency, setEmergency] = useState(null);
  const [saveError, setSaveError] = useState("");

  const q = questions[index];
  const advance = () => (index + 1 < questions.length ? setIndex(index + 1) : finish());

  const answer = (value) => {
    setAnswers((a) => ({ ...a, [q.id]: value }));
    if (q.type !== "multi") setTimeout(advance, 120); // brief beat so the tap registers visually
  };

  const persist = async (row) => {
    if (!user) return true;
    const { error } = await saveCheckIn(user.id, row);
    if (error) { setSaveError("We couldn't save this check-in. Check your connection and try again."); return false; }
    onSaved?.();
    return true;
  };

  const finish = async () => {
    // Urgency overrides everything: when the note describes an emergency, the
    // usual friendly reply is not written at all — the safety message stands alone.
    const urgent = safetyCheck(note);
    if (urgent) setEmergency(urgent);
    setStage("thinking");
    const text = urgent ? null : await generateReply({ answers, note, checkIns, userProfile, healthData, healthHistory });
    setReply(text || "");
    await persist({ day: today, answers, note: note.trim() || null, response: text });
    setStage("done");
  };

  const skipToday = async () => {
    if (await persist({ day: today, skipped: true })) setActive("home");
  };

  const shell = (children) => (
    <div style={{ padding: "24px 18px", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <button onClick={() => setActive("home")} style={backLink}><ChevronLeft size={14} /> Home</button>
      {children}
    </div>
  );

  const streakBadge = (n) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: n ? COLORS.accent : COLORS.textMuted, background: n ? COLORS.accentDim : COLORS.neutralDim, padding: "4px 10px", borderRadius: 99 }}>
      <Flame size={13} /> {n}-day streak
    </span>
  );

  if (stage === "done") {
    const shownStreak = computeStreak([...checkIns.filter((c) => c.day !== today), { day: today, skipped: false }], today);
    return shell(<>
      {emergency && <EmergencyCard {...emergency} />}
      <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, marginBottom: 6 }}>You're checked in</div>
      <div style={{ marginBottom: 18 }}>{streakBadge(shownStreak)}</div>
      {!emergency && (
        <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: "14px 16px", display: "flex", gap: 10 }}>
          <Sparkles size={18} color={COLORS.accent} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 14, color: COLORS.textPrimary, lineHeight: 1.55 }}>{reply || "Logged for today."}</div>
        </div>
      )}
      {saveError && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 10 }}>{saveError}</div>}
      <button onClick={() => setActive("home")} style={{ ...primaryBtn, marginTop: "auto" }}>Back to Home</button>
    </>);
  }

  if (stage === "thinking") {
    return shell(
      <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", color: COLORS.textSecondary, fontSize: 14 }}>
        Reading this against your recent mornings…
      </div>
    );
  }

  if (stage === "intro") {
    const closedText = windowNow === "before"
      ? `Today's check-in opens at ${WINDOW_OPEN_HOUR} AM.`
      : `Today's check-in closed at ${WINDOW_CLOSE_HOUR} AM. The next one opens tomorrow at ${WINDOW_OPEN_HOUR} AM.`;
    return shell(<>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.accentDim, display: "grid", placeItems: "center", marginBottom: 14 }}>
        <Sun size={22} color={COLORS.accent} />
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Morning check-in</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
        {questions.length} quick taps, about 20 seconds. Each morning builds the picture your bloodwork can't show on its own: sleep, energy and stress between draws.
      </div>
      <div style={{ marginBottom: 20 }}>{streakBadge(streak)}</div>
      {windowNow === "open" ? (
        <>
          <button onClick={() => setStage("q")} style={primaryBtn}>Start</button>
          {skipsLeft > 0 && !todays && (
            <button onClick={skipToday} style={secondaryBtn}>
              Skip today ({skipsLeft} of {SKIPS_PER_14_DAYS} skips left this fortnight; keeps your streak)
            </button>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: COLORS.textSecondary, background: COLORS.bgCardAlt, borderRadius: RADIUS.md, padding: "12px 14px" }}>{closedText}</div>
      )}
      {saveError && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 10 }}>{saveError}</div>}
    </>);
  }

  // stage === "q": one question per screen
  const value = q.id === "note" ? note : answers[q.id];
  return (
    <div style={{ padding: "24px 18px", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => (index ? setIndex(index - 1) : setStage("intro"))} style={backLink}><ChevronLeft size={14} /> Back</button>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}>{index + 1} of {questions.length}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: COLORS.ringTrack, overflow: "hidden", marginBottom: 28 }}>
        <div style={{ width: `${((index + 1) / questions.length) * 100}%`, height: "100%", background: COLORS.accent, transition: "width 0.2s" }} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.textMuted, marginBottom: 6 }}>{q.group}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, lineHeight: 1.3, marginBottom: 22 }}>{q.label}</div>

      {q.type === "choice" && (
        <div style={{ display: "grid", gridTemplateColumns: q.options.length > 3 ? "1fr 1fr 1fr" : "1fr", gap: 10 }}>
          {q.options.map((opt) => <TapButton key={opt} selected={value === opt} onClick={() => answer(opt)}>{opt}</TapButton>)}
        </div>
      )}

      {q.type === "scale" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => <TapButton key={n} selected={value === n} onClick={() => answer(n)}>{n}</TapButton>)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.textMuted, marginTop: 8 }}>
            <span>{q.low}</span><span>{q.high}</span>
          </div>
        </>
      )}

      {q.type === "multi" && (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {q.options.map((opt) => {
              const list = value || [];
              const selected = list.includes(opt);
              const toggle = () => {
                if (opt === q.exclusive) return setAnswers((a) => ({ ...a, [q.id]: selected ? [] : [opt] }));
                const kept = list.filter((x) => x !== q.exclusive);
                setAnswers((a) => ({ ...a, [q.id]: selected ? kept.filter((x) => x !== opt) : [...kept, opt] }));
              };
              return <TapButton key={opt} selected={selected} onClick={toggle}>{opt}</TapButton>;
            })}
          </div>
          <button onClick={advance} disabled={!(value || []).length} style={{ ...primaryBtn, marginTop: 18, opacity: (value || []).length ? 1 : 0.45 }}>Next</button>
        </>
      )}

      {q.type === "note" && (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            placeholder={q.placeholder}
            rows={3}
            style={{ width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: "12px 14px", fontSize: 14, color: COLORS.textPrimary, outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "right", marginTop: 4 }}>{note.length}/{NOTE_MAX} · optional</div>
          <button onClick={finish} style={{ ...primaryBtn, marginTop: 18 }}>{note.trim() ? "Finish check-in" : "Skip & finish"}</button>
        </>
      )}
    </div>
  );
}

function TapButton({ selected, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      minHeight: 52, padding: "12px 10px", borderRadius: RADIUS.md, cursor: "pointer",
      fontSize: 15, fontWeight: 600, textAlign: "center",
      background: selected ? COLORS.accent : COLORS.bgCard,
      color: selected ? COLORS.onAccent : COLORS.textPrimary,
      border: `1px solid ${selected ? COLORS.accent : COLORS.border}`,
    }}>{children}</button>
  );
}

function EmergencyCard({ title, body }) {
  return (
    <div style={{ background: COLORS.badDim, border: `1px solid ${COLORS.danger}55`, borderRadius: RADIUS.lg, padding: "14px 16px", marginBottom: 18, display: "flex", gap: 10 }}>
      <AlertTriangle size={20} color={COLORS.danger} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.danger, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.55 }}>{body}</div>
      </div>
    </div>
  );
}

const backLink = {
  background: "none", border: "none", display: "flex", alignItems: "center", gap: 4,
  color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18,
};

const primaryBtn = {
  width: "100%", background: COLORS.accent, border: "none", color: COLORS.onAccent,
  fontSize: 15, fontWeight: 700, padding: 15, borderRadius: 12, cursor: "pointer",
};

const secondaryBtn = {
  width: "100%", background: "none", border: "none", color: COLORS.textMuted,
  fontSize: 12, padding: 12, cursor: "pointer", marginTop: 6, lineHeight: 1.4,
};

export { CheckInScreen };

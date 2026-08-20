import React, { useState } from "react";
import { AlertCircle, Mic, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

function CheckInScreen() {
  const [recording, setRecording] = useState(false);
  const [resultType, setResultType] = useState(null); // null | "routine" | "emergency"
  const [transcript, setTranscript] = useState("");

  // Simulated transcripts to demonstrate the triage split. In production this would be
  // real speech-to-text run through an urgency classifier before anything else happens.
  const sampleTranscripts = [
    { text: "Feeling a little run down, some chills, slept okay but woke up sore.", urgent: false },
    { text: "Crushing chest pain radiating down my left arm, having trouble breathing.", urgent: true },
  ];

  // Real notes are not yet persisted anywhere, so there is no history to show. Never
  // seed this with fabricated entries — a real person hasn't recorded them.
  const recentNotes = [];

  // Keyword-based urgency check, a stand-in for a real clinical triage model. Any production
  // version of this needs validated clinical logic, not a keyword list, but the UI behavior
  // it drives, hard-stopping into an emergency state rather than filing into a pattern
  // review, should not change.
  const URGENT_KEYWORDS = [
    "chest pain", "can't breathe", "trouble breathing", "radiating", "stroke",
    "can't move", "numb on one side", "severe bleeding", "suicidal", "overdose"
  ];
  const checkUrgency = (text) => URGENT_KEYWORDS.some(k => text.toLowerCase().includes(k));

  const finishRecording = () => {
    const sample = sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)];
    setTranscript(sample.text);
    setResultType(checkUrgency(sample.text) ? "emergency" : "routine");
  };

  return (
    <div style={{ padding: "24px 18px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Personal Health Note</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 26 }}>
        Tell your advocate how you're feeling, whenever something's worth noting. Speak
        naturally, just like you would to a nurse checking in on you.
      </div>

      {resultType === null ? (
        <Card style={{ textAlign: "center", padding: "36px 20px" }}>
          <button onClick={() => { setRecording(!recording); if (recording) finishRecording(); }} style={{
            width: 84, height: 84, borderRadius: 42, border: "none", cursor: "pointer",
            background: recording ? COLORS.danger : COLORS.teal,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", transition: "background 0.2s"
          }}>
            <Mic size={32} color={COLORS.onAccent} />
          </button>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
            {recording ? "Listening... tap to finish" : "Tap to speak, anytime"}
          </div>
          {recording && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 10 }}>
              (Demo: tap finish twice to see both a routine and an urgent example)
            </div>
          )}
        </Card>
      ) : resultType === "emergency" ? (
        <Card style={{ border: `1.5px solid ${COLORS.danger}`, background: COLORS.badDim }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <AlertCircle size={18} color={COLORS.danger} />
            <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.danger }}>This may be an emergency</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", marginBottom: 12 }}>
            "{transcript}"
          </div>
          <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.6, marginBottom: 14 }}>
            What you've described could be a medical emergency. This app cannot evaluate
            that for you. Please call 911 or go to the nearest emergency room now.
          </div>
          <button style={{
            width: "100%", background: COLORS.danger, border: "none", color: "#fff",
            fontSize: 14, fontWeight: 700, padding: "13px", borderRadius: 10, cursor: "pointer",
            marginBottom: 10
          }}>
            Call 911
          </button>
          <button onClick={() => { setResultType(null); setRecording(false); }} style={{
            width: "100%", background: "none", border: `1px solid ${COLORS.border}`,
            color: COLORS.textSecondary, fontSize: 12, padding: "8px", borderRadius: 8, cursor: "pointer"
          }}>
            This wasn't an emergency, redo my note
          </button>
        </Card>
      ) : (
        <Card>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <Sparkles size={16} color={COLORS.gold} />
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.gold }}>Noted</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", marginBottom: 10 }}>
            "{transcript}"
          </div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
            Logged and added to today's pattern review. This lines up with this morning's
            device signal.
          </div>
          <div style={{
            background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
            color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 12
          }}>
            Nothing here requires urgent attention. Worth mentioning at your next visit if it
            persists past 48 hours.
          </div>
          <button onClick={() => { setResultType(null); setRecording(false); }} style={{
            background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.tealLight,
            fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            width: "100%"
          }}>
            Add another note
          </button>
        </Card>
      )}

      {recentNotes.length > 0 && (<>
        <SectionLabel>Recent notes</SectionLabel>
        <Card>
          {recentNotes.map((n, i) => (
            <div key={i} style={{
              padding: "10px 0", borderBottom: i < recentNotes.length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 3 }}>{n.time}</div>
              <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{n.note}</div>
            </div>
          ))}
        </Card>
      </>)}
    </div>
  );
}

export { CheckInScreen };

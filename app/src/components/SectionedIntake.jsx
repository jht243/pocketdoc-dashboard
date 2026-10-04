import React, { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { IntakeForm } from "./IntakeForm";
import { COLORS, RADIUS, SHADOW } from "../theme/tokens";
import { scrollPhoneToTop } from "../lib/scroll";
import {
  INTAKE_GROUPS, INTAKE_PROGRESS_KEY, groupQuestions, groupStatus, intakeProgressSummary,
} from "../lib/intakeContent";

const STATUS = {
  done: { label: "Done", bg: COLORS.goodDim, fg: COLORS.good },
  started: { label: "In progress", bg: COLORS.accentDim, fg: COLORS.accent },
  todo: { label: "Not started", bg: COLORS.neutralDim, fg: COLORS.textMuted },
};

// ---- SECTIONED INTAKE ----
// The health questionnaire as five parts the member can finish one at a time. A hub
// lists each part with its status; opening one shows a "have this ready" note and
// only that part's questions. Every way out of a part saves, so leaving halfway and
// coming back next week picks up exactly where they stopped.
//
//   answers   — the full answer set (all parts)
//   onChange  — (key, value) for a single field edit
//   onSave    — (nextAnswers) persist; called on every navigation out of a part
//   footer    — what sits under the hub (e.g. onboarding's "Continue" button)
//   onOpenChange — (groupId | null) so the host can hide its own intro inside a part
function SectionedIntake({ answers, onChange, onSave, profile, variant = "history", footer = null, onOpenChange }) {
  const [openId, setOpenId] = useState(null);
  const groupIndex = INTAKE_GROUPS.findIndex((g) => g.id === openId);
  const group = INTAKE_GROUPS[groupIndex];
  const summary = intakeProgressSummary(answers);

  const open = (id) => {
    setOpenId(id);
    onOpenChange?.(id);
    scrollPhoneToTop();
  };

  // Saves with this part optionally marked finished, then moves on. Built from the
  // current answers rather than through onChange, so the save carries the new status
  // instead of racing a state update.
  const leave = (markDone, nextId) => {
    const next = markDone
      ? { ...answers, [INTAKE_PROGRESS_KEY]: { ...(answers[INTAKE_PROGRESS_KEY] || {}), [group.id]: "done" } }
      : answers;
    onSave(next);
    open(nextId);
  };

  if (group) {
    const remaining = INTAKE_GROUPS.filter((g, i) => i > groupIndex && groupStatus(g, answers, profile) !== "done");
    const nextGroup = remaining[0] || null;
    return (
      <div>
        <button onClick={() => leave(false, null)} style={linkBack}>
          <ChevronLeft size={14} /> All sections
        </button>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.textMuted, marginBottom: 4 }}>
          Section {groupIndex + 1} of {INTAKE_GROUPS.length}
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.textPrimary, letterSpacing: "-0.01em", marginBottom: 12 }}>{group.title}</div>

        <div style={{ display: "flex", gap: 10, background: COLORS.accentDim, borderLeft: `2px solid ${COLORS.accent}`, borderRadius: "0 8px 8px 0", padding: "10px 12px", marginBottom: 18 }}>
          <ClipboardList size={16} color={COLORS.accent} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, marginBottom: 2 }}>Before you start</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>{group.prep}</div>
          </div>
        </div>

        <IntakeForm answers={answers} onChange={onChange} variant={variant} sectionIds={group.sections} profile={profile} />

        <button onClick={() => leave(true, nextGroup?.id || null)} style={primaryBtn}>
          {nextGroup ? "Save & continue" : "Save this section"}
        </button>
        <button onClick={() => leave(false, null)} style={secondaryBtn}>
          Save & finish later
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textPrimary }}>
          {summary.complete ? "All sections complete" : `${summary.done} of ${summary.total} sections complete`}
        </span>
        <span style={{ fontSize: 11, color: COLORS.textMuted }}>Saved as you go</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: COLORS.ringTrack, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ width: `${(summary.done / summary.total) * 100}%`, height: "100%", background: summary.complete ? COLORS.good : COLORS.accent, transition: "width 0.3s" }} />
      </div>

      {INTAKE_GROUPS.map((g, i) => {
        const status = groupStatus(g, answers, profile);
        const s = STATUS[status];
        const count = groupQuestions(g, answers, profile).length;
        return (
          <button key={g.id} onClick={() => open(g.id)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer",
            background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg,
            boxShadow: SHADOW, padding: "12px 14px", marginBottom: 10,
          }}>
            {status === "done"
              ? <CheckCircle2 size={22} color={COLORS.good} style={{ flexShrink: 0 }} />
              : <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${status === "started" ? COLORS.accent : COLORS.strokeStrong}`, color: status === "started" ? COLORS.accent : COLORS.textMuted, fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{i + 1}</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.textPrimary }}>{g.title}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>About {count} questions</div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: s.bg, color: s.fg, flexShrink: 0 }}>{s.label}</span>
            <ChevronRight size={14} color={COLORS.textMuted} style={{ flexShrink: 0 }} />
          </button>
        );
      })}

      {footer}
    </div>
  );
}

const linkBack = {
  background: "none", border: "none", display: "flex", alignItems: "center", gap: 4,
  color: COLORS.textSecondary, fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 14,
};

const primaryBtn = {
  width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent,
  fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer", marginTop: 4,
};

const secondaryBtn = {
  width: "100%", background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary,
  fontSize: 13, fontWeight: 600, padding: "12px", borderRadius: 12, cursor: "pointer", marginTop: 8,
};

export { SectionedIntake };

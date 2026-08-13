import React, { useState } from "react";
import { COLORS } from "../theme/tokens";
import {
  MONTH_OPTIONS,
  currentYearMonth,
  formatCompletedMonth,
  yearOptions,
} from "../lib/screeningDates";

const selectStyle = {
  flex: 1,
  background: COLORS.bgCard,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: COLORS.textPrimary,
  fontSize: 12,
  outline: "none",
};

const pillBtn = (color) => ({
  background: "none",
  border: `1px solid ${color}59`,
  color,
  borderRadius: 999,
  padding: "5px 12px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
});

/**
 * Inline completion-date control shown under a screening once it's marked done.
 * Starts as a read-only summary with Edit + Delete. Tapping Edit reveals the
 * month/year pickers; changes are only committed on Save (Cancel discards them).
 */
function ScreeningMonthYear({ value, onChange, onDelete }) {
  const [editing, setEditing] = useState(false);

  const label = formatCompletedMonth(typeof value === "string" ? value : null);

  // ---- read-only summary ----
  if (!editing) {
    return (
      <div
        style={{
          marginTop: 8,
          background: COLORS.bgCardAlt,
          borderRadius: 8,
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11.5, color: COLORS.textSecondary }}>
          {label ? `Completed ${label}` : "Completed — month not recorded"}
        </span>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={() => setEditing(true)} style={pillBtn(COLORS.accent)}>
            Edit
          </button>
          <button type="button" onClick={() => onDelete?.()} style={pillBtn(COLORS.danger)}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  // ---- edit mode (local draft, committed on Save) ----
  return <EditPanel value={value} onSave={(v) => { onChange?.(v); setEditing(false); }} onCancel={() => setEditing(false)} />;
}

function EditPanel({ value, onSave, onCancel }) {
  const initialYm = typeof value === "string" ? value : currentYearMonth();
  const [ym, setYm] = useState(initialYm);
  const [noMonth, setNoMonth] = useState(value === true);
  const [year, month] = ym.split("-");
  const years = yearOptions();

  return (
    <div style={{ marginTop: 8, background: COLORS.bgCardAlt, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6 }}>
        When did you complete this?
      </div>

      {noMonth ? (
        <div style={{ fontSize: 12, color: COLORS.textSecondary, padding: "6px 0" }}>Month not recorded</div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <select aria-label="Completion month" value={month} onChange={(e) => setYm(`${year}-${e.target.value}`)} style={selectStyle}>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select aria-label="Completion year" value={year} onChange={(e) => setYm(`${e.target.value}-${month}`)} style={selectStyle}>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={() => setNoMonth((v) => !v)}
        style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 11, padding: "6px 0 0", cursor: "pointer" }}
      >
        {noMonth ? "Add the month" : "I don’t remember the month"}
      </button>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => onSave(noMonth ? true : ym)}
          style={{ flex: 1, background: COLORS.teal, border: "none", color: COLORS.onAccent, borderRadius: 8, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary, borderRadius: 8, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export { ScreeningMonthYear };

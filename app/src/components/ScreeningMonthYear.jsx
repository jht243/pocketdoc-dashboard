import React, { useState } from "react";
import { COLORS } from "../theme/tokens";
import {
  MONTH_OPTIONS,
  currentYearMonth,
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

/**
 * Inline month/year editor shown under a screening after it's marked done.
 * Edits are held locally as a draft and only committed when the user taps Save,
 * so changing the dropdowns no longer silently persists. Delete removes the
 * completion entirely (un-marks the screening).
 */
function ScreeningMonthYear({ value, onChange, onDelete }) {
  const isNoMonth = value === true;
  const initialYm = typeof value === "string" ? value : currentYearMonth();
  const [ym, setYm] = useState(initialYm);
  const [noMonth, setNoMonth] = useState(isNoMonth);
  const [saved, setSaved] = useState(false);

  const [year, month] = ym.split("-");
  const years = yearOptions();

  const update = (nextYear, nextMonth) => {
    setYm(`${nextYear}-${nextMonth}`);
    setSaved(false);
  };

  const save = () => {
    onChange?.(noMonth ? true : ym);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      style={{
        marginTop: 8,
        background: COLORS.bgCardAlt,
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6 }}>
        When did you complete this?
      </div>

      {noMonth ? (
        <div style={{ fontSize: 12, color: COLORS.textSecondary, padding: "6px 0" }}>
          Month not recorded
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <select
            aria-label="Completion month"
            value={month}
            onChange={(e) => update(year, e.target.value)}
            style={selectStyle}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Completion year"
            value={year}
            onChange={(e) => update(e.target.value, month)}
            style={selectStyle}
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={() => { setNoMonth((v) => !v); setSaved(false); }}
        style={{
          background: "none",
          border: "none",
          color: COLORS.textMuted,
          fontSize: 11,
          padding: "6px 0 0",
          cursor: "pointer",
        }}
      >
        {noMonth ? "Add the month" : "I don’t remember the month"}
      </button>

      {/* Save (commit the draft) + Delete (remove the completion) */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={save}
          style={{
            flex: 1,
            background: saved ? COLORS.goodDim : COLORS.teal,
            border: saved ? `1px solid ${COLORS.good}` : "none",
            color: saved ? COLORS.good : COLORS.onAccent,
            borderRadius: 8,
            padding: "9px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => onDelete?.()}
          style={{
            background: "none",
            border: `1px solid ${COLORS.danger}40`,
            color: COLORS.danger,
            borderRadius: 8,
            padding: "9px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export { ScreeningMonthYear };

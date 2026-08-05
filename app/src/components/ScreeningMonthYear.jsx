import React from "react";
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

/**
 * Inline month/year picker shown under a screening after it's marked done.
 * Matches the compact field styling used across onboarding and medications.
 */
function ScreeningMonthYear({ value, onChange }) {
  const label = formatCompletedMonth(typeof value === "string" ? value : null);

  if (value === true) {
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
        <span style={{ fontSize: 11, color: COLORS.textMuted }}>Month not recorded</span>
        <button
          type="button"
          onClick={() => onChange?.(currentYearMonth())}
          style={{
            background: COLORS.accentDim,
            border: `1px solid ${COLORS.accent}40`,
            color: COLORS.accent,
            borderRadius: 999,
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Add month
        </button>
      </div>
    );
  }

  const ym = typeof value === "string" ? value : currentYearMonth();
  const [year, month] = ym.split("-");
  const years = yearOptions();

  const setParts = (nextYear, nextMonth) => {
    onChange?.(`${nextYear}-${nextMonth}`);
  };

  return (
    <div
      style={{
        marginTop: 8,
        background: COLORS.bgCardAlt,
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6 }}>
        {label ? `Completed ${label}` : "When did you complete this?"}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <select
          aria-label="Completion month"
          value={month}
          onChange={(e) => setParts(year, e.target.value)}
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
          onChange={(e) => setParts(e.target.value, month)}
          style={selectStyle}
        >
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => onChange?.(true)}
        style={{
          background: "none",
          border: "none",
          color: COLORS.textMuted,
          fontSize: 11,
          padding: "6px 0 0",
          cursor: "pointer",
        }}
      >
        I don’t remember the month
      </button>
    </div>
  );
}

export { ScreeningMonthYear };

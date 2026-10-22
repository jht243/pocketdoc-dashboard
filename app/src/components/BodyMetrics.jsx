import React from "react";
import { COLORS } from "../theme/tokens";
import { bodyMetrics } from "../lib/bodyMetrics";

/**
 * The waist-based numbers a member sees under their measurements: relative fat mass
 * and waist-to-height ratio. BMI is calculated too but never shown here (Dr. Locker,
 * Oct 21 2026: members see the waist-based numbers, BMI stays in the background).
 *
 * Renders nothing until there's a waist to work from.
 */
function BodyMetrics({ intake, sex }) {
  const m = bodyMetrics(intake, sex);
  if (m.waistToHeight == null) return null;
  const Row = ({ label, value, note }) => (
    <div style={{ padding: "8px 0", borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: COLORS.textSecondary }}>{label}</span>
        <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>{value}</span>
      </div>
      {note && <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 2 }}>{note}</div>}
    </div>
  );
  return (
    <div style={{ marginTop: 4 }}>
      {m.rfm != null && (
        <Row label="Estimated body fat (RFM)" value={`${m.rfm}%`}
          note="Relative fat mass, from your height, waist and sex. An estimate, not a scan." />
      )}
      <Row label="Waist-to-height ratio" value={m.waistToHeight.toFixed(2)}
        note="Under 0.5 is the commonly used healthy target." />
    </div>
  );
}

export { BodyMetrics };

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { COLORS } from "../theme/tokens";
import { formatTarget } from "../lib/markerTargets";
import { statusLabel } from "../lib/scorecard";
import { assessMarker, monthYear, statusTone, trendPoints } from "../lib/markerResults";

// One marker on the Biology screen (Adam's Oct 14 build spec): value and date, the
// lab range exactly as the member's report printed it, the Thumbprint target, the
// status between them, a "Why this target" note, and a small trend when there is
// more than one reading. Collapsed it is one compact row; tapping opens the rest.

const withUnit = (value, unit) => `${value}${unit ? ` ${unit}` : ""}`;

/** "<100", "≥40", "70–99": the target in the collapsed row, where the unit is already beside the value. */
function compactTarget(t) {
  const lo = t.target_low, hi = t.target_high;
  if (t.direction === "lower_better" && hi != null) return `<${hi}`;
  if (t.direction === "higher_better" && lo != null) return `≥${lo}`;
  if (lo != null && hi != null) return `${lo}–${hi}`;
  return hi != null ? `<${hi}` : `≥${lo}`;
}

/** The evidence label as a small chip — always shown for Emerging targets. */
function EvidenceChip({ level }) {
  if (!level) return null;
  const emerging = level === "Emerging";
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      color: emerging ? COLORS.violet : COLORS.accent, background: emerging ? `${COLORS.violet}14` : COLORS.accentDim,
      borderRadius: 6, padding: "1px 6px", marginLeft: 6, whiteSpace: "nowrap"
    }}>{level}</span>
  );
}

/**
 * Prior values as a small line, oldest left. The shaded band is the Thumbprint
 * target; each dot takes the colour of that reading's own status.
 */
function TrendSpark({ points, target, ctx }) {
  if (points.length < 2) return null;
  const w = 260, h = 64, padX = 6, padY = 8;
  const lo = target?.target_low != null ? Number(target.target_low) : null;
  const hi = target?.target_high != null ? Number(target.target_high) : null;
  const values = points.map((p) => p.value);
  const domain = [...values, ...(lo != null ? [lo] : []), ...(hi != null ? [hi] : [])];
  let min = Math.min(...domain), max = Math.max(...domain);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.1; max += span * 0.1;
  const x = (i) => padX + (i * (w - padX * 2)) / (points.length - 1);
  const y = (v) => h - padY - ((v - min) / (max - min)) * (h - padY * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const bandTop = y(hi != null ? hi : max), bandBottom = y(lo != null ? lo : min);
  return (
    <div style={{ marginTop: 10 }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
        aria-label={`Trend across ${points.length} readings`}>
        {target && (lo != null || hi != null) && (
          <rect x={0} y={bandTop} width={w} height={Math.max(0, bandBottom - bandTop)} fill={COLORS.goodDim} />
        )}
        <path d={path} fill="none" stroke={COLORS.accent} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r="3.2"
            fill={statusTone(assessMarker(p.row, ctx).status).fg} stroke={COLORS.bgCard} strokeWidth="1" />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
        <span>{monthYear(points[0].row)} · {points[0].row.value}</span>
        {target && <span>Shaded: Thumbprint target</span>}
        <span>{monthYear(points[points.length - 1].row)} · {points[points.length - 1].row.value}</span>
      </div>
    </div>
  );
}

/** A label/value line inside the open row. */
function Line({ label, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", fontSize: 12 }}>
      <span style={{ color: COLORS.textMuted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: COLORS.textPrimary, textAlign: "right" }}>{children}</span>
    </div>
  );
}

/** Lab range, target and status for one reading — shared by the marker row and the scorecard. */
function RangeAndTarget({ m, assessment }) {
  const { target, labRange, hasLabRange, status } = assessment;
  const tone = statusTone(status);
  return (
    <>
      <Line label="Lab range (your report)">{labRange ? withUnit(labRange, m.unit) : "Not printed on your report"}</Line>
      {target && (
        <Line label="Thumbprint target">
          {formatTarget(target)}
          {target.evidence_level === "Emerging" && <EvidenceChip level="Emerging" />}
        </Line>
      )}
      <Line label="Status"><span style={{ color: tone.fg, fontWeight: 600 }}>{statusLabel(status, { hasLabRange })}</span></Line>
    </>
  );
}

function MarkerRow({ m, history, ctx, expanded, onToggle, sourceLabel, withRange }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const a = assessMarker(m, ctx);
  const tone = statusTone(a.status);
  const when = monthYear(m);
  const points = trendPoints(history.map((h) => withRange(h, m)), m);
  // Second line, collapsed: the date and the two reference points, so a member can
  // read the verdict without opening the row.
  const sub = [
    when,
    a.labRange ? `Lab ${a.labRange}` : null,
    a.target ? `Target ${compactTarget(a.target)}` : null,
  ].filter(Boolean).join(" · ");
  const shortStatus = {
    outside_lab: "Outside lab range",
    outside_target: "Outside target",
    within_target: "Within target",
    within_lab: "Within lab range",
  }[a.status];

  return (
    <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
      <div onClick={onToggle} style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
        padding: "11px 0", cursor: "pointer"
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13 }}>{m.name}</div>
          {sub && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{withUnit(m.value, m.unit)}</div>
            {shortStatus && <div style={{ fontSize: 10.5, fontWeight: 600, color: tone.fg, marginTop: 1 }}>{shortStatus}</div>}
          </div>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: tone.fg }} />
          {expanded
            ? <ChevronDown size={14} color={COLORS.textMuted} />
            : <ChevronRight size={14} color={COLORS.textMuted} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 0 12px 12px" }}>
          <RangeAndTarget m={m} assessment={a} />

          {a.target && (
            <div style={{ marginTop: 6 }}>
              <button onClick={() => setWhyOpen((v) => !v)} style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                color: COLORS.tealLight, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2
              }}>
                Why this target {whyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {whyOpen && (
                <div style={{
                  borderLeft: `2px solid ${COLORS.accent}`, background: COLORS.accentDim,
                  borderRadius: "0 6px 6px 0", padding: "8px 10px", marginTop: 6
                }}>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>{a.target.rationale}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6, lineHeight: 1.45 }}>
                    Evidence: <EvidenceChip level={a.target.evidence_level} /><br />
                    Source: {a.target.source}
                    {a.target.approved_by === "pending" && <><br />Awaiting review by Thumbprint's medical director.</>}
                  </div>
                </div>
              )}
            </div>
          )}

          <TrendSpark points={points} target={a.target} ctx={ctx} />

          {/* Provenance: one line per panel this marker appeared in — which file it
              came from, when, and the value it held there, each with its own dot. */}
          <div style={{ marginTop: 10 }}>
            {history.map((h, j) => (
              <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{sourceLabel(h)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 12, color: COLORS.textPrimary }}>{withUnit(h.value, h.unit)}</div>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: statusTone(assessMarker(withRange(h, m), ctx).status).fg }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { MarkerRow, RangeAndTarget, EvidenceChip };

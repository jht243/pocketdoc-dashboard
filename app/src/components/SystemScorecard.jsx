import React, { useState } from "react";
import { track } from "../lib/analytics";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "./Card";
import { RangeAndTarget } from "./MarkerResult";
import { COLORS } from "../theme/tokens";
import { MARKER_NAMES, rateSystems } from "../lib/scorecard";
import { assessMarker, monthYear } from "../lib/markerResults";

// "What's driving your numbers" (Adam's Oct 14 build spec): six body systems, each
// rated in words — Strong, Fair, Needs attention, Not enough data. No score, no
// percentage, no weighting: tapping a system shows exactly the markers behind its
// rating, each with its lab range and target, so the member can check it by eye.

/** Pill colours. Red only when the rating comes from a value outside the lab range. */
function ratingTone(s) {
  if (s.rating === "needs_attention") return s.outsideLab > 0
    ? { fg: COLORS.danger, bg: COLORS.badDim }
    : { fg: COLORS.gold, bg: COLORS.warnDim };
  if (s.rating === "strong") return { fg: COLORS.good, bg: COLORS.goodDim };
  if (s.rating === "fair") return { fg: COLORS.accent, bg: COLORS.accentDim };
  return { fg: COLORS.textMuted, bg: COLORS.neutralDim };
}

/**
 * @param {Array}  markers  newest reading per printed name, newest draw first
 * @param {object} ctx      { targets, sex, age } for assessMarker
 */
function SystemScorecard({ markers, ctx }) {
  const [openId, setOpenId] = useState(null);

  // Newest reading per marker id. Two printed names can be one marker ("Glucose" in
  // one panel, "Glucose, Fasting" in the next); the list is newest-first, so the
  // first row seen for an id is the current one.
  const byId = new Map();
  for (const m of markers) {
    const a = assessMarker(m, ctx);
    if (a.markerId && !byId.has(a.markerId)) byId.set(a.markerId, { m, a });
  }
  const statusById = Object.fromEntries([...byId].map(([id, { a }]) => [id, a.status]));
  const systems = rateSystems(statusById);

  return (
    <Card style={{ padding: "4px 16px" }}>
      {systems.map((s, i) => {
        const open = openId === s.id;
        const tone = ratingTone(s);
        return (
          <div key={s.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}` }}>
            <div onClick={() => {
              if (!open) track("scorecard_system_opened", { system: s.id, rating: s.label });
              setOpenId(open ? null : s.id);
            }} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", cursor: "pointer"
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{s.onFile} of {s.total} markers on file</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: tone.fg, background: tone.bg,
                  borderRadius: 10, padding: "3px 9px", whiteSpace: "nowrap"
                }}>{s.label}</span>
                {open ? <ChevronDown size={14} color={COLORS.textMuted} /> : <ChevronRight size={14} color={COLORS.textMuted} />}
              </div>
            </div>
            {open && (
              <div style={{ padding: "0 0 10px 0" }}>
                {s.markers.map((id) => {
                  const hit = byId.get(id);
                  if (!hit) {
                    return (
                      <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0 7px 12px", borderTop: `1px solid ${COLORS.border}` }}>
                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{MARKER_NAMES[id] || id}</span>
                        <span style={{ fontSize: 12, color: COLORS.textMuted }}>Not on file</span>
                      </div>
                    );
                  }
                  const { m, a } = hit;
                  return (
                    <div key={id} style={{ padding: "8px 0 6px 12px", borderTop: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</span>
                        <span style={{ fontSize: 12.5, color: COLORS.textSecondary, whiteSpace: "nowrap" }}>
                          {m.value}{m.unit ? ` ${m.unit}` : ""}{monthYear(m) ? `, ${monthYear(m)}` : ""}
                        </span>
                      </div>
                      <RangeAndTarget m={m} assessment={a} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

export { SystemScorecard };

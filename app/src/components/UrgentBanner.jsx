import React from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";
import { COLORS } from "../theme/tokens";

/**
 * A Section 7 escalation, rendered the way the clinical specification requires it:
 * first on the screen, never folded into a list of other topics, never softened.
 *
 * These findings come from `detectUrgentPatterns`, which reads the raw numbers
 * rather than the model's opinion of them — so this renders whether or not the AI
 * responded, and it is deliberately not dismissible. A member who can dismiss a
 * potassium of 6.4 will dismiss it.
 *
 * Two kinds arrive here and they must not look alike. `urgent` is a recent value no
 * clinician would sit on: red, and it says go today. `recheck` is the same threshold
 * crossed by a result too old to describe the member now — an out-of-date panel is a
 * reason to repeat a test, never a reason to send someone to an emergency room, and
 * dressing one up as the other is what makes members stop believing the red one.
 */
const KINDS = {
  urgent: {
    heading: "GET SEEN TODAY",
    color: COLORS.danger,
    background: COLORS.badDim,
    Icon: AlertOctagon,
  },
  recheck: {
    heading: "WORTH REPEATING",
    color: COLORS.warning,
    background: COLORS.warnDim,
    Icon: RefreshCw,
  },
};

function UrgentBanner({ items = [] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 16 }} role="alert">
      {items.map((u) => {
        const kind = KINDS[u.kind] || KINDS.urgent;
        const { Icon } = kind;
        return (
          <div
            key={`${u.kind || "urgent"}-${u.id}`}
            style={{
              background: kind.background,
              border: `1.5px solid ${kind.color}`,
              borderRadius: 16,
              padding: "14px 16px",
              marginBottom: 10,
              display: "flex",
              gap: 11,
              alignItems: "flex-start",
            }}
          >
            <Icon size={20} color={kind.color} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: kind.color, letterSpacing: "0.02em", marginBottom: 4 }}>
                {kind.heading}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.55 }}>{u.message}</div>
              {/* Rule 6.2 — the member can see exactly which reading triggered this. */}
              {u.source && (
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 7 }}>Based on: {u.source}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { UrgentBanner };

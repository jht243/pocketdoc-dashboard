import React from "react";
import { AlertOctagon } from "lucide-react";
import { COLORS } from "../theme/tokens";

/**
 * A Section 7 escalation, rendered the way the clinical specification requires it:
 * first on the screen, never folded into a list of other topics, never softened.
 *
 * These findings come from `detectUrgentPatterns`, which reads the raw numbers
 * rather than the model's opinion of them — so this renders whether or not the AI
 * responded, and it is deliberately not dismissible. A member who can dismiss a
 * potassium of 6.4 will dismiss it.
 */
function UrgentBanner({ items = [] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 16 }} role="alert">
      {items.map((u) => (
        <div
          key={u.id}
          style={{
            background: COLORS.badDim,
            border: `1.5px solid ${COLORS.danger}`,
            borderRadius: 16,
            padding: "14px 16px",
            marginBottom: 10,
            display: "flex",
            gap: 11,
            alignItems: "flex-start",
          }}
        >
          <AlertOctagon size={20} color={COLORS.danger} style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.danger, letterSpacing: "0.02em", marginBottom: 4 }}>
              GET SEEN TODAY
            </div>
            <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.55 }}>{u.message}</div>
            {/* Rule 6.2 — the member can see exactly which reading triggered this. */}
            {u.source && (
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 7 }}>Based on: {u.source}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export { UrgentBanner };

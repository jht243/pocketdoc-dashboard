import React from "react";
import { ChevronRight, Flame, Sun } from "lucide-react";
import { Card } from "./Card";
import { COLORS } from "../theme/tokens";
import { WINDOW_CLOSE_HOUR, WINDOW_OPEN_HOUR, computeStreak, localDay, windowState } from "../lib/checkInContent";

// Home's morning check-in row: start it, or see today's reply, with the streak always
// visible (doc 19: "the streak counter is visible on the home screen").
function CheckInCard({ checkIns = [], testModeEnabled, setActive }) {
  const today = localDay();
  const todays = checkIns.find((c) => c.day === today);
  const done = todays && !todays.skipped;
  const streak = computeStreak(checkIns, today);
  const win = testModeEnabled ? "open" : windowState();

  const status = done
    ? todays.response || "Checked in today."
    : todays?.skipped
      ? "Skipped today. Your streak is safe."
      : win === "open"
        ? `About 20 seconds. Open until ${WINDOW_CLOSE_HOUR} AM.`
        : win === "before"
          ? `Opens at ${WINDOW_OPEN_HOUR} AM.`
          : `Closed at ${WINDOW_CLOSE_HOUR} AM. Next one opens tomorrow at ${WINDOW_OPEN_HOUR} AM.`;
  const actionable = !done && !todays?.skipped && win === "open";

  return (
    <button onClick={() => setActive("checkin")} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", textAlign: "left" }}>
      <Card style={{ border: `1px solid ${actionable ? COLORS.accent : COLORS.border}`, background: actionable ? COLORS.accentDim : COLORS.bgCard }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: actionable ? COLORS.accent : COLORS.bgCardAlt }}>
            <Sun size={18} color={actionable ? COLORS.onAccent : COLORS.accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{done ? "Checked in" : "Morning check-in"}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: streak ? COLORS.accent : COLORS.textMuted }}>
                <Flame size={12} /> {streak}-day streak
              </span>
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.45, marginTop: 2 }}>{status}</div>
          </div>
          <ChevronRight size={14} color={COLORS.textMuted} style={{ flexShrink: 0 }} />
        </div>
      </Card>
    </button>
  );
}

export { CheckInCard };

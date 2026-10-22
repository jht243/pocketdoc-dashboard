import React from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "./Card";
import { COLORS } from "../theme/tokens";
import { STATUS, STATUS_LABELS, screeningStatus, summarizeSchedule } from "../lib/screeningLogic";

// Most pressing first: something overdue, then due soon, then what we have no record of.
const ORDER = [STATUS.OVERDUE, STATUS.DUE_SOON, STATUS.NOT_ON_FILE, STATUS.CHECK_ELIGIBILITY];
const TONE = {
  [STATUS.OVERDUE]: COLORS.danger,
  [STATUS.DUE_SOON]: COLORS.warning,
  [STATUS.NOT_ON_FILE]: COLORS.textSecondary,
  [STATUS.CHECK_ELIGIBILITY]: COLORS.textMuted,
};
const SHOWN = 3;

/**
 * Preventive care on Home: what's due, so the member doesn't have to go looking.
 * Screenings used to reach Home only through the Health Score; when the score made
 * way for biological age (Oct 21 2026 call: "we have to put the preventative care
 * somewhere… some people were saying I'd like a reminder on what's due"), they got
 * their own card.
 */
function PreventiveCareCard({ userProfile, setActive }) {
  const schedule = userProfile?.schedule || [];
  if (!schedule.length) return null;
  const completed = userProfile.completedItems || {};
  const counts = summarizeSchedule(schedule, completed);
  const needing = schedule
    .map((item) => ({ item, status: screeningStatus(item, completed[item.id]) }))
    .filter((x) => ORDER.includes(x.status))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const shown = needing.slice(0, SHOWN);
  const more = needing.length - shown.length;

  return (
    <button onClick={() => setActive("preventivecare")} style={{
      width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer",
      display: "block", textAlign: "left", marginBottom: 14,
    }}>
      <Card style={{ marginBottom: 0 }}>
        {shown.length ? shown.map(({ item, status }, i) => (
          <div key={item.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0",
            borderBottom: i < shown.length - 1 ? `1px solid ${COLORS.border}` : "none",
          }}>
            <span style={{ fontSize: 13, color: COLORS.textPrimary }}>{item.name}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: TONE[status], whiteSpace: "nowrap" }}>{STATUS_LABELS[status]}</span>
          </div>
        )) : (
          <div style={{ fontSize: 13, color: COLORS.textSecondary, padding: "4px 0" }}>
            All {counts.total} recommended screenings are up to date.
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}>
          {more > 0 ? `See all screenings (${more} more need attention)` : "See all screenings"} <ChevronRight size={13} />
        </div>
      </Card>
    </button>
  );
}

export { PreventiveCareCard };

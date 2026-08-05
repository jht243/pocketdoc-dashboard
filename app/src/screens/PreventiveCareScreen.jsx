import React, { useState } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";
import { useAuth } from "../lib/AuthContext";
import { saveScreenings } from "../lib/profileStore";

function PreventiveCareScreen({ setActive, userProfile, onCompletedItemsChange }) {
  const { user } = useAuth();
  const [completedItems, setCompletedItems] = useState(userProfile?.completedItems || {});
  const schedule = userProfile?.schedule || [];
  const urgencyColor = { overdue: COLORS.danger, due_soon: COLORS.warning, upcoming: COLORS.tealLight };
  const urgencyLabel = { overdue: "Overdue", due_soon: "Due soon", upcoming: "Upcoming" };
  const categories = [...new Set(schedule.map(i => i.category))];

  const toggleDone = (id) => {
    const next = { ...completedItems, [id]: !completedItems[id] };
    setCompletedItems(next);
    onCompletedItemsChange?.(next);
    if (user && schedule.length) {
      saveScreenings(user.id, schedule, next);
    }
  };

  if (!userProfile || schedule.length === 0) {
    return (
      <div style={{ padding: "24px 18px" }}>
        <button onClick={() => setActive("profile")} style={{
          background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
          color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
        }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
        </button>
        <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 10 }}>Preventive care</div>
        <Card style={{ textAlign: "center", padding: "30px 20px" }}>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
            Complete onboarding to generate your personal preventive care schedule.
          </div>
        </Card>
      </div>
    );
  }

  const overdue = schedule.filter(i => i.urgency === "overdue" && !completedItems[i.id]).length;
  const dueSoon = schedule.filter(i => i.urgency === "due_soon" && !completedItems[i.id]).length;

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("profile")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
      </button>
      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Preventive care</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>
        {overdue > 0 && <span style={{ color: COLORS.danger }}>{overdue} overdue</span>}
        {overdue > 0 && dueSoon > 0 && <span style={{ color: COLORS.textMuted }}> · </span>}
        {dueSoon > 0 && <span style={{ color: COLORS.warning }}>{dueSoon} due soon</span>}
      </div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 20 }}>
        Tap any item to mark it complete. Your health score updates automatically.
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <SectionLabel>{cat}</SectionLabel>
          <Card>
            {schedule.filter(i => i.category === cat).map((item, idx, arr) => {
              const done = completedItems[item.id];
              return (
                <div key={item.id} style={{
                  padding: "11px 0",
                  borderBottom: idx < arr.filter(i => i.category === cat).length - 1 ? `1px solid ${COLORS.border}` : "none",
                  opacity: done ? 0.55 : 1
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, textDecoration: done ? "line-through" : "none" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 3 }}>{item.frequency}</div>
                      <div style={{ fontSize: 10, color: COLORS.textMuted, fontStyle: "italic", lineHeight: 1.4 }}>{item.note}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                      {!done && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                          color: urgencyColor[item.urgency], background: `${urgencyColor[item.urgency]}20`
                        }}>{urgencyLabel[item.urgency]}</span>
                      )}
                      <button onClick={() => toggleDone(item.id)} style={{
                        background: done ? COLORS.tealLight : "none",
                        border: `1.5px solid ${done ? COLORS.tealLight : COLORS.border}`,
                        borderRadius: 14, width: 28, height: 28, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {done && <CheckCircle2 size={14} color={COLORS.onAccent} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
      <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, padding: "10px 12px", background: COLORS.bgCardAlt, borderRadius: 10 }}>
        Based on USPSTF guidelines, ACS, and American Thyroid Association recommendations. Discuss any flagged items with your physician.
      </div>
    </div>
  );
}

export { PreventiveCareScreen };

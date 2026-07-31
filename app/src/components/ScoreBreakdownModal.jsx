import React from "react";
import { AlertCircle, Calendar, ShieldCheck, X } from "lucide-react";
import { useScoreModel } from "../lib/scoring";
import { COLORS, SERIF } from "../theme/tokens";
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";

function ScoreBreakdownModal({ onClose, nutritionEnabled }) {
  const {
    baseItems, dailyItems,
    baseTotal, baseMax, dailyTotal, dailyMax,
  } = useScoreModel(nutritionEnabled);

  const statusMeta = {
    current: { color: COLORS.tealLight, label: "Current", icon: ShieldCheck },
    due_soon: { color: COLORS.warning, label: "Due soon", icon: Calendar },
    overdue: { color: COLORS.danger, label: "Overdue", icon: AlertCircle },
  };

  const ItemRow = ({ item, statusBadge, last }) => {
    const gap = item.max - item.pts;
    return (
      <div style={{ padding: "10px 0", borderBottom: last ? "none" : `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {statusBadge}
            <div>
              <div style={{ fontSize: 13 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>{item.detail || item.note}</div>
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: gap === 0 ? COLORS.tealLight : COLORS.textSecondary, whiteSpace: "nowrap" }}>
            {item.pts}/{item.max} pts
          </span>
        </div>
        {item.action && (
          <div style={{
            marginTop: 8, marginLeft: 26, display: "flex", justifyContent: "space-between",
            alignItems: "center", background: COLORS.bgCardAlt, borderRadius: 8, padding: "7px 10px"
          }}>
            <span style={{ fontSize: 12, color: COLORS.textPrimary }}>{item.action}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.tealLight }}>+{gap} pts</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%", zIndex: 100,
      background: COLORS.bgDeep, display: "flex", flexDirection: "column",
      padding: "20px 18px 100px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em" }}>Score breakdown</div>
        <button onClick={onClose} style={{
          background: COLORS.bgCardAlt, border: "none", borderRadius: 16, width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
        }}><X size={16} color={COLORS.textSecondary} /></button>
      </div>

      <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 18 }}>
        Your score has two parts. The base reflects whether you're current on the screenings
        and bloodwork that matter for your age. The daily score reflects how you're tracking
        right now, sleep, activity, and check-ins. Each item below shows what it's worth and
        what to do to earn the rest.
      </div>

      <SectionLabel>Base score &middot; {baseTotal} of {baseMax} pts &middot; long-term preventive care</SectionLabel>
      <Card>
        {baseItems.map((item, i) => (
          <ItemRow key={item.name} item={item}
            statusBadge={(() => { const m = statusMeta[item.status]; return <m.icon size={16} color={m.color} style={{ marginTop: 1 }} />; })()}
            last={i === baseItems.length - 1} />
        ))}
      </Card>

      <div style={{
        background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
        color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 18
      }}>
        Completing your colonoscopy, skin check, and this month's TRT panel would add
        {" "}{baseMax - baseTotal} pts to your base score on their own, no daily changes needed.
      </div>

      <SectionLabel>Daily score &middot; {dailyTotal} of {dailyMax} pts &middot; sleep, training, monitoring</SectionLabel>
      <Card>
        {dailyItems.map((item, i) => (
          <ItemRow key={item.name} item={item}
            statusBadge={<div style={{ width: 16 }} />}
            last={i === dailyItems.length - 1} />
        ))}
      </Card>

      {!nutritionEnabled && (
        <Card style={{ border: `1px dashed ${COLORS.textMuted}50` }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Want nutrition in your daily score?</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
            Turn it on from your profile. It becomes a real part of your daily score, and
            the other categories adjust their weight to make room for it.
          </div>
        </Card>
      )}

      <div style={{
        background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
        color: COLORS.textSecondary, lineHeight: 1.5
      }}>
        Completing this month's TRT panel would add {baseItems.find(i => i.name.includes("Monthly bloodwork"))?.max - baseItems.find(i => i.name.includes("Monthly bloodwork"))?.pts} pts
        to your base score, no daily changes needed.
      </div>
    </div>
  );
}

export { ScoreBreakdownModal };

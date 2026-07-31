import React, { useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import { BodyMetricHistory } from "../components/BodyMetricHistory";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

// ---- BODY SCREEN (vitals, sleep detail, weight & composition) ----
function BodyScreen({ setActive }) {
  const [editingGoals, setEditingGoals] = useState(false);
  const [weightGoal, setWeightGoal] = useState(195);
  const [bodyFatGoal, setBodyFatGoal] = useState(14);
  const [historyMetric, setHistoryMetric] = useState(null); // null | "weight" | "bodyfat"

  const currentWeight = 202;
  const currentBodyFat = 17.5;

  const sleepStages = [
    { label: "Deep", pct: 18, minutes: 78, color: COLORS.accent },
    { label: "REM", pct: 24, minutes: 104, color: COLORS.tealLight },
    { label: "Light", pct: 51, minutes: 220, color: COLORS.gold },
    { label: "Awake", pct: 7, minutes: 30, color: COLORS.textMuted },
  ];

  const StatCard = ({ label, value, unit, sub, subColor }) => (
    <Card style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value} <span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textMuted }}>{unit}</span></div>
      {sub && <div style={{ fontSize: 11, color: subColor || COLORS.textSecondary, marginTop: 2 }}>{sub}</div>}
    </Card>
  );

  return (
    <div style={{ padding: "24px 18px", position: "relative" }}>
      {historyMetric && <BodyMetricHistory metric={historyMetric} onClose={() => setHistoryMetric(null)} />}

      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Home
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Body</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Today's vitals, sleep detail, and body composition trends.
      </div>

      <SectionLabel>Readiness</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.warning}40` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>68</div>
            <div style={{ fontSize: 11, color: COLORS.warning }}>Pay attention &middot; below your typical range</div>
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "right", maxWidth: 160 }}>
            Combines HRV, resting heart rate, sleep, and temperature into one score from your
            device.
          </div>
        </div>
      </Card>

      <SectionLabel>Vitals</SectionLabel>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <StatCard label="HRV" value="42" unit="ms" sub="Below baseline" subColor={COLORS.warning} />
        <StatCard label="Resting heart rate" value="58" unit="bpm" sub="+6 vs 3wk avg" subColor={COLORS.warning} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <StatCard label="Breathing rate" value="15.2" unit="br/min" sub="Normal range" subColor={COLORS.tealLight} />
        <StatCard label="Skin temp deviation" value="+0.4" unit="&deg;F" sub="Elevated 2 of last 4 nights" subColor={COLORS.warning} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <StatCard label="Body temp" value="98.9" unit="&deg;F" sub="Elevated" subColor={COLORS.warning} />
        <Card style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>VO2 max</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>46.2 <span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textMuted }}>ml/kg/min</span></div>
          <div style={{ fontSize: 11, color: COLORS.tealLight, marginTop: 2 }}>+0.8 over 8 weeks</div>
        </Card>
      </div>

      <SectionLabel>Sleep last night &middot; 7h 12m</SectionLabel>
      <Card>
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 10 }}>
          {sleepStages.map(s => (
            <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {sleepStages.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: s.color }} />
              <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{s.label} {s.minutes}m ({s.pct}%)</span>
            </div>
          ))}
        </div>
      </Card>

      <SectionLabel>Body composition</SectionLabel>
      <Card>
        <button onClick={() => setHistoryMetric("weight")} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
          textAlign: "left"
        }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
              Weight <ChevronRight size={11} color={COLORS.textMuted} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{currentWeight} <span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textMuted }}>lb</span></div>
          </div>
          <div style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Goal</div>
            {editingGoals ? (
              <input type="number" value={weightGoal} onChange={e => setWeightGoal(Number(e.target.value))} style={{
                width: 60, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                color: COLORS.textPrimary, fontSize: 14, padding: "4px 6px", textAlign: "right"
              }} />
            ) : (
              <div style={{ fontSize: 14, color: COLORS.tealLight }}>{weightGoal} lb</div>
            )}
          </div>
        </button>

        <button onClick={() => setHistoryMetric("bodyfat")} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
          textAlign: "left"
        }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
              Body fat <ChevronRight size={11} color={COLORS.textMuted} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{currentBodyFat}<span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textMuted }}>%</span></div>
          </div>
          <div style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Goal</div>
            {editingGoals ? (
              <input type="number" value={bodyFatGoal} onChange={e => setBodyFatGoal(Number(e.target.value))} style={{
                width: 60, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                color: COLORS.textPrimary, fontSize: 14, padding: "4px 6px", textAlign: "right"
              }} />
            ) : (
              <div style={{ fontSize: 14, color: COLORS.tealLight }}>{bodyFatGoal}%</div>
            )}
          </div>
        </button>

        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 14 }}>
          Tap weight or body fat to see your trend over time.
        </div>

        <button onClick={() => setEditingGoals(!editingGoals)} style={{
          width: "100%", background: editingGoals ? COLORS.teal : "none",
          border: editingGoals ? "none" : `1px solid ${COLORS.border}`,
          color: editingGoals ? COLORS.onAccent : COLORS.tealLight,
          fontSize: 12, fontWeight: 600, padding: "9px", borderRadius: 8, cursor: "pointer"
        }}>
          {editingGoals ? "Save goals" : "Edit goals"}
        </button>
      </Card>
    </div>
  );
}

export { BodyScreen };

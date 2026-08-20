import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { BodyMetricHistory } from "../components/BodyMetricHistory";
import { Card } from "../components/Card";
import { LockedDataSection } from "../components/LockedDataSection";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

// ---- BODY SCREEN (vitals, sleep detail, weight & composition) ----
// Everything here is driven by real data on `healthData` (or the demo snapshot in
// test mode). Nothing is hardcoded: with no connected device the screen shows a
// locked state rather than inventing vitals for a real person.
function BodyScreen({ setActive, healthData }) {
  const [editingGoals, setEditingGoals] = useState(false);
  const [historyMetric, setHistoryMetric] = useState(null); // null | "weight" | "bodyfat"

  const today = healthData?.today;
  const body = healthData?.body;

  // Parse the leading number out of snapshot strings like "202 lb" / "17.5%".
  const num = (v) => {
    if (v == null) return null;
    const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const currentWeight = num(body?.weight);
  const currentBodyFat = num(body?.bodyFat);
  const [weightGoal, setWeightGoal] = useState(num(body?.weightGoal) ?? currentWeight ?? 0);
  const [bodyFatGoal, setBodyFatGoal] = useState(num(body?.bodyFatGoal) ?? currentBodyFat ?? 0);

  const StatCard = ({ label, value, unit, sub, subColor }) => (
    <Card style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value} <span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textMuted }}>{unit}</span></div>
      {sub && <div style={{ fontSize: 11, color: subColor || COLORS.textSecondary, marginTop: 2 }}>{sub}</div>}
    </Card>
  );

  const Header = () => (
    <>
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
    </>
  );

  // No connected device → no vitals to show. Never fabricate them.
  if (!today && !body) {
    return (
      <div style={{ padding: "24px 18px" }}>
        <Header />
        <LockedDataSection
          title="No body data yet"
          description="Connect a wearable (like Oura) to see readiness, HRV, resting heart rate, and body-composition trends here."
          actionLabel="Connect a device"
          onAction={() => setActive("profile")}
          rows={3}
        />
      </div>
    );
  }

  const hrvBelow = today?.hrv != null && today?.hrvBaseline != null && today.hrv < today.hrvBaseline;
  const rhrAbove = today?.restingHR != null && today?.restingHRBaseline != null && today.restingHR > today.restingHRBaseline;

  return (
    <div style={{ padding: "24px 18px", position: "relative" }}>
      {historyMetric && <BodyMetricHistory metric={historyMetric} onClose={() => setHistoryMetric(null)} />}

      <Header />

      {today?.readiness != null && (<>
        <SectionLabel>Readiness</SectionLabel>
        <Card style={{ border: `1px solid ${COLORS.warning}40` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{today.readiness}</div>
              {today.readinessTypical != null && (
                <div style={{ fontSize: 11, color: COLORS.warning }}>
                  {today.readiness < today.readinessTypical ? "Below your typical range" : "In your typical range"}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "right", maxWidth: 160 }}>
              Combines HRV, resting heart rate, sleep, and temperature into one score from your
              device.
            </div>
          </div>
        </Card>
      </>)}

      {today && (today.hrv != null || today.restingHR != null || today.skinTempDeviation != null) && (<>
        <SectionLabel>Vitals</SectionLabel>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {today.hrv != null && (
            <StatCard label="HRV" value={today.hrv} unit="ms"
              sub={today.hrvBaseline != null ? (hrvBelow ? "Below baseline" : "At/above baseline") : null}
              subColor={hrvBelow ? COLORS.warning : COLORS.tealLight} />
          )}
          {today.restingHR != null && (
            <StatCard label="Resting heart rate" value={today.restingHR} unit="bpm"
              sub={today.restingHRBaseline != null ? `${rhrAbove ? "+" : ""}${today.restingHR - today.restingHRBaseline} vs baseline` : null}
              subColor={rhrAbove ? COLORS.warning : COLORS.tealLight} />
          )}
          {today.skinTempDeviation != null && (
            <StatCard label="Skin temp deviation" value={`${today.skinTempDeviation > 0 ? "+" : ""}${today.skinTempDeviation}`} unit="°F"
              sub="vs. baseline" subColor={today.skinTempDeviation > 0 ? COLORS.warning : COLORS.tealLight} />
          )}
        </div>
      </>)}

      {(currentWeight != null || currentBodyFat != null) && (<>
        <SectionLabel>Body composition</SectionLabel>
        <Card>
          {currentWeight != null && (
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
          )}

          {currentBodyFat != null && (
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
          )}

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
      </>)}
    </div>
  );
}

export { BodyScreen };

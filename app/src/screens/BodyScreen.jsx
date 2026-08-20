import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { BodyMetricHistory } from "../components/BodyMetricHistory";
import { Card } from "../components/Card";
import { LockedDataSection } from "../components/LockedDataSection";
import { SectionLabel } from "../components/SectionLabel";
import { formatHoursMinutes } from "../lib/wearableShape";
import { COLORS, SERIF } from "../theme/tokens";

// ---- BODY SCREEN (vitals, sleep detail, weight & composition) ----
// Everything here is driven by real data on `healthData` (or the demo snapshot in
// test mode). Nothing is hardcoded: with no connected device the screen shows a
// locked state rather than inventing vitals for a real person.
function BodyScreen({ setActive, healthData }) {
  const [editingGoals, setEditingGoals] = useState(false);
  const [historyMetric, setHistoryMetric] = useState(null); // null | "weight" | "bodyfat"
  const [showAllMetrics, setShowAllMetrics] = useState(false); // collapsed by default

  const today = healthData?.today;
  const body = healthData?.body;
  const metrics = healthData?.metrics || [];

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
      {historyMetric && (
        <BodyMetricHistory
          metric={historyMetric}
          series={historyMetric === "weight" ? body?.weightSeries : body?.bodyFatSeries}
          goal={historyMetric === "weight" ? weightGoal : bodyFatGoal}
          onClose={() => setHistoryMetric(null)}
        />
      )}

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

      {today && (today.hrv != null || today.restingHR != null || today.skinTempDeviation != null || today.spo2 != null) && (<>
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
            <StatCard label="Skin temp deviation" value={`${today.skinTempDeviation > 0 ? "+" : ""}${today.skinTempDeviation}`} unit="°C"
              sub="vs. baseline" subColor={today.skinTempDeviation > 0 ? COLORS.warning : COLORS.tealLight} />
          )}
          {today.spo2 != null && (
            <StatCard label="Blood oxygen" value={today.spo2} unit="%"
              sub={today.spo2 >= 95 ? "Normal range" : "Below typical"}
              subColor={today.spo2 >= 95 ? COLORS.tealLight : COLORS.warning} />
          )}
        </div>
      </>)}

      {today && today.sleepScore != null && (<>
        <SectionLabel>Sleep last night</SectionLabel>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>Sleep score</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{today.sleepScore}</div>
            </div>
            {today.totalSleepMinutes != null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>Time asleep</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{formatHoursMinutes(today.totalSleepMinutes)}</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 0, flexWrap: "wrap", borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
            {[
              { label: "Deep", value: today.deepSleepMinutes != null ? formatHoursMinutes(today.deepSleepMinutes) : null },
              { label: "REM", value: today.remSleepMinutes != null ? formatHoursMinutes(today.remSleepMinutes) : null },
              { label: "Awake", value: today.awakeMinutes != null ? formatHoursMinutes(today.awakeMinutes) : null },
              { label: "Efficiency", value: today.sleepEfficiency != null ? `${Math.round(today.sleepEfficiency * 100)}%` : null },
              { label: "Avg HR", value: today.averageHR != null ? `${today.averageHR} bpm` : null },
            ].filter((s) => s.value != null).map((s, i, arr) => (
              <div key={s.label} style={{ flex: "1 0 33%", textAlign: "center", padding: "4px 0" }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </>)}

      {today && (today.steps != null || today.activityScore != null || today.activeCalories != null) && (<>
        <SectionLabel>Activity</SectionLabel>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {today.steps != null && (
            <StatCard label="Steps" value={today.steps.toLocaleString()} unit="" />
          )}
          {today.activeCalories != null && (
            <StatCard label="Active calories" value={today.activeCalories.toLocaleString()} unit="kcal" />
          )}
          {today.activityScore != null && (
            <StatCard label="Activity score" value={today.activityScore} unit="" />
          )}
          {today.zone2Minutes != null && (
            <StatCard label="Active minutes" value={today.zone2Minutes} unit="min" sub="MET 4+" />
          )}
        </div>
      </>)}

      {metrics.length > 0 && (<>
        <button onClick={() => setShowAllMetrics((v) => !v)} style={{
          width: "100%", background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 10,
          color: COLORS.textSecondary, fontSize: 12, fontWeight: 600, padding: "10px 14px", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14
        }}>
          <span>All collected metrics ({metrics.length})</span>
          <ChevronDown size={14} style={{ transform: showAllMetrics ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>

        {showAllMetrics && (
          <Card>
            <div style={{ display: "flex", fontSize: 10, color: COLORS.textMuted, paddingBottom: 8, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 4 }}>
              <div style={{ flex: 2 }}>Metric</div>
              <div style={{ flex: 1, textAlign: "right" }}>Latest</div>
              <div style={{ flex: 1.4, textAlign: "right" }}>Range (30d)</div>
            </div>
            {metrics.map((m) => (
              <div key={m.key} style={{ display: "flex", alignItems: "center", fontSize: 12, padding: "7px 0", borderBottom: `1px solid ${COLORS.border}40` }}>
                <div style={{ flex: 2, color: COLORS.textSecondary }}>{m.label}</div>
                <div style={{ flex: 1, textAlign: "right", fontWeight: 700 }}>{m.current ?? "—"}</div>
                <div style={{ flex: 1.4, textAlign: "right", color: COLORS.textMuted, fontSize: 11 }}>
                  {m.samples > 1 ? `${m.low}–${m.high}` : "—"}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 10 }}>
              Range shows the lowest and highest readings over the last 30 days synced from your device.
            </div>
          </Card>
        )}
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

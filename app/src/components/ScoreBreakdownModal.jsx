import React from "react";
import { AlertCircle, Calendar, ShieldCheck, X } from "lucide-react";
import { useScoreModel } from "../lib/scoring";
import { COLORS, SERIF } from "../theme/tokens";
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";

/** Tier → the palette already in use, rather than a second set of greens and reds. */
const TIER_COLORS = {
  excellent: COLORS.good,
  good: COLORS.good,
  fair: COLORS.gold,
  poor: COLORS.warning,
  critical: COLORS.danger,
};

const TIER_LABELS = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  critical: "Critical",
};

/** "77 ms vs 95 ms usual · 19% below" — the whole reason the score is personal. */
function metricDetail(metric) {
  if (!metric.recorded) return metric.note || "Not recorded";
  const unit = metric.unit ? `${metric.unit === "%" ? "" : " "}${metric.unit}` : "";
  const value = `${metric.value}${unit}`;
  if (metric.baseline == null) return `${value} · no personal baseline yet`;
  const direction = metric.deviationPct == null ? null
    : metric.deviationPct === 0 ? "at your usual"
    : `${Math.abs(metric.deviationPct)}% ${metric.deviationPct > 0 ? "better than" : "off"} your usual`;
  return [`${value} vs ${metric.baseline}${unit} usual`, direction].filter(Boolean).join(" · ");
}

function ScoreBreakdownModal({ onClose, nutritionEnabled, healthData, userProfile }) {
  const {
    baseItems, preventiveTotal, preventiveMax, preventiveDisplay,
    wearable, bloodwork, totalScore, totalMax,
  } = useScoreModel(nutritionEnabled, healthData, userProfile);

  const statusMeta = {
    current: { color: COLORS.tealLight, label: "Current", icon: ShieldCheck },
    due: { color: COLORS.warning, label: "Due", icon: Calendar },
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
      </div>
    );
  };

  /** One scored biometric: what it read, what's usual for them, which tier, what it earned. */
  const MetricRow = ({ metric, last }) => (
    <div style={{ padding: "10px 0", borderBottom: last ? "none" : `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13 }}>{metric.label}</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>{metricDetail(metric)}</div>
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: TIER_COLORS[metric.tier] }}>
            {(TIER_LABELS[metric.tier] || metric.tier).toUpperCase()}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>{metric.points}/{metric.max} pts</div>
        </div>
      </div>
      {metric.floorApplied && (
        <div style={{ fontSize: 10, color: COLORS.warning, marginTop: 4 }}>
          Clinical floor applied — below {metric.floorApplied.below}{metric.unit === "%" ? "%" : ` ${metric.unit}`} regardless of your baseline.
        </div>
      )}
    </div>
  );

  /** One blood marker: what it read, which band it fell in, what it earned. */
  const MarkerRow = ({ marker, last }) => (
    <div style={{ padding: "10px 0", borderBottom: last ? "none" : `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13 }}>{marker.label}</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {marker.value}{marker.unit ? ` ${marker.unit}` : ""}
            {marker.reportedAs ? ` (reported as ${marker.reportedAs})` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {marker.excluded ? (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: COLORS.textMuted }}>NOT SCORED</div>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: TIER_COLORS[marker.tier] }}>
                {(TIER_LABELS[marker.tier] || marker.tier).toUpperCase()}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>{marker.points}/{marker.max} pts</div>
            </>
          )}
        </div>
      </div>
      {marker.excluded && marker.note && (
        <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.4 }}>{marker.note}</div>
      )}
    </div>
  );

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
        Your score is {totalScore} of {totalMax}. Preventive care reflects whether you're current
        on the screening that matters for your age. The wearable part is calculated from your raw
        biometrics measured against your own normal, so the same reading can mean different things
        for different people. Bloodwork is measured against published clinical thresholds instead.
        A component only counts once there's enough data behind it to mean something.
      </div>

      {wearable && (
        <>
          <SectionLabel>
            Wearable &middot; {wearable.totalScore} of {wearable.max} pts &middot; {wearable.label}
          </SectionLabel>

          {wearable.alerts?.length > 0 && (
            <Card style={{ border: `1px solid ${COLORS.danger}40`, background: COLORS.badDim }}>
              {wearable.alerts.map((alert) => (
                <div key={alert.metric} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                  <AlertCircle size={15} color={COLORS.danger} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: COLORS.textPrimary, lineHeight: 1.5 }}>{alert.message}</div>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6 }}>
              Today &middot; {wearable.dailyScore} of {wearable.dailyMax} pts
            </div>
            {wearable.daily.map((metric, i) => (
              <MetricRow key={metric.key} metric={metric} last={i === wearable.daily.length - 1} />
            ))}
          </Card>

          <Card>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6 }}>
              Direction of travel &middot; {wearable.trendScore} of {wearable.trendMax} pts &middot; last 7 days vs your 20-day normal
            </div>
            {wearable.trend.map((metric, i) => (
              <MetricRow key={metric.key} metric={metric} last={i === wearable.trend.length - 1} />
            ))}
          </Card>

          <div style={{
            background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
            color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 18
          }}>
            {wearable.confidence.note} Confidence: {wearable.confidence.percent}%
            {wearable.confidence.historyDays != null && ` (${wearable.confidence.historyDays} days of history)`}.
          </div>
        </>
      )}

      {baseItems.length > 0 && (
        <>
          <SectionLabel>
            Preventive care &middot; {preventiveDisplay} of 50 pts &middot; {preventiveTotal} of {preventiveMax} screening points
          </SectionLabel>
          <Card>
            {baseItems.map((item, i) => (
              <ItemRow key={item.name} item={item}
                statusBadge={(() => {
                  const meta = statusMeta[item.status] || statusMeta.due;
                  return <meta.icon size={16} color={meta.color} style={{ marginTop: 1 }} />;
                })()}
                last={i === baseItems.length - 1} />
            ))}
          </Card>

          {preventiveMax > preventiveTotal && <div style={{
            background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
            color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 18
          }}>
            Completing the outstanding preventive-care items would take this component to the
            full 50 pts, without any daily changes needed.
          </div>}
        </>
      )}

      {bloodwork?.available && (
        <>
          <SectionLabel>
            Bloodwork &middot; {bloodwork.totalScore} of {bloodwork.max} pts &middot; {bloodwork.label}
          </SectionLabel>

          {bloodwork.alerts?.length > 0 && (
            <Card style={{ border: `1px solid ${COLORS.warning}40`, background: COLORS.warnDim }}>
              {bloodwork.alerts.map((alert) => (
                <div key={alert.marker} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                  <AlertCircle size={15} color={alert.severity === "info" ? COLORS.textMuted : COLORS.warning}
                    style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: COLORS.textPrimary, lineHeight: 1.5 }}>{alert.message}</div>
                </div>
              ))}
            </Card>
          )}

          {bloodwork.panels.map((panel) => (
            <Card key={panel.key}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6 }}>
                {panel.label} &middot; {panel.points} of {panel.covered} pts measured
              </div>
              {panel.markers.map((marker, i) => (
                <MarkerRow key={marker.key} marker={marker} last={i === panel.markers.length - 1} />
              ))}
            </Card>
          ))}

          <div style={{
            background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
            color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 18
          }}>
            {bloodwork.confidence.note} Unlike the wearable half, blood markers are scored
            against published clinical thresholds rather than your own history — an ApoB of
            130 means the same thing in everyone.
          </div>
        </>
      )}

      {bloodwork && !bloodwork.available && (
        <Card style={{ border: `1px dashed ${COLORS.textMuted}50` }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Bloodwork &middot; not scored yet</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
            {bloodwork.unavailableReason} {bloodwork.confidence.note} Until then it isn't
            counted for or against you, and your labs are still read by your advocate and
            shown on the Labs screen.
          </div>
        </Card>
      )}
    </div>
  );
}

export { ScoreBreakdownModal };

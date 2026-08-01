import React, { useState } from "react";
import { Activity, AlertTriangle, Bell, ChevronRight, Moon, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { ScoreBreakdownModal } from "../components/ScoreBreakdownModal";
import { ScoreGauge } from "../components/ScoreGauge";
import { LockedDataSection } from "../components/LockedDataSection";
import { getDailyRecommendation } from "../lib/recommendations";
import { useScoreModel } from "../lib/scoring";
import { COLORS, SERIF, SHADOW } from "../theme/tokens";

function HomeScreen({
  setActive, goToMarket, nutritionEnabled, userProfile, healthHistory, healthData,
  testModeEnabled, testModeSaving, onTestModeChange,
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const score = useScoreModel(nutritionEnabled, healthData);
  const { baseDisplay, dailyDisplay } = score;
  const rec = getDailyRecommendation(healthData);
  const hasHealthData = Boolean(
    healthData?.labs?.length || healthData?.records?.length || healthData?.vitals?.length || healthData?.today || healthData?.score
  );
  const userName = userProfile?.profile?.name || "there";
  const initials = userName !== "there" ? userName[0].toUpperCase() : "?";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Two vitals chips from wearables — shown only when data exists
  const vitals = (healthData?.vitals || []).map((v) => ({
    ...v,
    color: v.color === "warning" ? COLORS.warning : v.color === "danger" ? COLORS.danger : COLORS.tealLight,
  }));

  // One contextual action button — the single most time-sensitive thing
  const contextualAction = (() => {
    if (!userProfile) return null;
    const overdue = userProfile.schedule?.filter(i => i.urgency === "overdue").length || 0;
    if (overdue > 0) return { label: `${overdue} overdue screening${overdue > 1 ? "s" : ""}`, target: "preventivecare", color: COLORS.danger };
    if (!healthHistory) return { label: "Complete your health history", target: "healthhistory", color: COLORS.tealLight };
    return null;
  })();

  return (
    <div style={{ padding: "24px 18px", position: "relative" }}>
      {showBreakdown && <ScoreBreakdownModal onClose={() => setShowBreakdown(false)} nutritionEnabled={nutritionEnabled} healthData={healthData} />}

      {/* Brand bar — matches the live dashboard */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: SERIF, fontWeight: 600, fontSize: 17, letterSpacing: "-0.01em" }}>
          <div style={{
            width: 27, height: 27, borderRadius: 9,
            background: "linear-gradient(135deg, #0ea5e9, #22c55e)",
            display: "grid", placeItems: "center",
            boxShadow: "0 2px 8px rgba(14,165,233,0.3)"
          }}>
            <Activity size={15} color="#fff" strokeWidth={2.5} />
          </div>
          PocketDoc
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            role="switch"
            aria-checked={testModeEnabled}
            aria-label="Toggle test mode"
            disabled={testModeSaving}
            onClick={() => onTestModeChange?.(!testModeEnabled)}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 7px", borderRadius: 10,
              cursor: testModeSaving ? "wait" : "pointer", fontSize: 10, fontWeight: 700,
              color: testModeEnabled ? COLORS.onAccent : COLORS.textMuted,
              background: testModeEnabled ? COLORS.teal : COLORS.bgCard,
              border: `1px solid ${testModeEnabled ? COLORS.teal : COLORS.border}`,
              opacity: testModeSaving ? 0.65 : 1,
            }}
          >
            Test
            <span style={{
              width: 22, height: 13, borderRadius: 8, padding: 2, display: "flex", alignItems: "center",
              justifyContent: testModeEnabled ? "flex-end" : "flex-start",
              background: testModeEnabled ? "rgba(255,255,255,0.35)" : COLORS.border,
            }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: testModeEnabled ? "#fff" : COLORS.textMuted }} />
            </span>
          </button>
          <button style={{
            width: 40, height: 40, borderRadius: 14, background: COLORS.bgCard,
            border: `1px solid ${COLORS.border}`, boxShadow: SHADOW,
            display: "grid", placeItems: "center", position: "relative", cursor: "pointer", padding: 0
          }}>
            <Bell size={18} color={COLORS.textSecondary} strokeWidth={1.9} />
            <span style={{
              position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: "50%",
              background: COLORS.accent, boxShadow: "0 0 0 3px rgba(2,132,199,0.15)"
            }} />
          </button>
          <button onClick={() => setActive("profile")} style={{
            width: 40, height: 40, borderRadius: 14, cursor: "pointer", padding: 0,
            background: "linear-gradient(135deg, #0369a1, #15803d)",
            border: `1px solid ${COLORS.strokeStrong}`,
            display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13,
            letterSpacing: "0.02em", color: "#ffffff"
          }}>{initials}</button>
        </div>
      </div>

      {/* Greeting */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 26, letterSpacing: "-0.01em", color: COLORS.textPrimary }}>
          {greeting}{userName && userName !== "there" ? `, ${userName}` : ""}
        </h1>
        <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 2 }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Element 1: Health score — one number, one sentence */}
      {score.hasData ? (
        <button onClick={() => setShowBreakdown(true)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", marginBottom: 14 }}>
          <Card style={{ marginBottom: 0, textAlign: "center", paddingTop: 20, paddingBottom: 20 }}>
            <ScoreGauge basePts={baseDisplay} baseMax={50} dailyPts={dailyDisplay} dailyMax={50} onTap={() => setShowBreakdown(true)} />
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 10 }}>Tap to see what's driving your score today</div>
          </Card>
        </button>
      ) : (
        <LockedDataSection
          title="Your health score"
          description="Unlock your score by importing a lab result or connecting health data."
          actionLabel="Import lab results"
          onAction={() => setActive("importlabs")}
          rows={3}
        />
      )}

      {/* Element 2: One action card — the single highest-priority signal */}
      {rec && (() => {
        const iconMap = { alert: AlertTriangle, moon: Moon, activity: Activity, sparkles: Sparkles };
        const Icon = iconMap[rec.icon] || Sparkles;
        const isUrgent = rec.priority >= 90;
        const color = isUrgent ? COLORS.warning : COLORS.tealLight;
        return (
          <Card style={{ border: `1px solid ${color}40`, background: isUrgent ? COLORS.warnDim : COLORS.bgCard, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Icon size={18} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{rec.title}</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>{rec.body}</div>
                {rec.action && (
                  <button style={{ marginTop: 10, background: "none", border: `1px solid ${color}`, color, fontSize: 11, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: "pointer" }}
                    onClick={() => { if (rec.action.target === "discussion" || rec.action.target === "bodyfat_history") setActive(rec.action.target === "bodyfat_history" ? "body" : "discussion"); else goToMarket(rec.action.target); }}>
                    {rec.action.label} <ChevronRight size={11} style={{ display: "inline", verticalAlign: -1 }} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Element 3: Two vitals chips from wearables */}
      {vitals.length > 0 && <button onClick={() => setActive("body")} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", marginBottom: 14 }}>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", gap: 0 }}>
            {vitals.map((v, i) => (
              <div key={v.label} style={{ flex: 1, textAlign: "center", padding: "4px 0", borderRight: i < vitals.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>{v.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{v.value}</div>
                <div style={{ fontSize: 10, color: v.color }}>{v.sub}</div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", paddingLeft: 12 }}>
              <ChevronRight size={14} color={COLORS.textMuted} />
            </div>
          </div>
        </Card>
      </button>}

      {!hasHealthData && <LockedDataSection
        title="Today's signals"
        description="Upload your first result to start unlocking trends, daily signals, and tailored next steps."
        actionLabel="Upload a result"
        onAction={() => setActive("importlabs")}
      />}

      {/* Element 4: One contextual action — the most time-sensitive item */}
      {contextualAction && (
        <button onClick={() => setActive(contextualAction.target)} style={{ width: "100%", background: "none", border: `1px solid ${contextualAction.color}40`, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ fontSize: 13, color: contextualAction.color, fontWeight: 600 }}>{contextualAction.label}</span>
          <ChevronRight size={14} color={contextualAction.color} />
        </button>
      )}
    </div>
  );
}

export { HomeScreen };

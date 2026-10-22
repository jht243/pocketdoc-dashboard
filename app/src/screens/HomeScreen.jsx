import React from "react";
import { Activity, AlertCircle, AlertTriangle, ChevronRight, Moon, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { LockedDataSection } from "../components/LockedDataSection";
import { UrgentBanner } from "../components/UrgentBanner";
import { intakeProgressSummary } from "../lib/intakeContent";
import { buildThumbprintChecklist } from "../lib/thumbprintChecklist";
import { ThumbprintChecklist } from "../components/ThumbprintChecklist";
import { CheckInCard } from "../components/CheckInCard";
import { BioAgeHero } from "../components/BioAgeCard";
import { PreventiveCareCard } from "../components/PreventiveCareCard";
import { queueChatQuestion } from "../lib/chatHandoff";
import { getDailyRecommendation } from "../lib/recommendations";
import { insightActionLabel, liveInsightAction, runInsightAction } from "../lib/insightActions";
import { formatHoursMinutes } from "../lib/wearableShape";
import { BrandMark } from "../components/BrandMark";
import { EvidenceBox } from "../components/EvidenceBox";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, DISPLAY } from "../theme/tokens";

function HomeScreen({
  setActive, userProfile, healthHistory, healthData, aiInsights,
}) {
  // Once the AI insights have loaded (aiInsights !== null) they govern this card —
  // including deliberately showing nothing. Until then (or if the AI is unavailable)
  // fall back to the deterministic recommendation so the card is never empty.
  // Section 7 of the clinical spec: an urgent pattern stops the standard workflow.
  // When one is present it is the only signal on this card slot — burying it under,
  // or beside, a card about sleep is exactly what the rule forbids.
  const urgent = aiInsights?.urgent || [];
  // A "worth repeating" note is not an emergency, so it sits in the same banner but
  // does not clear the rest of the screen the way a real escalation does.
  const recheck = aiInsights?.recheck || [];
  const rec = urgent.length ? null : (aiInsights ? aiInsights.daily : getDailyRecommendation(healthData));
  const hasHealthData = Boolean(
    healthData?.labs?.length || healthData?.records?.length || healthData?.vitals?.length || healthData?.today || healthData?.score
  );
  // Until the baseline (blood panel, PGx, CGx, health history) is in, the checklist
  // leads Home in place of the locked score — Sep 30 call: "we can't get a health
  // score until we have genetics, pharmacology, and our first full blood panel."
  const checklist = buildThumbprintChecklist({ healthData, userProfile, healthHistory });
  const showChecklist = !checklist.complete;
  const userName = userProfile?.profile?.name || "there";
  const initials = userName !== "there" ? userName[0].toUpperCase() : "?";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Two vitals chips from wearables — shown only when data exists
  const vitals = (healthData?.vitals || []).map((v) => ({
    ...v,
    color: v.color === "warning" ? COLORS.warning : v.color === "danger" ? COLORS.danger : COLORS.tealLight,
  }));

  // Last-night glance — sleep score + steps, the two daily-refresh numbers worth
  // seeing without opening Body. Each half renders only when its metric exists.
  const today = healthData?.today;
  const dailyGlance = today && (today.sleepScore != null || today.steps != null)
    ? [
        today.sleepScore != null && {
          icon: Moon, label: "Sleep",
          value: String(today.sleepScore),
          sub: today.totalSleepMinutes != null ? `${formatHoursMinutes(today.totalSleepMinutes)} asleep` : "score",
        },
        today.steps != null && {
          icon: Activity, label: "Steps",
          value: today.steps.toLocaleString(),
          sub: today.activeCalories != null ? `${today.activeCalories.toLocaleString()} kcal` : "today",
        },
      ].filter(Boolean)
    : [];

  // One contextual action button. Screenings have their own card now, so this is
  // only the unfinished health history.
  const contextualAction = (() => {
    if (!userProfile) return null;
    // Read from the saved answers, not from whether the screen was opened this session —
    // the old check nagged every member again after each reload.
    const intake = intakeProgressSummary(healthHistory || userProfile.intake);
    if (!intake.complete && !showChecklist) return { label: `Finish your health history · ${intake.done} of ${intake.total} done`, target: "healthhistory", color: COLORS.tealLight };
    return null;
  })();

  // The button under the bio age asks the care team, with the member's record in front
  // of it, rather than opening a page of generic tips.
  const askToReduce = () => {
    queueChatQuestion("Help me reduce my biological age.");
    setActive("aichat");
  };

  return (
    <div style={{ padding: "24px 18px", position: "relative" }}>
      {/* Brand bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <BrandMark size={26} fontSize={15} />
        {/* No notifications bell: nothing feeds notifications, and a bell that opens
            nothing is a fake control. What is pending for the member already sits on
            this screen — the check-in card, the overdue-screening button — and a due
            provider follow-up is asked inside the check-in. */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setActive("account")} aria-label="Your account" style={{
            width: 36, height: 36, borderRadius: "50%", cursor: "pointer", padding: 0,
            background: COLORS.brand, border: "none",
            display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13,
            letterSpacing: "0.02em", color: COLORS.onAccent
          }}>{initials}</button>
        </div>
      </div>

      {/* Greeting */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 24, letterSpacing: "-0.01em", color: COLORS.textPrimary }}>
          {greeting}{userName && userName !== "there" ? `, ${userName}` : ""}
        </h1>
        <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 2 }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Element 0: urgency. Always first, before the bio age and before any card. */}
      <UrgentBanner items={[...urgent, ...recheck]} />

      <SectionLabel>This morning</SectionLabel>
      <CheckInCard checkIns={healthData?.checkIns || []} setActive={setActive} />

      {showChecklist && <>
        <SectionLabel>Your Thumbprint</SectionLabel>
        <ThumbprintChecklist checklist={checklist} setActive={setActive} />
      </>}

      {/* Element 1: biological age in the circle, with the button that asks how to
          bring it down. It replaced the Health Score dial on Oct 21 2026. */}
      <SectionLabel>Your biological age</SectionLabel>
      <BioAgeHero healthData={healthData} userProfile={userProfile} setActive={setActive} onReduce={askToReduce} />

      {/* Element 1b: what's due. Preventive care used to reach Home through the score. */}
      {userProfile?.schedule?.length > 0 && <SectionLabel>Preventive care</SectionLabel>}
      <PreventiveCareCard userProfile={userProfile} setActive={setActive} />

      {/* Element 2: One action card — the single highest-priority signal */}
      {rec && <SectionLabel>Top insight</SectionLabel>}
      {rec && (() => {
        // Hard rule: the sparkle icon means "AI-authored". Deterministic fallback
        // cards use a normal icon and never the star.
        const iconMap = { alert: AlertTriangle, moon: Moon, activity: Activity, sparkles: AlertCircle };
        const Icon = rec.ai ? Sparkles : (iconMap[rec.icon] || AlertCircle);
        const isUrgent = rec.priority >= 90;
        const color = isUrgent ? COLORS.warning : COLORS.tealLight;
        return (
          <Card style={{ border: `1px solid ${color}40`, background: isUrgent ? COLORS.warnDim : COLORS.bgCard, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Icon size={18} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{rec.title}</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>{rec.body}</div>
                {/* Which reference point this was judged against, and where the numbers
                    came from — Rule 1.3 says the comparison must be stated, not implied. */}
                {rec.basis && <EvidenceBox>{rec.basis}</EvidenceBox>}
                {liveInsightAction(rec.action) && (
                  <button style={{ marginTop: 10, background: "none", border: `1px solid ${color}`, color, fontSize: 11, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: "pointer" }}
                    onClick={() => runInsightAction(rec.action, { setActive })}>
                    {insightActionLabel(rec.action)} <ChevronRight size={11} style={{ display: "inline", verticalAlign: -1 }} />
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

      {/* Element 3b: Last-night glance — sleep + steps */}
      {dailyGlance.length > 0 && <button onClick={() => setActive("body")} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", marginBottom: 14 }}>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", gap: 0 }}>
            {dailyGlance.map((g, i) => {
              const Icon = g.icon;
              return (
                <div key={g.label} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "2px 0", borderRight: i < dailyGlance.length - 1 ? `1px solid ${COLORS.border}` : "none", paddingLeft: i > 0 ? 14 : 0 }}>
                  <Icon size={18} color={COLORS.tealLight} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted }}>{g.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{g.value}</div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted }}>{g.sub}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", paddingLeft: 12 }}>
              <ChevronRight size={14} color={COLORS.textMuted} />
            </div>
          </div>
        </Card>
      </button>}

      {!hasHealthData && !showChecklist && <LockedDataSection
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

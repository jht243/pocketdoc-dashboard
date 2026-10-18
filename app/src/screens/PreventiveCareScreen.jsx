import React, { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, ClipboardList } from "lucide-react";
import { Card } from "../components/Card";
import { ScreeningMonthYear } from "../components/ScreeningMonthYear";
import { ScreeningQuestionnaire } from "../components/ScreeningQuestionnaire";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, DISPLAY } from "../theme/tokens";
import { useAuth } from "../lib/AuthContext";
import { saveScreeningQuestionnaire, saveScreenings } from "../lib/profileStore";
import { currentYearMonth, formatCompletedMonth, isScreeningDone } from "../lib/screeningDates";
import { STATUS, STATUS_LABELS, screeningStatus, summarizeSchedule } from "../lib/screeningLogic";
import { QUESTIONNAIRE_FOR_ITEM } from "../lib/screeningQuestionnaires";
import { scrollPhoneToTop } from "../lib/scroll";

// Status colours. "Not on file" and "Check eligibility" are neutral on purpose: we
// don't know the member hasn't had the screening, so it isn't a warning.
const STATUS_STYLE = {
  [STATUS.OVERDUE]: { color: COLORS.danger, background: COLORS.badDim },
  [STATUS.DUE_SOON]: { color: COLORS.warning, background: COLORS.warnDim },
  [STATUS.CURRENT]: { color: COLORS.good, background: COLORS.goodDim },
  [STATUS.NOT_ON_FILE]: { color: COLORS.textMuted, background: COLORS.neutralDim },
  [STATUS.CHECK_ELIGIBILITY]: { color: COLORS.textMuted, background: COLORS.neutralDim },
};

const pill = (color, solid = false) => ({
  background: solid ? color : "none",
  border: `1px solid ${solid ? color : `${color}59`}`,
  color: solid ? COLORS.onAccent : color,
  borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 700,
  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
});

function PreventiveCareScreen({ setActive, goBack, backLabel, userProfile, onCompletedItemsChange }) {
  const { user } = useAuth();
  const [completedItems, setCompletedItems] = useState(userProfile?.completedItems || {});
  // The questionnaire open over the list, if any (phq2 / gad2 / auditc / single_drug).
  const [questionnaire, setQuestionnaire] = useState(null);
  const schedule = userProfile?.schedule || [];
  const categories = [...new Set(schedule.map(i => i.category))];

  useEffect(() => {
    setCompletedItems(userProfile?.completedItems || {});
  }, [userProfile?.completedItems]);

  const persist = async (next) => {
    setCompletedItems(next);
    onCompletedItemsChange?.(next);
    if (!user || !schedule.length) return;
    const { error } = await saveScreenings(user.id, schedule, next);
    if (error) console.error("PreventiveCareScreen/saveScreenings", error);
  };

  const openQuestionnaire = (id) => {
    setQuestionnaire(id);
    scrollPhoneToTop();
  };

  // A finished questionnaire stores its answers, then marks its schedule item done
  // for this month through the same path as any other tick.
  const completeQuestionnaire = async (result) => {
    await persist({ ...completedItems, [result.scheduleKey]: currentYearMonth() });
    if (!user) return { error: null };
    return saveScreeningQuestionnaire(user.id, result);
  };

  const toggleDone = (id) => {
    const next = { ...completedItems };
    if (isScreeningDone(completedItems[id])) {
      delete next[id];
    } else {
      next[id] = currentYearMonth();
    }
    persist(next);
  };

  const setCompletedAt = (id, value) => {
    persist({ ...completedItems, [id]: value });
  };

  if (!userProfile || schedule.length === 0) {
    return (
      <div style={{ padding: "24px 18px" }}>
        <button onClick={goBack} style={{
          background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
          color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
        }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> {backLabel}
        </button>
        <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 10 }}>Preventive care</div>
        <Card style={{ textAlign: "center", padding: "30px 20px" }}>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
            Complete onboarding to generate your personal preventive care schedule.
          </div>
        </Card>
      </div>
    );
  }

  const counts = summarizeSchedule(schedule, completedItems);
  // Alarming colours only for what's genuinely due; "not on file" reads neutral.
  const headline = [
    counts.overdue > 0 && { text: `${counts.overdue} overdue`, color: COLORS.danger },
    counts.due_soon > 0 && { text: `${counts.due_soon} due soon`, color: COLORS.warning },
    counts.current > 0 && { text: `${counts.current} up to date`, color: COLORS.good },
    counts.not_on_file > 0 && { text: `${counts.not_on_file} not on file`, color: COLORS.textMuted },
    counts.check_eligibility > 0 && { text: `${counts.check_eligibility} to check`, color: COLORS.textMuted },
  ].filter(Boolean);

  // The questionnaire takes the whole screen while it's open, rather than sitting
  // over a list that can be taller than it.
  if (questionnaire) {
    return (
      <div style={{ position: "relative", minHeight: "100%" }}>
        <ScreeningQuestionnaire
          instrument={questionnaire}
          sex={userProfile?.profile?.sex}
          onComplete={completeQuestionnaire}
          onClose={() => { setQuestionnaire(null); scrollPhoneToTop(); }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={goBack} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> {backLabel}
      </button>
      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>Preventive care</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>
        {headline.map((part, i) => (
          <React.Fragment key={part.text}>
            {i > 0 && <span style={{ color: COLORS.textMuted }}> · </span>}
            <span style={{ color: part.color }}>{part.text}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
        "Not on file" means we have no record yet, not that you're behind. Tap "I've had this" for anything
        you've done and adjust the month if you remember it. Your health score updates automatically.
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <SectionLabel>{cat}</SectionLabel>
          <Card>
            {schedule.filter(i => i.category === cat).map((item, idx, itemsInCat) => {
              const value = completedItems[item.id];
              const done = isScreeningDone(value);
              const status = screeningStatus(item, value);
              const style = STATUS_STYLE[status];
              const lastDone = formatCompletedMonth(value);
              const check = QUESTIONNAIRE_FOR_ITEM[item.id];
              // Up to date is the only state that fades out; a recorded screening that
              // has come due again needs attention like any other.
              const settled = status === STATUS.CURRENT;
              const dueAgain = status === STATUS.OVERDUE || status === STATUS.DUE_SOON;
              return (
                <div key={item.id} style={{
                  padding: "11px 0",
                  borderBottom: idx < itemsInCat.length - 1 ? `1px solid ${COLORS.border}` : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, paddingRight: 10, opacity: settled ? 0.55 : 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, textDecoration: settled ? "line-through" : "none" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 3 }}>{item.frequency}</div>
                      {dueAgain && (
                        <div style={{ fontSize: 11, color: style.color, marginBottom: 3, fontWeight: 600 }}>
                          Last done {lastDone} · {status === STATUS.OVERDUE ? "past its interval" : "due again soon"}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: COLORS.textMuted, fontStyle: "italic", lineHeight: 1.4 }}>{item.note}</div>
                    </div>
                    <span style={{
                      flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                      color: style.color, background: style.background,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      {settled && <CheckCircle2 size={11} />}
                      {STATUS_LABELS[status]}
                    </span>
                  </div>

                  {(!done || dueAgain) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
                      {/* One tap: marked done this month, editable below once it is. */}
                      <button onClick={() => setCompletedAt(item.id, currentYearMonth())} style={pill(COLORS.accent)}>
                        <CheckCircle2 size={13} /> {done ? "I've had it since" : "I've had this"}
                      </button>
                      {check && (
                        <button onClick={() => openQuestionnaire(check)} style={pill(COLORS.accent, true)}>
                          <ClipboardList size={13} /> Take the 2-minute check
                        </button>
                      )}
                    </div>
                  )}

                  {done && (
                    <ScreeningMonthYear
                      value={value}
                      onChange={(next) => setCompletedAt(item.id, next)}
                      onDelete={() => toggleDone(item.id)}
                    />
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      ))}
      <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, padding: "10px 12px", background: COLORS.bgCardAlt, borderRadius: 10 }}>
        Based on USPSTF Grade A and B recommendations for your age, sex, and risk factors. Discuss any flagged items with your physician.
      </div>
    </div>
  );
}

export { PreventiveCareScreen };

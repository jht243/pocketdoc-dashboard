import React, { useState } from "react";
import { CheckCircle2, ChevronRight, X } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

// ---- HEALTH HISTORY SCREEN ----
// Post-onboarding questionnaire. Collected after the user has seen value, not before.
// Feeds the AI chat, the Discussion Page, and the preventive care schedule.
function HealthHistoryScreen({ setActive, onSave }) {
  const [conditions, setConditions] = useState([]);
  const [conditionInput, setConditionInput] = useState("");
  const [medications, setMedications] = useState([]);
  const [medInput, setMedInput] = useState("");
  const [pastEvents, setPastEvents] = useState("");
  const [familyHistory, setFamilyHistory] = useState([]);
  const [lifestyle, setLifestyle] = useState({ exercise: "", sleep: "", alcohol: "" });
  const [goals, setGoals] = useState([]);
  const [saved, setSaved] = useState(false);

  const commonConditions = ["Hypertension", "Type 2 diabetes", "Thyroid condition", "Autoimmune condition", "Cardiac condition", "High cholesterol", "Anxiety / depression", "Sleep apnea", "Asthma / COPD"];
  const familyConditions = ["Heart disease", "Type 2 diabetes", "Cancer", "Alzheimer's / dementia", "Autoimmune condition", "Stroke", "Mental health condition"];
  const goalOptions = ["Understand my bloodwork better", "Catch health issues early", "Optimize energy and performance", "Manage a chronic condition", "Prepare for doctor appointments", "Track medications and supplements"];
  const exerciseOptions = ["Rarely or never", "1-2 times per week", "3-4 times per week", "5+ times per week"];
  const sleepOptions = ["Poor — often tired", "Fair — sometimes rested", "Good — usually rested", "Excellent — consistently rested"];
  const alcoholOptions = ["Never", "Occasionally (1-2 per week)", "Moderate (3-7 per week)", "Regular (more than 7 per week)"];

  const toggleChip = (list, setList, val) => setList(l => l.includes(val) ? l.filter(x => x !== val) : [...l, val]);

  const addItem = (val, setList, setInput) => {
    if (!val.trim()) return;
    setList(l => [...l, val.trim()]);
    setInput("");
  };

  const handleSave = () => {
    const healthHistory = { conditions, medications, pastEvents, familyHistory, lifestyle, goals };
    onSave(healthHistory);
    setSaved(true);
    setTimeout(() => setActive("home"), 1200);
  };

  if (saved) {
    return (
      <div style={{ padding: "24px 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <CheckCircle2 size={48} color={COLORS.tealLight} style={{ marginBottom: 16 }} />
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 8 }}>Health history saved</div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: "center" }}>
          Your advocate now has more context to give you specific, relevant guidance.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Your health history</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
        This stays private and makes every recommendation more specific to you. Takes about 3 minutes. Nothing here is required.
      </div>

      {/* Current conditions */}
      <SectionLabel>Current conditions</SectionLabel>
      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {commonConditions.map(c => (
            <button key={c} onClick={() => toggleChip(conditions, setConditions, c)} style={{
              padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              background: conditions.includes(c) ? COLORS.teal : COLORS.bgCardAlt,
              color: conditions.includes(c) ? COLORS.onAccent : COLORS.textSecondary,
              border: `1px solid ${conditions.includes(c) ? COLORS.teal : COLORS.border}`,
              fontWeight: conditions.includes(c) ? 600 : 400
            }}>{c}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={conditionInput} onChange={e => setConditionInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem(conditionInput, setConditions, setConditionInput)}
            placeholder="Add another condition..."
            style={{ flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
          <button onClick={() => addItem(conditionInput, setConditions, setConditionInput)} style={{
            background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: "8px 12px", color: COLORS.tealLight, fontSize: 12, cursor: "pointer"
          }}>Add</button>
        </div>
        {conditions.filter(c => !commonConditions.includes(c)).map(c => (
          <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, padding: "4px 0" }}>
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{c}</span>
            <button onClick={() => setConditions(l => l.filter(x => x !== c))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={14} /></button>
          </div>
        ))}
      </Card>

      {/* Current medications */}
      <SectionLabel>Current medications</SectionLabel>
      <Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>
          Include prescriptions and supplements. You can manage these in more detail from your medication screen.
        </div>
        {medications.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{m}</span>
            <button onClick={() => setMedications(l => l.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={14} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: medications.length > 0 ? 10 : 0 }}>
          <input value={medInput} onChange={e => setMedInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem(medInput, setMedications, setMedInput)}
            placeholder="e.g. Lisinopril 10mg, Vitamin D3..."
            style={{ flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
          <button onClick={() => addItem(medInput, setMedications, setMedInput)} style={{
            background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: "8px 12px", color: COLORS.tealLight, fontSize: 12, cursor: "pointer"
          }}>Add</button>
        </div>
      </Card>

      {/* Past health events */}
      <SectionLabel>Past significant health events</SectionLabel>
      <Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>
          Surgeries, hospitalizations, major diagnoses that are now resolved. Helps your advocate understand your full picture.
        </div>
        <textarea value={pastEvents} onChange={e => setPastEvents(e.target.value)}
          placeholder="e.g. Appendectomy 2018, kidney stone 2022, COVID with long symptoms 2023..."
          rows={3} style={{
            width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: "10px", color: COLORS.textPrimary, fontSize: 12,
            outline: "none", resize: "none", lineHeight: 1.5
          }} />
      </Card>

      {/* Family history */}
      <SectionLabel>Family history</SectionLabel>
      <Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>
          First-degree relatives (parents, siblings, children). Adjusts your preventive care recommendations.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {familyConditions.map(c => (
            <button key={c} onClick={() => toggleChip(familyHistory, setFamilyHistory, c)} style={{
              padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              background: familyHistory.includes(c) ? `${COLORS.warning}30` : COLORS.bgCardAlt,
              color: familyHistory.includes(c) ? COLORS.warning : COLORS.textSecondary,
              border: `1px solid ${familyHistory.includes(c) ? COLORS.warning : COLORS.border}`,
              fontWeight: familyHistory.includes(c) ? 600 : 400
            }}>{c}</button>
          ))}
        </div>
      </Card>

      {/* Lifestyle */}
      <SectionLabel>Lifestyle (optional)</SectionLabel>
      <Card>
        {[
          { key: "exercise", label: "Exercise frequency", options: exerciseOptions },
          { key: "sleep", label: "Sleep quality", options: sleepOptions },
          { key: "alcohol", label: "Alcohol use", options: alcoholOptions },
        ].map(field => (
          <div key={field.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{field.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {field.options.map(opt => (
                <button key={opt} onClick={() => setLifestyle(l => ({ ...l, [field.key]: opt }))} style={{
                  padding: "9px 12px", borderRadius: 9, fontSize: 12, cursor: "pointer", textAlign: "left",
                  background: lifestyle[field.key] === opt ? `${COLORS.teal}20` : COLORS.bgCardAlt,
                  color: lifestyle[field.key] === opt ? COLORS.tealLight : COLORS.textSecondary,
                  border: `1px solid ${lifestyle[field.key] === opt ? COLORS.tealLight : COLORS.border}`,
                  fontWeight: lifestyle[field.key] === opt ? 600 : 400
                }}>{opt}</button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {/* Goals */}
      <SectionLabel>What do you most want your advocate to help with?</SectionLabel>
      <Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>Choose up to three.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {goalOptions.map(g => {
            const selected = goals.includes(g);
            const maxed = goals.length >= 3 && !selected;
            return (
              <button key={g} onClick={() => !maxed && toggleChip(goals, setGoals, g)} style={{
                padding: "10px 14px", borderRadius: 10, fontSize: 13, cursor: maxed ? "default" : "pointer",
                textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                background: selected ? `${COLORS.teal}20` : COLORS.bgCardAlt,
                border: `1px solid ${selected ? COLORS.tealLight : COLORS.border}`,
                opacity: maxed ? 0.4 : 1
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 9, flexShrink: 0,
                  background: selected ? COLORS.teal : "none",
                  border: `2px solid ${selected ? COLORS.teal : COLORS.textMuted}`,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {selected && <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.onAccent }} />}
                </div>
                <span style={{ color: selected ? COLORS.tealLight : COLORS.textSecondary, fontWeight: selected ? 600 : 400 }}>{g}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <button onClick={handleSave} style={{
        width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent,
        fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer",
        marginTop: 8, marginBottom: 10
      }}>
        Save my health history
      </button>
      <button onClick={() => setActive("home")} style={{
        width: "100%", background: "none", border: "none", color: COLORS.textMuted,
        fontSize: 12, padding: "8px", cursor: "pointer"
      }}>
        Skip for now
      </button>
    </div>
  );
}

export { HealthHistoryScreen };

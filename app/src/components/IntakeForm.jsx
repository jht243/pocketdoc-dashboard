import React, { useState } from "react";
import { X } from "lucide-react";
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";
import { COLORS } from "../theme/tokens";
import { INTAKE_SECTIONS } from "../lib/intakeContent";

// ---- INTAKE FORM ----
// Data-driven renderer for the health intake questionnaire (content lives in
// lib/intakeContent.js). One component renders both surfaces so their questions
// never drift apart; the `variant` prop selects the surrounding look:
//   "history"    — Card + serif SectionLabel (Health History screen)
//   "onboarding" — inline sections, no cards (onboarding step 3)
// Only sections/questions whose showIf(answers) passes are rendered.
function IntakeForm({ answers, onChange, variant = "history", sectionIds }) {
  const isOnboarding = variant === "onboarding";

  const setValue = (key, value) => onChange(key, value);

  const toggleMulti = (key, val, max) => {
    const list = answers[key] || [];
    if (list.includes(val)) {
      setValue(key, list.filter((x) => x !== val));
    } else {
      if (max && list.length >= max) return; // respect "choose up to N"
      setValue(key, [...list, val]);
    }
  };

  const visibleSections = INTAKE_SECTIONS.filter(
    (s) => (!sectionIds || sectionIds.includes(s.id)) && (!s.showIf || s.showIf(answers))
  );

  return (
    <div>
      {visibleSections.map((section) => {
        const questions = section.questions.filter((q) => !q.showIf || q.showIf(answers));
        if (!questions.length) return null;
        const body = questions.map((q) => (
          <Question
            key={q.id}
            q={q}
            answers={answers}
            isOnboarding={isOnboarding}
            setValue={setValue}
            toggleMulti={toggleMulti}
          />
        ));

        if (isOnboarding) {
          return (
            <div key={section.id} style={{ marginBottom: 26 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, marginTop: 8, marginBottom: section.intro ? 4 : 12 }}>
                {section.title}
              </div>
              {section.intro && (
                <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 14 }}>{section.intro}</div>
              )}
              {body}
            </div>
          );
        }

        return (
          <div key={section.id}>
            <SectionLabel>{section.title}</SectionLabel>
            {section.intro && (
              <div style={{ fontSize: 11.5, color: COLORS.textMuted, lineHeight: 1.55, marginTop: -6, marginBottom: 12 }}>{section.intro}</div>
            )}
            <Card>{body}</Card>
          </div>
        );
      })}
    </div>
  );
}

// A single question, rendered by type. Label + optional help, then the control.
function Question({ q, answers, isOnboarding, setValue, toggleMulti }) {
  if (q.type === "note") {
    const warn = q.tone === "warn";
    return (
      <div style={{
        display: "flex", gap: 8, alignItems: "flex-start",
        background: warn ? COLORS.warnDim : COLORS.accentDim,
        border: `1px solid ${(warn ? COLORS.warning : COLORS.accent)}22`,
        borderRadius: 10, padding: "10px 12px", marginBottom: 14,
        fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5,
      }}>
        <span>{q.text}</span>
      </div>
    );
  }

  const labelSize = isOnboarding ? 12 : 13;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: labelSize, fontWeight: 600, color: COLORS.textPrimary, marginBottom: q.help ? 4 : 8 }}>{q.label}</div>
      {q.help && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 8 }}>{q.help}</div>
      )}
      <Control q={q} answers={answers} setValue={setValue} toggleMulti={toggleMulti} />
    </div>
  );
}

function Control({ q, answers, setValue, toggleMulti }) {
  const value = answers[q.id];

  if (q.type === "single") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {q.options.map((opt) => {
          const selected = value === opt;
          return (
            <button key={opt} onClick={() => setValue(q.id, selected ? "" : opt)} style={optionStyle(selected)}>{opt}</button>
          );
        })}
      </div>
    );
  }

  if (q.type === "multi" || q.type === "chips") {
    const list = value || [];
    const maxed = (n) => q.max && list.length >= q.max && !n;
    return (
      <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {q.options.map((opt) => {
            const selected = list.includes(opt);
            const disabled = maxed(selected);
            return (
              <button
                key={opt}
                onClick={() => !disabled && toggleMulti(q.id, opt, q.max)}
                style={chipStyle(selected, disabled)}
              >{opt}</button>
            );
          })}
        </div>
        {q.type === "chips" && (
          <AddInput
            placeholder={q.addLabel || "Add another..."}
            onAdd={(val) => { if (!list.includes(val)) setValue(q.id, [...list, val]); }}
          />
        )}
        {/* Show free-typed values (chips) that aren't in the preset options. */}
        {q.type === "chips" && list.filter((c) => !q.options.includes(c)).map((c) => (
          <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{c}</span>
            <button onClick={() => setValue(q.id, list.filter((x) => x !== c))} style={iconBtn}><X size={13} /></button>
          </div>
        ))}
      </>
    );
  }

  if (q.type === "tokens") {
    const list = value || [];
    return (
      <>
        {list.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{m}</span>
            <button onClick={() => setValue(q.id, list.filter((_, j) => j !== i))} style={iconBtn}><X size={13} /></button>
          </div>
        ))}
        <AddInput
          placeholder={q.placeholder || "Add an item..."}
          onAdd={(val) => setValue(q.id, [...list, val])}
          style={{ marginTop: list.length ? 8 : 0 }}
        />
      </>
    );
  }

  if (q.type === "textarea") {
    return (
      <textarea
        value={value || ""}
        onChange={(e) => setValue(q.id, e.target.value)}
        placeholder={q.placeholder}
        rows={3}
        style={{ width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }}
      />
    );
  }

  // text
  return (
    <input
      value={value || ""}
      onChange={(e) => setValue(q.id, e.target.value)}
      placeholder={q.placeholder}
      style={{ width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }}
    />
  );
}

// Small text field with an Add button + Enter-to-add, for chips/tokens.
function AddInput({ placeholder, onAdd, style = {} }) {
  const [val, setVal] = useState("");
  const commit = () => { const v = val.trim(); if (!v) return; onAdd(v); setVal(""); };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, ...style }}>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        placeholder={placeholder}
        style={{ flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }}
      />
      <button onClick={commit} style={{ background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.tealLight, fontSize: 12, cursor: "pointer" }}>Add</button>
    </div>
  );
}

const chipStyle = (selected, disabled) => ({
  padding: "6px 11px", borderRadius: 18, fontSize: 12,
  cursor: disabled ? "default" : "pointer",
  background: selected ? COLORS.teal : COLORS.bgCardAlt,
  color: selected ? COLORS.onAccent : COLORS.textSecondary,
  border: `1px solid ${selected ? COLORS.teal : COLORS.border}`,
  fontWeight: selected ? 600 : 400,
  opacity: disabled ? 0.4 : 1,
  textAlign: "left",
});

const optionStyle = (selected) => ({
  padding: "9px 12px", borderRadius: 9, fontSize: 12, cursor: "pointer", textAlign: "left", width: "100%",
  background: selected ? `${COLORS.teal}20` : COLORS.bgCardAlt,
  color: selected ? COLORS.tealLight : COLORS.textSecondary,
  border: `1px solid ${selected ? COLORS.tealLight : COLORS.border}`,
  fontWeight: selected ? 600 : 400,
});

const iconBtn = { background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted };

export { IntakeForm };

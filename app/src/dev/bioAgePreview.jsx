// Dev-only harness for the biological-age card and Home's bio-age circle: the spec's
// worked example and the states a member can land in, each in a phone-width column,
// plus the measurements section and the preventive care card. See bio-age-preview.html.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BioAgeCard, BioAgeHero } from "../components/BioAgeCard";
import { PreventiveCareCard } from "../components/PreventiveCareCard";
import { IntakeForm } from "../components/IntakeForm";
import { BodyMetrics } from "../components/BodyMetrics";
import { COLORS } from "../theme/tokens";
import "../styles/global.css";

const row = (name, value, unit, drawnOn) => ({ name, value: String(value), unit, drawnOn });

/** The spec's worked example (53-year-old), as a LabCorp-style panel. */
function panel(drawnOn, v = {}, glucoseName = "Glucose, Fasting") {
  const x = { albumin: 4.4, creatinine: 0.95, glucose: 98, crp: 1.8, lymph: 28, mcv: 91, rdw: 13.6, alp: 78, wbc: 6.4, ...v };
  return [
    row("Albumin", x.albumin, "g/dL", drawnOn),
    row("Creatinine", x.creatinine, "mg/dL", drawnOn),
    row(glucoseName, x.glucose, "mg/dL", drawnOn),
    row("C-Reactive Protein, Cardiac", x.crp, "mg/L", drawnOn),
    row("Lymphs", x.lymph, "%", drawnOn),
    row("Lymphs (Absolute)", 1.8, "x10E3/uL", drawnOn),
    row("MCV", x.mcv, "fL", drawnOn),
    row("RDW", x.rdw, "%", drawnOn),
    row("Alkaline Phosphatase", x.alp, "IU/L", drawnOn),
    row("WBC", x.wbc, "x10E3/uL", drawnOn),
  ];
}
const CBC = ["Lymphs", "Lymphs (Absolute)", "MCV", "RDW", "WBC"];
const DOB = "1973-02-10";

const SCENARIOS = {
  "Worked example": { labs: panel("2026-06-01"), dob: DOB },
  "Two draws (trend)": { labs: [...panel("2026-06-01"), ...panel("2024-06-01", { glucose: 112, crp: 3.5 })], dob: DOB },
  "Not known fasting": { labs: panel("2026-06-01", {}, "Glucose"), dob: DOB },
  "Missing CBC": { labs: panel("2026-06-01").filter((r) => !CBC.includes(r.name)), dob: DOB },
  "hs-CRP above 10": { labs: panel("2026-06-01", { crp: 14 }), dob: DOB },
  "Unit mix-up": { labs: panel("2026-06-01", { albumin: 44 }), dob: DOB },
  "No date of birth": { labs: panel("2026-06-01"), dob: "" },
};

const SCHEDULE = [
  { id: "colon", name: "Colorectal cancer screening", frequencyMonths: 120 },
  { id: "mammo", name: "Mammogram", frequencyMonths: 24 },
  { id: "lipids", name: "Cholesterol panel", frequencyMonths: 60 },
  { id: "flu", name: "Flu shot", frequencyMonths: 12 },
];

function Preview() {
  const [name, setName] = useState("Worked example");
  const [body, setBody] = useState({});
  const s = SCENARIOS[name];
  return (
    <div style={{ minHeight: "100vh", background: "#E6EBF1", display: "flex", justifyContent: "center" }}>
      <div style={{ width: 390, maxWidth: "100%", background: COLORS.bgDeep, minHeight: "100vh", padding: "16px 14px 40px", boxSizing: "border-box", position: "relative" }}>
        <select value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 14, fontSize: 12 }}>
          {Object.keys(SCENARIOS).map((k) => <option key={k}>{k}</option>)}
        </select>
        <BioAgeHero key={`hero-${name}`} healthData={{ labs: s.labs }} userProfile={{ profile: { dob: s.dob } }} setActive={() => {}} onReduce={() => {}} />
        <PreventiveCareCard userProfile={{ schedule: SCHEDULE, completedItems: { mammo: "2024-09", flu: "2026-01" } }} setActive={() => {}} />
        <BioAgeCard key={name} healthData={{ labs: s.labs }} userProfile={{ profile: { dob: s.dob } }} setActive={() => {}} />
        <div style={{ background: COLORS.bgCard, borderRadius: 14, padding: 14, marginTop: 14 }}>
          <IntakeForm answers={body} onChange={(k, v) => setBody((b) => ({ ...b, [k]: v }))} variant="onboarding" sectionIds={["body"]} profile={{ sex: "female" }} />
          <BodyMetrics intake={body} sex="female" />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Preview />);

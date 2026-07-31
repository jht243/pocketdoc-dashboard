import React, { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Plus, Search, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

// ---- LABS SCREEN ----
// ---- MEDICATION SCREEN ----
// Central medication list with real-time interaction checking, pharmacogenomic
// alerts, and a cross-physician reconciliation report for Discussion Page use.
function MedicationScreen({ setActive }) {
  const [medications, setMedications] = useState([
    { id: 1, name: "Testosterone Cypionate", dose: "150mg", frequency: "Weekly injection", prescriber: "Dr. Martinez (Endocrinology)", refillDate: "Jul 20, 2026", type: "rx" },
    { id: 2, name: "Anastrozole", dose: "0.25mg", frequency: "Twice weekly", prescriber: "Dr. Martinez (Endocrinology)", refillDate: "Jul 20, 2026", type: "rx" },
    { id: 3, name: "Vitamin D3 + K2", dose: "5,000 IU / 100mcg", frequency: "Daily with food", prescriber: "Self-ordered", refillDate: null, type: "supplement" },
    { id: 4, name: "Magnesium Glycinate", dose: "400mg", frequency: "Nightly", prescriber: "Self-ordered", refillDate: null, type: "supplement" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", dose: "", frequency: "", prescriber: "", type: "rx" });
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Severity color mapping
  const severityColor = {
    "Contraindicated": COLORS.danger,
    "Monitor": COLORS.warning,
    "Dose adjustment": COLORS.warning,
    "Theoretical": COLORS.textMuted,
    "No issues found": COLORS.tealLight,
  };

  // Simulated interaction check using known patterns from the user's genetic profile.
  // In production this calls the DrugBank API and overlays the pharmacogenomic markers.
  const runInteractionCheck = async (newMedName) => {
    setChecking(true);
    await new Promise(r => setTimeout(r, 1200));
    const knownInteractions = {
      "clarithromycin": [{ severity: "Monitor", drugs: "Clarithromycin + Testosterone", note: "CYP3A4 inhibitor may increase testosterone plasma levels. Monitor for signs of androgen excess.", route: "pharmacist" }],
      "ibuprofen": [{ severity: "Monitor", drugs: "Ibuprofen + Anastrozole", note: "NSAIDs may slightly reduce anastrozole effectiveness. Occasional use is generally acceptable; chronic use warrants discussion.", route: "prescriber" }],
      "st. john's wort": [{ severity: "Contraindicated", drugs: "St. John's Wort + Anastrozole", note: "Strong CYP3A4 inducer. May significantly reduce anastrozole plasma levels and effectiveness. Do not combine.", route: "prescriber" }],
      "simvastatin": [{ severity: "Monitor", drugs: "Simvastatin + SLCO1B1 variant", note: "Your SLCO1B1 variant significantly elevates myopathy risk with simvastatin. Rosuvastatin or pravastatin are safer alternatives. Discuss with prescriber before filling.", route: "prescriber" }],
    };
    const name = newMedName.toLowerCase();
    const found = Object.entries(knownInteractions).find(([key]) => name.includes(key));
    setCheckResult(found ? { interactions: found[1], checked: newMedName } : { interactions: [], checked: newMedName });
    setChecking(false);
  };

  const addMedication = () => {
    if (!newMed.name.trim()) return;
    setMedications(prev => [...prev, { ...newMed, id: Date.now(), refillDate: null }]);
    setShowAdd(false);
    setNewMed({ name: "", dose: "", frequency: "", prescriber: "", type: "rx" });
    setCheckResult(null);
  };

  const rxMeds = medications.filter(m => m.type === "rx");
  const supplements = medications.filter(m => m.type === "supplement");

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Medications</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
            Every medication and supplement in one place, checked against each other.
          </div>
        </div>
        <button onClick={() => setShowReport(!showReport)} style={{
          background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: "8px 12px", fontSize: 11, fontWeight: 600,
          color: COLORS.textSecondary, cursor: "pointer"
        }}>
          Reconciliation report
        </button>
      </div>

      {/* Cross-physician reconciliation report */}
      {showReport && (
        <Card style={{ border: `1px solid ${COLORS.gold}50`, background: COLORS.warnDim, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <Sparkles size={16} color={COLORS.gold} />
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.gold }}>Cross-physician reconciliation report</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
            Share this with any new prescribing physician before they write a new prescription.
            It gives them a complete picture of what every other physician has prescribed.
          </div>
          <div style={{ background: COLORS.bgDeep, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 8 }}>COMPLETE MEDICATION LIST — Adam Locker — July 6, 2026</div>
            {medications.map((m, i) => (
              <div key={m.id} style={{
                display: "flex", justifyContent: "space-between", padding: "6px 0",
                borderBottom: i < medications.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}> — {m.dose}, {m.frequency}</span>
                </div>
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>{m.prescriber}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 10, fontStyle: "italic" }}>
              Pharmacogenomic flags on file: CYP2D6 intermediate metabolizer, CYP1A2 slow metabolizer, SLCO1B1 variant (statin myopathy risk elevated). Please review before prescribing affected drug classes.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setActive("discussion")} style={{
              flex: 1, background: COLORS.teal, border: "none", color: COLORS.onAccent,
              fontSize: 12, fontWeight: 700, padding: "9px", borderRadius: 8, cursor: "pointer"
            }}>Add to Discussion Page</button>
            <button style={{
              flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
              color: COLORS.textSecondary, fontSize: 12, padding: "9px", borderRadius: 8, cursor: "pointer"
            }}>Export PDF</button>
          </div>
        </Card>
      )}

      <SectionLabel>Prescriptions</SectionLabel>
      <Card>
        {rxMeds.map((m, i) => (
          <div key={m.id} style={{
            padding: "10px 0", borderBottom: i < rxMeds.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.dose} · {m.frequency}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.prescriber}</div>
              </div>
              {m.refillDate && (
                <span style={{ fontSize: 11, color: COLORS.warning }}>Refill {m.refillDate}</span>
              )}
            </div>
          </div>
        ))}
      </Card>

      <SectionLabel>Supplements</SectionLabel>
      <Card>
        {supplements.map((m, i) => (
          <div key={m.id} style={{
            padding: "10px 0", borderBottom: i < supplements.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.dose} · {m.frequency} · {m.prescriber}</div>
          </div>
        ))}
      </Card>

      {/* Add medication flow with inline interaction check */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} style={{
          width: "100%", background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.tealLight}60`,
          borderRadius: 14, padding: "14px", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8, color: COLORS.tealLight, fontSize: 13,
          fontWeight: 600, cursor: "pointer", marginTop: 4
        }}>
          <Plus size={16} /> Add medication or supplement
        </button>
      ) : (
        <Card style={{ border: `1px solid ${COLORS.tealLight}40` }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Add new</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {["rx", "supplement"].map(t => (
              <button key={t} onClick={() => setNewMed(p => ({ ...p, type: t }))} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: newMed.type === t ? COLORS.teal : COLORS.bgCardAlt,
                color: newMed.type === t ? COLORS.onAccent : COLORS.textSecondary, border: "none"
              }}>{t === "rx" ? "Prescription" : "Supplement"}</button>
            ))}
          </div>
          {[
            { key: "name", label: "Medication name", placeholder: "e.g. Atorvastatin" },
            { key: "dose", label: "Dose", placeholder: "e.g. 20mg" },
            { key: "frequency", label: "Frequency", placeholder: "e.g. Once daily at bedtime" },
            { key: "prescriber", label: newMed.type === "rx" ? "Prescribing physician" : "Source", placeholder: newMed.type === "rx" ? "e.g. Dr. Smith (Cardiology)" : "e.g. Self-ordered" },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{field.label}</div>
              <input value={newMed[field.key]} onChange={e => setNewMed(p => ({ ...p, [field.key]: e.target.value }))}
                placeholder={field.placeholder} style={{
                  width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
                  borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none"
                }} />
            </div>
          ))}

          {/* Interaction check result */}
          {checking && (
            <div style={{ padding: "10px 0", fontSize: 12, color: COLORS.textSecondary, display: "flex", gap: 8, alignItems: "center" }}>
              <Search size={13} /> Checking against your full medication list and genetic profile...
            </div>
          )}
          {checkResult && !checking && (
            <div style={{ marginBottom: 12 }}>
              {checkResult.interactions.length === 0 ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: COLORS.bgCard, borderRadius: 10 }}>
                  <CheckCircle2 size={14} color={COLORS.tealLight} />
                  <span style={{ fontSize: 12, color: COLORS.tealLight }}>No known interactions found with your current medications or your genetic profile.</span>
                </div>
              ) : (
                checkResult.interactions.map((intx, i) => (
                  <div key={i} style={{
                    padding: "10px 12px", background: intx.severity === "Contraindicated" ? COLORS.badDim : COLORS.warnDim,
                    border: `1px solid ${severityColor[intx.severity]}40`, borderRadius: 10, marginBottom: 8
                  }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <AlertCircle size={14} color={severityColor[intx.severity]} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: severityColor[intx.severity] }}>{intx.severity}</span>
                      <span style={{ fontSize: 11, color: COLORS.textMuted }}>— {intx.drugs}</span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>{intx.note}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" }}>
                      Recommended: discuss with your {intx.route === "pharmacist" ? "pharmacist" : "prescribing physician"} before taking.
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => { runInteractionCheck(newMed.name); }} disabled={!newMed.name.trim()} style={{
              flex: 1, background: !newMed.name.trim() ? COLORS.bgCardAlt : COLORS.bgCardAlt,
              border: `1px solid ${COLORS.border}`, color: COLORS.tealLight,
              fontSize: 12, fontWeight: 600, padding: "9px", borderRadius: 8, cursor: newMed.name.trim() ? "pointer" : "default"
            }}>Check interactions</button>
            <button onClick={addMedication} disabled={!newMed.name.trim()} style={{
              flex: 1, background: !newMed.name.trim() ? COLORS.bgCardAlt : COLORS.teal,
              border: "none", color: !newMed.name.trim() ? COLORS.textMuted : COLORS.onAccent,
              fontSize: 12, fontWeight: 700, padding: "9px", borderRadius: 8, cursor: newMed.name.trim() ? "pointer" : "default"
            }}>Save</button>
          </div>
          <button onClick={() => { setShowAdd(false); setCheckResult(null); }} style={{
            width: "100%", background: "none", border: "none", color: COLORS.textMuted,
            fontSize: 12, padding: "8px", cursor: "pointer", marginTop: 4
          }}>Cancel</button>

          <div style={{ fontSize: 10, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 10 }}>
            Interaction check uses your full medication list and genetic pharmacogenomic markers.
            Results reflect only what has been entered. Always verify with your pharmacist or physician.
          </div>
        </Card>
      )}
    </div>
  );
}

export { MedicationScreen };

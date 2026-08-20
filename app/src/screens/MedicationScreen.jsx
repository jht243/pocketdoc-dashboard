import React, { useState, useEffect } from "react";
import { ChevronRight, ExternalLink, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";
import { useAuth } from "../lib/AuthContext";
import { loadMedications, saveMedications } from "../lib/profileStore";
import { suggestSupplements } from "../lib/aiInsights";
import { searchProducts } from "../lib/amazon";

// ---- MEDICATION SCREEN ----
// The user's real medication + supplement list (entered by them, persisted to
// ghai.medications). Nothing here is pre-filled or invented. Plus an AI "Suggested
// for you" section that pulls live Amazon supplement cards from their profile.
function MedicationScreen({ setActive, userProfile, goToMarket }) {
  const { user } = useAuth();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null); // id of the med being edited, or null for a new one
  const [newMed, setNewMed] = useState({ name: "", dose: "", frequency: "", prescriber: "", type: "rx" });
  const [showReport, setShowReport] = useState(false);
  const [suggestions, setSuggestions] = useState(null); // null = loading; [] = none

  // Map a DB row to the display shape; anything not a supplement lists as a prescription.
  const fromRow = (r) => ({
    id: r.id, name: r.name, dose: r.dose || "", frequency: r.frequency || "",
    prescriber: r.prescriber || "", type: r.type === "supplement" ? "supplement" : "rx",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setLoading(false); return; }
      const rows = await loadMedications(user.id);
      if (!cancelled) { setMedications((rows || []).map(fromRow)); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // AI-suggested supplements → live Amazon product cards.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userProfile) { setSuggestions([]); return; }
      const ideas = await suggestSupplements(userProfile);
      if (cancelled) return;
      if (!ideas.length) { setSuggestions([]); return; }
      const withProducts = await Promise.all(ideas.map(async (idea) => {
        const { items } = await searchProducts(idea.keywords, { itemCount: 1 });
        return { ...idea, product: items && items[0] ? items[0] : null };
      }));
      if (!cancelled) setSuggestions(withProducts);
    })();
    return () => { cancelled = true; };
  }, [userProfile]);

  // Persist the full list (delete + re-insert keeps meds table in sync with the UI).
  const persist = (list) => {
    setMedications(list);
    if (user) saveMedications(user.id, list.map((m) => ({
      name: m.name, dose: m.dose, frequency: m.frequency, prescriber: m.prescriber,
      type: m.type === "supplement" ? "supplement" : "prescription",
    })));
  };

  const resetForm = () => {
    setShowAdd(false);
    setEditId(null);
    setNewMed({ name: "", dose: "", frequency: "", prescriber: "", type: "rx" });
  };

  const saveMedication = () => {
    if (!newMed.name.trim()) return;
    if (editId != null) {
      persist(medications.map((m) => (m.id === editId ? { ...m, ...newMed } : m)));
    } else {
      persist([...medications, { ...newMed, id: Date.now() }]);
    }
    resetForm();
  };

  const startEdit = (m) => {
    setEditId(m.id);
    setNewMed({ name: m.name, dose: m.dose, frequency: m.frequency, prescriber: m.prescriber, type: m.type });
    setShowAdd(true);
  };

  const deleteMedication = (id) => persist(medications.filter((m) => m.id !== id));

  const rxMeds = medications.filter((m) => m.type === "rx");
  const supplements = medications.filter((m) => m.type === "supplement");
  const displayName = userProfile?.profile?.name || "Your medications";

  const MedRow = (m, i, arr) => (
    <div key={m.id} style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
      padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
    }}>
      <button onClick={() => startEdit(m)} aria-label={`Edit ${m.name}`} style={{
        minWidth: 0, flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{m.name}</div>
        <div style={{ fontSize: 11, color: [m.dose, m.frequency].some(Boolean) ? COLORS.textMuted : COLORS.tealLight }}>
          {[m.dose, m.frequency].filter(Boolean).join(" · ") || "Add dose & frequency"}
        </div>
        {m.prescriber && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.prescriber}</div>}
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <button onClick={() => startEdit(m)} aria-label={`Edit ${m.name}`} style={{
          background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted, padding: 4
        }}><Pencil size={14} /></button>
        <button onClick={() => deleteMedication(m.id)} aria-label={`Delete ${m.name}`} style={{
          background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted, padding: 4
        }}><Trash2 size={15} /></button>
      </div>
    </div>
  );

  const emptyState = (text) => (
    <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: "center", padding: "14px 0" }}>{text}</div>
  );

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
            Every medication and supplement you take, in one place.
          </div>
        </div>
        {medications.length > 0 && (
          <button onClick={() => setShowReport(!showReport)} style={{
            background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: "8px 12px", fontSize: 11, fontWeight: 600,
            color: COLORS.textSecondary, cursor: "pointer", flexShrink: 0
          }}>Reconciliation report</button>
        )}
      </div>

      {/* Reconciliation report — built entirely from the user's own entered list. */}
      {showReport && medications.length > 0 && (
        <Card style={{ border: `1px solid ${COLORS.gold}50`, background: COLORS.warnDim, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <Sparkles size={16} color={COLORS.gold} />
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.gold }}>Medication reconciliation</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
            Share this complete list with any new prescriber so they can see everything you're
            already taking before writing a new prescription.
          </div>
          <div style={{ background: COLORS.bgDeep, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 8 }}>
              COMPLETE MEDICATION LIST — {displayName}
            </div>
            {medications.map((m, i) => (
              <div key={m.id} style={{
                display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0",
                borderBottom: i < medications.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                    {[m.dose, m.frequency].filter(Boolean).length ? ` — ${[m.dose, m.frequency].filter(Boolean).join(", ")}` : ""}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: COLORS.textMuted, flexShrink: 0 }}>{m.prescriber || "—"}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setActive("discussion")} style={{
            width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent,
            fontSize: 12, fontWeight: 700, padding: "9px", borderRadius: 8, cursor: "pointer"
          }}>Add to Discussion Page</button>
        </Card>
      )}

      <SectionLabel>Prescriptions</SectionLabel>
      <Card>
        {loading ? emptyState("Loading…") : rxMeds.length ? rxMeds.map((m, i) => MedRow(m, i, rxMeds)) : emptyState("No prescriptions added yet.")}
      </Card>

      <SectionLabel>Supplements</SectionLabel>
      <Card>
        {loading ? emptyState("Loading…") : supplements.length ? supplements.map((m, i) => MedRow(m, i, supplements)) : emptyState("No supplements added yet.")}
      </Card>

      {/* Add flow — all fields user-entered. */}
      {!showAdd ? (
        <button onClick={() => { setEditId(null); setShowAdd(true); }} style={{
          width: "100%", background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.tealLight}60`,
          borderRadius: 14, padding: "14px", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8, color: COLORS.tealLight, fontSize: 13,
          fontWeight: 600, cursor: "pointer", marginTop: 4
        }}>
          <Plus size={16} /> Add medication or supplement
        </button>
      ) : (
        <Card style={{ border: `1px solid ${COLORS.tealLight}40` }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{editId != null ? "Edit" : "Add new"}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {["rx", "supplement"].map((t) => (
              <button key={t} onClick={() => setNewMed((p) => ({ ...p, type: t }))} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: newMed.type === t ? COLORS.teal : COLORS.bgCardAlt,
                color: newMed.type === t ? COLORS.onAccent : COLORS.textSecondary, border: "none"
              }}>{t === "rx" ? "Prescription" : "Supplement"}</button>
            ))}
          </div>
          {[
            { key: "name", label: "Name", placeholder: newMed.type === "rx" ? "e.g. Atorvastatin" : "e.g. Vitamin D3" },
            { key: "dose", label: "Dose", placeholder: "e.g. 20mg" },
            { key: "frequency", label: "Frequency", placeholder: "e.g. Once daily at bedtime" },
            { key: "prescriber", label: newMed.type === "rx" ? "Prescribing physician" : "Source", placeholder: newMed.type === "rx" ? "e.g. your cardiologist's name" : "e.g. Self-ordered" },
          ].map((field) => (
            <div key={field.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{field.label}</div>
              <input value={newMed[field.key]} onChange={(e) => setNewMed((p) => ({ ...p, [field.key]: e.target.value }))}
                placeholder={field.placeholder} style={{
                  width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
                  borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box"
                }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={resetForm} style={{
              flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary,
              fontSize: 12, fontWeight: 600, padding: "9px", borderRadius: 8, cursor: "pointer"
            }}>Cancel</button>
            <button onClick={saveMedication} disabled={!newMed.name.trim()} style={{
              flex: 1, background: !newMed.name.trim() ? COLORS.bgCardAlt : COLORS.teal,
              border: "none", color: !newMed.name.trim() ? COLORS.textMuted : COLORS.onAccent,
              fontSize: 12, fontWeight: 700, padding: "9px", borderRadius: 8, cursor: newMed.name.trim() ? "pointer" : "default"
            }}>Save</button>
          </div>
        </Card>
      )}

      {/* AI-suggested supplements → live Amazon cards. */}
      {suggestions && suggestions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <SectionLabel>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={16} color={COLORS.gold} /> Suggested for you
            </span>
          </SectionLabel>
          <Card>
            {suggestions.map((s, i) => (
              <div key={i} style={{
                padding: "11px 0", borderBottom: i < suggestions.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 8, flexShrink: 0, overflow: "hidden", background: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${COLORS.border}`
                  }}>
                    {s.product?.image
                      ? <img src={s.product.image} alt={s.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                      : <Plus size={16} color={COLORS.textMuted} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1,
                      overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {s.product?.title ? [s.product.brand, s.product.price].filter(Boolean).join(" · ") || s.product.title : s.reason}
                    </div>
                  </div>
                  <a href={s.product?.url || `https://www.amazon.com/s?k=${encodeURIComponent(s.keywords)}`}
                    target="_blank" rel="noopener noreferrer sponsored" style={{
                      background: COLORS.teal, color: COLORS.onAccent, textDecoration: "none",
                      fontSize: 11, fontWeight: 700, padding: "7px 10px", borderRadius: 7,
                      display: "flex", alignItems: "center", gap: 4, flexShrink: 0
                    }}>View <ExternalLink size={11} /></a>
                </div>
                {s.reason && s.product?.title && (
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 6, lineHeight: 1.4 }}>{s.reason}</div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 10, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 12 }}>
              Suggestions are based on your profile and are not medical advice. Supplements can interact
              with medications — check with your pharmacist or physician first. As an Amazon Associate,
              purchases through these links may earn the app a commission.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export { MedicationScreen };

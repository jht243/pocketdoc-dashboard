import React, { useState } from "react";
import { ChevronRight, Dna, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { LockedDataSection } from "../components/LockedDataSection";
import { OrderComingSoon } from "../components/OrderComingSoon";
import { COLORS, DISPLAY } from "../theme/tokens";
import { queueChatQuestion } from "../lib/chatHandoff";

// The two genetic panels a member can't yet order in the app, each with a placeholder
// Order button. Shown only while no genetic data is on file.
const GENETIC_TESTS = [
  { id: "pgx", name: "Pharmacogenomics (PGx)", orderName: "pharmacogenomic (PGx)", note: "How you process medications and supplements." },
  { id: "cgx", name: "Clinical genomics (CGx)", orderName: "clinical genomics (CGx)", note: "Inherited disease and cancer risk." },
];

function OrderGeneticTests() {
  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Don't have a genetic test yet?</div>
      <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 6 }}>
        Each is a one-time test. Your genes don't change, so one result serves for life.
      </div>
      {GENETIC_TESTS.map((t, i) => (
        <div key={t.id} style={{ padding: "10px 0", borderTop: i ? `1px solid ${COLORS.border}` : "none" }}>
          <div style={{ fontSize: 13 }}>{t.name}</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>{t.note}</div>
          <OrderComingSoon testName={t.orderName} style={{ marginTop: 8 }} />
        </div>
      ))}
    </Card>
  );
}

// ---- HOME SCREEN ----
// ---- PROFILE SCREEN ----
// ---- GENETIC PROFILE SCREEN ----
// Shows known genetic markers split into two distinct sections:
// 1. Supplement & lifestyle markers (lower stakes, actionable at user level)
// 2. Pharmacogenomic markers (medication metabolism, higher stakes, physician-discussion framing)
// Each marker shows what it means for this specific user, not a generic description.
function GeneticProfileScreen({ setActive, goBack, backLabel, healthData }) {
  // The question goes to the chat, where the Genetics specialist and whoever else it
  // touches answer it from the whole record.
  const askTeam = (m) => {
    const name = [m.gene, m.variant, m.genotype ? `(${m.genotype})` : null].filter(Boolean).join(" ") || m.title || "this result";
    queueChatQuestion(`What does my ${name} result mean for me?`);
    setActive("aichat");
  };
  const [activeSection, setActiveSection] = useState("lifestyle"); // lifestyle | pharma

  // Only the member's own imported genome is ever shown: rich objects from
  // ghai.genetic_markers, split by the category the extraction assigned.
  const importedMarkers = (healthData?.genetics || []).filter((g) => g && typeof g === "object" && g.gene);
  const hasGenetics = importedMarkers.length > 0;
  const lifestyleMarkers = importedMarkers.filter((m) => m.category !== "pharma");
  const pharmaMarkers = importedMarkers.filter((m) => m.category === "pharma");

  const statusColors = {
    normal: COLORS.tealLight,
    favorable: COLORS.tealLight,
    variant: COLORS.warning,
    watch: COLORS.danger,
    unknown: COLORS.textMuted,
  };

  const impactBg = {
    "Informative": COLORS.bgCardAlt,
    "Moderate": COLORS.warnDim,
    "Clinical": COLORS.badDim,
    "Watch": COLORS.badDim,
  };

  const LifestyleMarkerCard = ({ m }) => {
    const [open, setOpen] = useState(false);
    return (
      <Card style={{ border: `1px solid ${statusColors[m.status]}30`, background: impactBg[m.impact] }}>
        <button onClick={() => setOpen(!open)} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{m.gene}</span>
                {m.variant && <span style={{
                  fontSize: 10, color: statusColors[m.status], background: `${statusColors[m.status]}20`,
                  padding: "2px 7px", borderRadius: 5, fontWeight: 600
                }}>{m.variant}</span>}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{m.title}</div>
            </div>
            <ChevronRight size={16} color={COLORS.textMuted} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginTop: 2 }} />
          </div>
        </button>
        {open && (
          <div style={{ marginTop: 12 }}>
            {/* Only the report's own words are shown: the extractor's summary of what a
                gene does was never checked against the report. */}
            {m.notes && (
              <div style={{ marginBottom: 12, padding: "10px 12px", background: COLORS.bgCard, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.accent, marginBottom: 6, letterSpacing: 0.5 }}>
                  FROM YOUR REPORT
                </div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6 }}>{m.notes}</div>
              </div>
            )}
            {/* What a variant means for this member is the care team's to say (the
                Genetics specialist reads it against their labs and medications), not
                a line written when the report was imported with no rules applied. */}
            <button onClick={() => askTeam(m)} style={{
              marginTop: 4, width: "100%", padding: "10px 12px", background: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`, borderRadius: 8, cursor: "pointer",
              display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, fontWeight: 600, color: COLORS.accent }}>
                <Sparkles size={13} color={COLORS.tealLight} /> Ask your care team what this means for you
              </span>
              <ChevronRight size={14} color={COLORS.textMuted} />
            </button>
          </div>
        )}
      </Card>
    );
  };

  const PharmaMarkerCard = ({ m }) => {
    const [open, setOpen] = useState(false);
    return (
      <Card style={{ border: `1px solid ${statusColors[m.status]}30`, background: impactBg[m.impact] }}>
        <button onClick={() => setOpen(!open)} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{m.gene}</span>
                {m.variant && <span style={{
                  fontSize: 10, color: statusColors[m.status], background: `${statusColors[m.status]}20`,
                  padding: "2px 7px", borderRadius: 5, fontWeight: 600
                }}>{m.variant}</span>}
                <span style={{
                  fontSize: 10, color: m.impact === "Clinical" ? COLORS.danger : COLORS.textMuted,
                  background: COLORS.bgCardAlt, padding: "2px 7px", borderRadius: 5
                }}>{m.impact}</span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{m.title}</div>
            </div>
            <ChevronRight size={16} color={COLORS.textMuted} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginTop: 2 }} />
          </div>
        </button>
        {open && (
          <div style={{ marginTop: 12 }}>
            {/* Only the report's own words are shown: the extractor's summary of what a
                gene does was never checked against the report. */}
            {m.notes && (
              <div style={{ marginBottom: 12, padding: "10px 12px", background: COLORS.bgCard, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.accent, marginBottom: 6, letterSpacing: 0.5 }}>
                  FROM YOUR REPORT
                </div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6 }}>{m.notes}</div>
              </div>
            )}
            {(m.medications || []).length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.warning, marginBottom: 8, letterSpacing: 0.5 }}>
                AFFECTED MEDICATIONS
              </div>
            )}
            {(m.medications || []).map((med, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", padding: "7px 0",
                borderBottom: i < m.medications.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <span style={{ fontSize: 12, flex: 1 }}>{med.name}</span>
                <span style={{ fontSize: 11, color: COLORS.textMuted, maxWidth: 160, textAlign: "right" }}>{med.note}</span>
              </div>
            ))}
            <div style={{
              marginTop: 12, padding: "10px 12px",
              background: m.status === "normal" ? COLORS.bgCard : COLORS.badDim,
              border: `1px solid ${m.status === "normal" ? COLORS.border : COLORS.danger + "40"}`,
              borderRadius: 10
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: m.status === "normal" ? COLORS.tealLight : COLORS.warning, marginBottom: 4 }}>
                DISCUSS WITH YOUR PRESCRIBER
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                {m.discuss || "Share this pharmacogenomic result with your prescriber before starting or changing any affected medication."}
              </div>
            </div>
            <div style={{
              marginTop: 10, padding: "8px 10px", background: COLORS.bgCard,
              borderRadius: 8, display: "flex", gap: 6, alignItems: "flex-start"
            }}>
              <Sparkles size={12} color={COLORS.tealLight} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                Your AI advocate flags this when you ask about medications. It never tells you what to take — it ensures you ask the right questions of the right person.
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={goBack} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> {backLabel}
      </button>

      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>Genetic profile</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>
        {hasGenetics
          ? "Based on your imported genetic data."
          : "Import a genetic source to see your markers."}
      </div>

      {!hasGenetics && (
        <div style={{ marginTop: 16 }}>
          <LockedDataSection
            title="No genetic data connected"
            description="Connect 23andMe or import a clinical genetic panel to see your supplement, lifestyle, and pharmacogenomic markers here. Nothing is shown until your own data is imported."
            actionLabel="Import genetic data"
            onAction={() => setActive("importlabs")}
            rows={3}
          />
          <OrderGeneticTests />
        </div>
      )}

      {hasGenetics && (<>
      <div style={{
        fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 22,
        padding: "10px 12px", background: COLORS.bgCardAlt, borderRadius: 10
      }}>
        These markers inform your AI advocate's recommendations. They are not diagnoses.
        Pharmacogenomic findings should always be discussed with a licensed prescriber before
        any medication change.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setActiveSection("lifestyle")} style={{
          flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: activeSection === "lifestyle" ? COLORS.teal : COLORS.bgCardAlt,
          color: activeSection === "lifestyle" ? COLORS.onAccent : COLORS.textSecondary, border: "none"
        }}>Supplements & lifestyle</button>
        <button onClick={() => setActiveSection("pharma")} style={{
          flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: activeSection === "pharma" ? COLORS.teal : COLORS.bgCardAlt,
          color: activeSection === "pharma" ? COLORS.onAccent : COLORS.textSecondary, border: "none"
        }}>Pharmacogenomics</button>
      </div>

      {activeSection === "lifestyle" && (
        <>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
            Tap any marker to see what it means for your supplement and lifestyle decisions specifically.
          </div>
          {lifestyleMarkers.map((m, i) => <LifestyleMarkerCard key={m.id || `${m.gene}-${i}`} m={m} />)}
          <button onClick={() => setActive("importlabs")} style={{
            width: "100%", background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.accent}50`,
            borderRadius: 14, padding: "14px", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, color: COLORS.accent, fontSize: 13,
            fontWeight: 600, cursor: "pointer", marginTop: 6
          }}>
            <Dna size={16} /> Import additional genetic data
          </button>
        </>
      )}

      {activeSection === "pharma" && (
        <>
          <div style={{
            padding: "10px 12px", background: COLORS.badDim, border: `1px solid ${COLORS.danger}30`,
            borderRadius: 10, fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 14
          }}>
            Pharmacogenomic findings show how your genes affect drug metabolism. This information
            is for discussion with your prescriber only. Never adjust or stop a medication based
            on this screen alone.
          </div>
          {pharmaMarkers.map((m, i) => <PharmaMarkerCard key={m.id || `${m.gene}-${i}`} m={m} />)}
          {/* Genetics on file but none of it pharmacogenomic (a 23andMe export, say):
              say so plainly rather than leave an empty tab. */}
          {pharmaMarkers.length === 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>No pharmacogenomic results yet</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
                The genetic data you imported doesn't include a pharmacogenomic (PGx) report. A PGx
                test shows how you process common medications and supplements.
              </div>
              <OrderComingSoon testName="pharmacogenomic (PGx)" label="Order a PGx test" />
            </Card>
          )}
        </>
      )}
      </>)}
    </div>
  );
}

export { GeneticProfileScreen };

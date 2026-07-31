import React from "react";
import { Calendar, ChevronRight, Dna, FlaskConical, Home } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

function ProfileScreen({ setActive, nutritionEnabled, setNutritionEnabled }) {
  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Home
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Your profile</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Adam Locker &middot; On TRT &middot; Member since Jun 2026
      </div>

      <SectionLabel>Genetic profile</SectionLabel>
      <button onClick={() => setActive("geneticprofile")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.gold}50`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 10
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Dna size={18} color={COLORS.gold} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>View genetic markers</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>6 lifestyle markers · 5 pharmacogenomic markers</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <SectionLabel>Medications</SectionLabel>
      <button onClick={() => setActive("medications")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.tealLight}40`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 18
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <FlaskConical size={18} color={COLORS.tealLight} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Medications & interactions</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>2 prescriptions · 2 supplements · no flags</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <SectionLabel>Preventive care</SectionLabel>
      <button onClick={() => setActive("preventivecare")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.tealLight}40`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 18
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Calendar size={18} color={COLORS.tealLight} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Screening schedule</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Your age-based preventive care checklist</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <SectionLabel>Score settings</SectionLabel>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Track nutrition</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
              When on, nutrition becomes part of your daily score and the other categories
              adjust their weight to make room for it. When off, your daily score is built
              from sleep, training effort, and your wake-up check-in only.
            </div>
          </div>
          <button onClick={() => setNutritionEnabled(!nutritionEnabled)} style={{
            width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
            background: nutritionEnabled ? COLORS.teal : COLORS.bgCardAlt,
            position: "relative", flexShrink: 0, transition: "background 0.2s"
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 10, background: nutritionEnabled ? COLORS.onAccent : COLORS.textMuted,
              position: "absolute", top: 3, left: nutritionEnabled ? 23 : 3, transition: "left 0.2s"
            }} />
          </button>
        </div>
      </Card>

      <SectionLabel>Current therapies</SectionLabel>
      <Card>
        <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
          Testosterone Replacement Therapy (TRT), monitored monthly
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
          Used to recommend monthly panels and check supplement interactions.
        </div>
      </Card>

      <SectionLabel>Connected devices</SectionLabel>
      <Card>
        {[
          { name: "Oura Ring", status: "connected", sync: "4m ago" },
          { name: "Eight Sleep", status: "connected", sync: "12m ago" },
          { name: "Apple Watch", status: "available" },
          { name: "WHOOP", status: "available" },
          { name: "Garmin", status: "available" },
          { name: "Continuous glucose monitor (CGM)", status: "available" },
          { name: "Apple Health", status: "available" },
          { name: "Google Fit", status: "available" },
        ].map((device, i, arr) => (
          <div key={device.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{device.name}</span>
            {device.status === "connected"
              ? <span style={{ fontSize: 12, color: COLORS.tealLight }}>Synced {device.sync}</span>
              : <button style={{
                background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 7,
                color: COLORS.textMuted, fontSize: 11, padding: "4px 10px", cursor: "pointer"
              }}>Connect</button>
            }
          </div>
        ))}
      </Card>
    </div>
  );
}

export { ProfileScreen };

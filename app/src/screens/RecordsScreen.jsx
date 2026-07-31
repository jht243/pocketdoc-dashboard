import React from "react";
import { ChevronRight, FileText, Sparkles, Upload } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

function RecordsScreen({ setActive }) {
  return (
    <div style={{ padding: "24px 18px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Your records</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Test results and appointment notes, reviewed for patterns your doctors may not have
        had the full picture to see.
      </div>

      <button onClick={() => setActive("discussion")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.gold}60`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 14
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <FileText size={18} color={COLORS.gold} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Next appointment discussion page</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Ready to share with your doctor</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <button onClick={() => setActive("importlabs")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.tealLight}60`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 18
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Upload size={18} color={COLORS.tealLight} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Import lab results</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Upload, photograph, or enter manually</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <SectionLabel>AI insight</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.gold}50`, background: COLORS.warnDim }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Sparkles size={18} color={COLORS.gold} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              Worth a closer look: thyroid pattern
            </div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
              Across your last 3 panels, TSH has stayed in normal range but TPO antibodies have
              risen steadily alongside fatigue and cold sensitivity you logged in check-ins.
              Individually, none of this stood out. Together, it's a pattern worth raising.
            </div>
            <div style={{
              background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
              color: COLORS.textSecondary, lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}>Two paths forward</div>
              <div style={{ marginBottom: 6 }}>
                <strong style={{ color: COLORS.tealLight }}>Bring to your doctor:</strong> ask about a
                full thyroid antibody panel and ultrasound referral.
              </div>
              <div>
                <strong style={{ color: COLORS.tealLight }}>Or self-pay:</strong> a thyroid antibody
                panel runs roughly $89–$140 at most independent labs without a doctor's order.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <SectionLabel>Uploaded</SectionLabel>
      <Card>
        {[
          { name: "Comprehensive panel, Jan 2026", type: "Lab result" },
          { name: "Endocrinology visit notes", type: "Appointment note" },
          { name: "Thyroid panel, Oct 2025", type: "Lab result" },
        ].map((item, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: i < 2 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <FileText size={16} color={COLORS.textMuted} />
              <div>
                <div style={{ fontSize: 13 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{item.type}</div>
              </div>
            </div>
            <ChevronRight size={14} color={COLORS.textMuted} />
          </div>
        ))}
      </Card>
    </div>
  );
}

export { RecordsScreen };

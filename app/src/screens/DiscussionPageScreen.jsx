import React, { useState } from "react";
import { CheckCircle2, ChevronRight, FileText, Sparkles, Upload } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

// ---- DISCUSSION PAGE (for next doctor appointment) ----
function DiscussionPageScreen({ setActive }) {
  const [shared, setShared] = useState(false);

  const symptomPattern = [
    { date: "Jun 14", note: "Fatigue, cold sensitivity" },
    { date: "Jun 19", note: "Mild fatigue, brain fog" },
    { date: "Jun 23", note: "Cold sensitivity, hair thinning noted" },
    { date: "Jun 27", note: "Fatigue, low mood, cold sensitivity" },
  ];

  const deviceSignals = [
    { label: "Resting heart rate", detail: "Trending up 6 bpm over 3 weeks", source: "Oura" },
    { label: "Overnight body temp", detail: "Elevated 2 of last 4 nights", source: "Oura" },
    { label: "HRV", detail: "Below baseline 5 of last 7 days", source: "Oura" },
    { label: "Sleep quality", detail: "Restorative sleep down 14% over 2 weeks", source: "Eight Sleep" },
  ];

  const privateLabFiles = [
    { name: "Thyroid antibody panel, self-pay", date: "Jun 21, 2026", source: "Quest Diagnostics (direct order)", size: "412 KB" },
    { name: "Comprehensive metabolic panel", date: "Jun 21, 2026", source: "Quest Diagnostics (direct order)", size: "286 KB" },
  ];

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("records")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Records
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Discussion page</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
        For your next appointment &middot; Endocrinology, Jul 8, 2026
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 22 }}>
        A summary of what's been reported, the pattern across it, and private labs to share.
      </div>

      <SectionLabel>Summary</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.gold}50`, background: COLORS.warnDim }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Sparkles size={18} color={COLORS.gold} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
            Over the past 6 weeks, fatigue and cold sensitivity have been reported repeatedly
            in daily check-ins, alongside a steady rise in TPO antibodies across the last 3
            lab panels while TSH has stayed in normal range. Device data shows a parallel
            rise in resting heart rate and reduced HRV. None of these signals alone would
            stand out at a single visit. Together, they're a pattern worth discussing, not
            a diagnosis, but a reason to ask whether further testing is warranted.
          </div>
        </div>
      </Card>

      <SectionLabel>Reported symptom pattern</SectionLabel>
      <Card>
        {symptomPattern.map((s, i) => (
          <div key={s.date} style={{
            display: "flex", gap: 12, padding: "9px 0",
            borderBottom: i < symptomPattern.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, width: 48, flexShrink: 0 }}>{s.date}</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{s.note}</span>
          </div>
        ))}
      </Card>

      <SectionLabel>Device signals</SectionLabel>
      <Card>
        {deviceSignals.map((w, i) => (
          <div key={w.label} style={{
            display: "flex", justifyContent: "space-between", padding: "9px 0",
            borderBottom: i < deviceSignals.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div>
              <span style={{ fontSize: 13 }}>{w.label}</span>
              <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 6 }}>({w.source})</span>
            </div>
            <span style={{ fontSize: 12, color: COLORS.warning }}>{w.detail}</span>
          </div>
        ))}
      </Card>

      <SectionLabel>Suggested questions to raise</SectionLabel>
      <Card>
        {[
          "Given the rising TPO antibodies, should we run a full thyroid antibody panel and consider a thyroid ultrasound?",
          "Could the fatigue and cold sensitivity be related, even with TSH in normal range?",
          "Is there a reason to monitor more frequently given the 6-week trend?",
        ].map((q, i, arr) => (
          <div key={i} style={{
            display: "flex", gap: 8, padding: "9px 0",
            borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 13, color: COLORS.gold, flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>{q}</span>
          </div>
        ))}
      </Card>

      <SectionLabel>Private lab files to share</SectionLabel>
      <Card>
        {privateLabFiles.map((f, i) => (
          <div key={f.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: i < privateLabFiles.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <FileText size={16} color={COLORS.tealLight} />
              <div>
                <div style={{ fontSize: 13 }}>{f.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{f.source} &middot; {f.date} &middot; {f.size}</div>
              </div>
            </div>
            <ChevronRight size={14} color={COLORS.textMuted} />
          </div>
        ))}
      </Card>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
        These were ordered and paid for directly, outside insurance, and haven't yet been
        seen by your doctor.
      </div>

      <button onClick={() => setShared(true)} style={{
        width: "100%", background: shared ? COLORS.bgCardAlt : COLORS.teal,
        border: shared ? `1px solid ${COLORS.tealLight}` : "none",
        color: shared ? COLORS.tealLight : COLORS.onAccent,
        fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>
        {shared ? <CheckCircle2 size={16} /> : <Upload size={16} />}
        {shared ? "Ready to share" : "Share / Export as PDF"}
      </button>
      {shared && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 10, textAlign: "center" }}>
          Export as PDF, email it directly to your provider, or print for your visit.
        </div>
      )}

      <div style={{
        marginTop: 20, padding: 12, background: COLORS.bgCardAlt, borderRadius: 10,
        fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5
      }}>
        This page summarizes patterns in your reported symptoms and data. It is not a
        diagnosis and does not replace clinical judgment. Only a licensed provider can
        diagnose or treat a medical condition.
      </div>
    </div>
  );
}

export { DiscussionPageScreen };

import React from "react";
import { AlertCircle, ChevronRight, FileText, Sparkles, Upload } from "lucide-react";
import { Card } from "../components/Card";
import { LockedDataSection } from "../components/LockedDataSection";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";
import { getRecordInsight } from "../lib/deterministicInsights";
import DocumentList from "../components/DocumentList";

function RecordsScreen({ setActive, healthData, aiInsights, onRecordsChange }) {
  const records = healthData?.records || [];
  // AI insight once loaded; deterministic fallback until it resolves, if the AI is
  // unavailable, or if the AI found nothing — an insight that was already on screen
  // must never collapse into the locked "import more" card.
  const insight = aiInsights?.record || getRecordInsight(healthData);
  return (
    <div style={{ padding: "24px 18px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Your records</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Test results and appointment notes, reviewed for patterns your doctors may not have
        had the full picture to see.
      </div>

      {records.length > 0 ? <button onClick={() => setActive("discussion")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.gold}60`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 14
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><FileText size={18} color={COLORS.gold} /><div style={{ textAlign: "left" }}><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Next appointment discussion page</div><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Ready to share with your doctor</div></div></div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button> : <LockedDataSection
        title="Appointment discussion page"
        description="Upload a lab result or appointment note to create a discussion page for your next visit."
        actionLabel="Import a record"
        onAction={() => setActive("importlabs")}
        rows={2}
      />}

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

      {insight && <><SectionLabel>Data insight</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.gold}50`, background: COLORS.warnDim }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {/* Star = AI-authored; deterministic fallback shows a normal icon. */}
          {insight.ai
            ? <Sparkles size={18} color={COLORS.gold} style={{ marginTop: 2, flexShrink: 0 }} />
            : <AlertCircle size={18} color={COLORS.gold} style={{ marginTop: 2, flexShrink: 0 }} />}
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              {insight.title}
            </div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
              {insight.body}
            </div>
            <div style={{
              background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
              color: COLORS.textSecondary, lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}>Two paths forward</div>
              <div style={{ marginBottom: 6 }}>
                <strong style={{ color: COLORS.tealLight }}>Bring to your doctor:</strong> {insight.doctorPath}
              </div>
              <div>
                <strong style={{ color: COLORS.tealLight }}>If you use self-pay:</strong> {insight.selfPayPath}
              </div>
            </div>
          </div>
        </div>
      </Card></>}

      {!insight && <><SectionLabel>Data insight</SectionLabel>
      <LockedDataSection
        title="Patterns across your records"
        description="Import results from more than one visit to unlock trends and discussion prompts."
        actionLabel="Import lab results"
        onAction={() => setActive("importlabs")}
        rows={2}
      /></>}

      {/* Real uploaded documents, read from the database — replaces the previous
          hardcoded placeholder list. */}
      <SectionLabel>Uploaded documents</SectionLabel>
      <Card>
        <DocumentList onEmptyAction={() => setActive("importlabs")} onDocumentsChange={onRecordsChange} />
      </Card>
    </div>
  );
}

export { RecordsScreen };

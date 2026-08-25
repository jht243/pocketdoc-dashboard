import React from "react";
import { AlertCircle, ChevronRight, Plus, Sparkles, TrendingUp } from "lucide-react";
import { Card } from "../components/Card";
import { LockedDataSection } from "../components/LockedDataSection";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

function LabsScreen({ setActive, goToMarket, healthData, aiInsights, testModeEnabled }) {
  // One row per marker, always the most recent draw. The full list holds every
  // panel ever imported (five panels ≈ 300 rows, five "CHOLESTEROL, TOTAL"s), and
  // which duplicate the member saw first was decided by upload order — a March 2024
  // cholesterol reading rendered as if it were current. `labs` arrives newest-draw-
  // first, so the first occurrence of each name is the one to keep.
  const allMarkers = healthData?.labs || [];
  const markers = [];
  const seen = new Set();
  for (const m of allMarkers) {
    const key = String(m.name || "").trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    markers.push(m);
  }
  const aiLabs = aiInsights?.labs || [];
  const statusColor = { normal: COLORS.tealLight, watch: COLORS.warning, low: COLORS.danger, high: COLORS.warning, unknown: COLORS.textMuted };
  return (
    <div style={{ padding: "24px 18px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Labs</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Tracked across every panel, not just your most recent one.
      </div>

      <button onClick={() => setActive("orderlabs")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.tealLight}60`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 18
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Plus size={18} color={COLORS.tealLight} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Order bloodwork</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>At-home collection via Tasso</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <SectionLabel>Latest results</SectionLabel>
      {markers.length > 0 ? <Card>
        {markers.map((m, i) => (
          <div key={`${m.name}-${m.drawnOn || m.created_at || m.date || i}`} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "11px 0", borderBottom: i < markers.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div>
              <div style={{ fontSize: 13 }}>{m.name}</div>
              {/* Each marker shows the draw date it came from — after dedup, rows can
                  come from different panels, and an undated number reads as current. */}
              {m.date && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{m.date}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: statusColor[m.status] }} />
            </div>
          </div>
        ))}
      </Card> : <LockedDataSection
        title="Your lab markers"
        description="Import a lab result to see each marker, its range, and what needs attention."
        actionLabel="Import lab results"
        onAction={() => setActive("importlabs")}
        rows={4}
      />}

      {/* AI-generated lab insights once available; otherwise the seeded demo cards. */}
      {aiLabs.length > 0 && <><SectionLabel>Insights</SectionLabel>
        {aiLabs.map((c, i) => {
          const color = c.severity === "danger" ? COLORS.danger : c.severity === "info" ? COLORS.tealLight : COLORS.warning;
          const bg = c.severity === "danger" ? COLORS.badDim : c.severity === "info" ? COLORS.bgCard : COLORS.warnDim;
          const onAction = () => {
            if (!c.action) return;
            if (c.action.target === "discussion" || c.action.target === "bodyfat_history") setActive(c.action.target === "bodyfat_history" ? "body" : "discussion");
            else goToMarket(c.action.target);
          };
          return (
            <Card key={i} style={{ border: `1px solid ${color}40`, background: bg }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {/* Star marks these as AI-authored. */}
                <Sparkles size={18} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: c.action ? 10 : 0 }}>{c.body}</div>
                  {c.action && (
                    <button onClick={onAction} style={{ background: "none", border: `1px solid ${color}`, color, fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>
                      {c.action.label} <ChevronRight size={12} style={{ display: "inline", verticalAlign: -2 }} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </>}

      {aiLabs.length === 0 && testModeEnabled && <Card style={{ border: `1px solid ${COLORS.danger}40`, background: COLORS.badDim }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertCircle size={18} color={COLORS.danger} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Vitamin D is low</div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
              28 ng/mL is below the recommended range of 30–50 ng/mL. Low vitamin D is common
              and usually addressed with daily supplementation, typically 2,000–5,000 IU of
              D3, ideally taken with a meal containing fat for better absorption. Worth
              re-checking in 8–12 weeks to confirm levels are responding before assuming a
              dose adjustment is needed.
            </div>
            <button onClick={() => goToMarket("vitd3")} style={{
              background: "none", border: `1px solid ${COLORS.tealLight}`, color: COLORS.tealLight,
              fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer"
            }}>
              Shop Vitamin D3 in Marketplace <ChevronRight size={12} style={{ display: "inline", verticalAlign: -2 }} />
            </button>
          </div>
        </div>
      </Card>}

      {aiLabs.length === 0 && testModeEnabled && <><SectionLabel>Trend</SectionLabel>
      <Card>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <TrendingUp size={16} color={COLORS.warning} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>TPO antibodies rising</span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
          Apr 2025: 64 IU/mL &rarr; Oct 2025: 91 IU/mL &rarr; Jan 2026: 118 IU/mL.
          Each result alone was within range. The trend across all three is what matters.
        </div>
      </Card></>}
      {!testModeEnabled && markers.length === 0 && <><SectionLabel>Trends</SectionLabel>
      <LockedDataSection
        title="Marker trends"
        description="Add at least two lab panels to unlock changes over time and pattern alerts."
        actionLabel="Import your first panel"
        onAction={() => setActive("importlabs")}
        rows={3}
      /></>}
    </div>
  );
}

export { LabsScreen };

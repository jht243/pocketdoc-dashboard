import React, { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Plus, Sparkles, TrendingUp } from "lucide-react";
import { Card } from "../components/Card";
import { LockedDataSection } from "../components/LockedDataSection";
import { SectionLabel } from "../components/SectionLabel";
import { UrgentBanner } from "../components/UrgentBanner";
import { COLORS, SERIF } from "../theme/tokens";
import { labTone, labToneColor } from "../lib/labTone";
import { groupMarkers } from "../lib/labGroups";

function LabsScreen({ setActive, goToMarket, healthData, aiInsights, testModeEnabled }) {
  // One row per marker, always the most recent draw. The full list holds every
  // panel ever imported (five panels ≈ 300 rows, five "CHOLESTEROL, TOTAL"s), and
  // which duplicate the member saw first was decided by upload order — a March 2024
  // cholesterol reading rendered as if it were current. `labs` arrives newest-draw-
  // first, so the first occurrence of each name is the one to keep.
  const allMarkers = healthData?.labs || [];
  const markers = [];
  const seen = new Set();
  // Every occurrence of each marker, keyed by normalized name — the collapsed row
  // shows the newest draw, tapping it reveals where every historical value came from.
  const historyByMarker = new Map();
  for (const m of allMarkers) {
    const key = String(m.name || "").trim().toUpperCase();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      markers.push(m);
    }
    const list = historyByMarker.get(key) || [];
    list.push(m);
    historyByMarker.set(key, list);
  }
  // Panels, A→Z inside each. A member with several imports has 200+ deduped rows;
  // a flat list of them is unreadable, so the screen shows one collapsed section per
  // panel and opens only the ones holding something out of range.
  const groups = groupMarkers(markers);
  const [expandedKey, setExpandedKey] = useState(null);
  // Explicit taps win; anything untouched follows the "open if it needs attention"
  // default, which has to stay derived because markers arrive after first render.
  const [groupOverrides, setGroupOverrides] = useState({});
  const groupIsOpen = (g) =>
    groupOverrides[g.name] ?? g.markers.some((m) => labTone(m) === "bad");
  const toggleGroup = (g) =>
    setGroupOverrides((prev) => ({ ...prev, [g.name]: !groupIsOpen(g) }));
  // "Bloodtest 6/8/2026" style label: the source file the panel came from plus the
  // full date it was drawn (falling back to the import date when the draw date is
  // unknown). A bare year can't tell two draws from the same year apart, which is
  // exactly what this list exists to show.
  const drawDate = (m) => {
    // A bare YYYY-MM-DD parses as UTC midnight, which renders as the previous day
    // in any timezone west of Greenwich — pin it to local midnight instead.
    const raw = m.drawnOn ? `${m.drawnOn}T00:00:00` : (m.created_at || "");
    if (!raw) return m.date || "";
    const d = new Date(raw);
    return isNaN(d) ? (m.date || "") : d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
  };
  const sourceLabel = (m) => {
    const when = drawDate(m);
    const src = m.source || "Imported file";
    return when ? `${src} · ${when}` : src;
  };
  const aiLabs = aiInsights?.labs || [];
  // A critical value is a lab finding, so the escalation belongs on this screen too —
  // above the marker table, not somewhere in the insights below it.
  const urgent = aiInsights?.urgent || [];
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

      <UrgentBanner items={urgent} />

      <SectionLabel>Latest results</SectionLabel>
      {markers.length > 0 ? <div>
        {groups.map((g) => {
          const open = groupIsOpen(g);
          const flagged = g.markers.filter((m) => labTone(m) === "bad").length;
          return (
            <Card key={g.name} style={{ padding: "4px 16px" }}>
              <div
                onClick={() => toggleGroup(g)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 0", cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                  {/* Count of markers out of range — the reason to open this panel. */}
                  {flagged > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: COLORS.danger,
                      background: COLORS.badDim, borderRadius: 10, padding: "2px 7px"
                    }}>{flagged}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: COLORS.textMuted }}>{g.markers.length}</span>
                  {open
                    ? <ChevronDown size={14} color={COLORS.textMuted} />
                    : <ChevronRight size={14} color={COLORS.textMuted} />}
                </div>
              </div>
              {open && g.markers.map((m, i) => {
                const key = String(m.name || "").trim().toUpperCase();
                const history = historyByMarker.get(key) || [];
                const expanded = expandedKey === key;
                return (
                  <div key={`${m.name}-${m.drawnOn || m.created_at || m.date || i}`} style={{
                    borderTop: `1px solid ${COLORS.border}`
                  }}>
                    <div
                      onClick={() => setExpandedKey(expanded ? null : key)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "11px 0", cursor: "pointer"
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13 }}>{m.name}</div>
                        {/* Each marker shows the draw date it came from — after dedup, rows can
                            come from different panels, and an undated number reads as current. */}
                        {m.date && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{m.date}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: labToneColor(m) }} />
                        {expanded
                          ? <ChevronDown size={14} color={COLORS.textMuted} />
                          : <ChevronRight size={14} color={COLORS.textMuted} />}
                      </div>
                    </div>
                    {/* Provenance: one line per panel this marker appeared in — which file it
                        came from, the year, and the value it held there. */}
                    {expanded && (
                      <div style={{ padding: "0 0 11px 12px" }}>
                        {history.map((h, j) => (
                          <div key={j} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "5px 0"
                          }}>
                            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{sourceLabel(h)}</div>
                            <div style={{ fontSize: 12, color: COLORS.textPrimary }}>{h.value}{h.unit ? ` ${h.unit}` : ""}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div> : <LockedDataSection
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
                  <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: c.basis ? 6 : (c.action ? 10 : 0) }}>{c.body}</div>
                  {/* Rule 1.3 — which of the three reference points made this a finding. */}
                  {c.basis && (
                    <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.45, marginBottom: c.action ? 10 : 0 }}>{c.basis}</div>
                  )}
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
              28 ng/mL sits below the 30–50 ng/mL range this panel reports, and below the
              40–60 ng/mL most longevity practices target — so it reads as low against both
              reference points, not just one. Vitamin D3 is the usual lever, absorbed better
              with a meal containing fat. Your clinician sets the amount; ask them to re-check
              in 8–12 weeks so you can see whether the level is actually responding.
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
        description="Import a panel to see your markers read against both the lab range and the functional range. A second panel adds change over time."
        actionLabel="Import your first panel"
        onAction={() => setActive("importlabs")}
        rows={3}
      /></>}
    </div>
  );
}

export { LabsScreen };

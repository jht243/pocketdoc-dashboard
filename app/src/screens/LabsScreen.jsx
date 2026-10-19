import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical, Plus, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { UrgentBanner } from "../components/UrgentBanner";
import { EvidenceBox } from "../components/EvidenceBox";
import { BioAgeCard } from "../components/BioAgeCard";
import { MarkerRow } from "../components/MarkerResult";
import { SystemScorecard } from "../components/SystemScorecard";
import { COLORS, DISPLAY } from "../theme/tokens";
import { groupMarkers } from "../lib/labGroups";
import { shortLabSource } from "../lib/labSource";
import { MARKER_TARGETS, ageFromDob, fetchMarkerTargets } from "../lib/markerTargets";
import { assessMarker } from "../lib/markerResults";
import { supabase } from "../lib/supabase";
import { insightActionLabel, liveInsightAction, runInsightAction } from "../lib/insightActions";

function LabsScreen({ setActive, healthData, aiInsights, userProfile }) {
  // Thumbprint targets: the table when it loads (so a medical-director revision
  // reaches members without a release), the bundled copy of the same seed until then
  // or whenever it can't be read.
  const [targets, setTargets] = useState(MARKER_TARGETS);
  useEffect(() => {
    let live = true;
    fetchMarkerTargets(supabase).then((rows) => { if (live && rows) setTargets(rows); });
    return () => { live = false; };
  }, []);
  // Sex and age personalise the targets that depend on them; when either is
  // missing, those targets are left off and the row shows the lab range alone.
  const profile = userProfile?.profile || userProfile || {};
  const ctx = { targets, sex: profile.sex, age: ageFromDob(profile.dob) };
  const outsideLab = (m) => assessMarker(m, ctx).status === "outside_lab";

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
    groupOverrides[g.name] ?? g.markers.some(outsideLab);
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
  // Older draws of the same marker often arrive without the reference range the
  // newest panel printed. Judging them by that range is right — it's the same
  // marker in the same units — and without it every historical dot would go grey.
  const withRange = (h, current) => {
    if (h.range || h.ref_range) return h;
    const range = current?.range || current?.ref_range;
    return range ? { ...h, range } : h;
  };
  const sourceLabel = (m) => {
    const when = drawDate(m);
    const src = shortLabSource(m.source) || "Imported file";
    return when ? `${src} · ${when}` : src;
  };
  const aiLabs = aiInsights?.labs || [];
  // A critical value is a lab finding, so the escalation belongs on this screen too —
  // above the marker table, not somewhere in the insights below it.
  const urgent = aiInsights?.urgent || [];
  return (
    <div style={{ padding: "24px 18px" }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>My biology</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Tracked across every panel, not just your most recent one.
      </div>

      {/* With no results yet, ordering is offered inside the one empty state below
          instead of as a second competing card up here. */}
      {markers.length > 0 && <button onClick={() => setActive("orderlabs")} style={{
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
      </button>}

      <UrgentBanner items={urgent} />

      {/* Biological age. */}
      <BioAgeCard healthData={healthData} userProfile={userProfile} setActive={setActive} />

      {markers.length > 0 && <>
        <SectionLabel>What's driving your numbers</SectionLabel>
        <SystemScorecard markers={markers} ctx={ctx} />
      </>}

      {markers.length > 0 && <SectionLabel>Latest results</SectionLabel>}
      {markers.length > 0 ? <div>
        {groups.map((g) => {
          const open = groupIsOpen(g);
          const flagged = g.markers.filter(outsideLab).length;
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
                  {/* Count of markers outside the lab's own range — the reason to open this panel. */}
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
                // Each row carries its own draw date — after dedup, rows can come from
                // different panels, and an undated number reads as current.
                return (
                  <MarkerRow
                    key={`${m.name}-${m.drawnOn || m.created_at || m.date || i}`}
                    m={m}
                    history={historyByMarker.get(key) || []}
                    ctx={ctx}
                    expanded={expandedKey === key}
                    onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                    sourceLabel={sourceLabel}
                    withRange={withRange}
                  />
                );
              })}
            </Card>
          );
        })}
      </div> : (
        // One empty state, one Import button. This screen used to stack "Your lab
        // markers — Import lab results" over "Marker trends — Import your first
        // panel": two prompts for the same single step.
        <Card style={{ textAlign: "center", padding: "26px 20px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: COLORS.bgCardAlt, display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
            <FlaskConical size={20} color={COLORS.tealLight} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>No lab results yet</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.55, marginBottom: 16 }}>
            Import a lab report to see each marker next to the range printed on it and your Thumbprint target. A second panel adds change over time.
          </div>
          <button onClick={() => setActive("importlabs")} style={{
            width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent,
            fontSize: 14, fontWeight: 700, padding: "13px", borderRadius: 12, cursor: "pointer"
          }}>
            Import lab results
          </button>
          <button onClick={() => setActive("orderlabs")} style={{
            marginTop: 10, background: "none", border: "none", color: COLORS.tealLight,
            fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 6
          }}>
            No results to import? Order bloodwork
          </button>
        </Card>
      )}

      {/* AI-generated lab insights once available. */}
      {aiLabs.length > 0 && <><SectionLabel>Insights</SectionLabel>
        {aiLabs.map((c, i) => {
          const color = c.severity === "danger" ? COLORS.danger : c.severity === "info" ? COLORS.tealLight : COLORS.warning;
          const bg = c.severity === "danger" ? COLORS.badDim : c.severity === "info" ? COLORS.bgCard : COLORS.warnDim;
          const action = liveInsightAction(c.action);
          const onAction = () => runInsightAction(action, { setActive });
          return (
            <Card key={i} style={{ border: `1px solid ${color}40`, background: bg }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {/* Star marks these as AI-authored. */}
                <Sparkles size={18} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: c.basis ? 0 : (action ? 10 : 0) }}>{c.body}</div>
                  {/* Rule 1.3 — which of the three reference points made this a finding. */}
                  {c.basis && <EvidenceBox style={{ marginBottom: action ? 10 : 0 }}>{c.basis}</EvidenceBox>}
                  {action && (
                    <button onClick={onAction} style={{ background: "none", border: `1px solid ${color}`, color, fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>
                      {insightActionLabel(action)} <ChevronRight size={12} style={{ display: "inline", verticalAlign: -2 }} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </>}

    </div>
  );
}

export { LabsScreen };

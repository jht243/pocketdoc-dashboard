import React, { useMemo, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";
import { COLORS, DISPLAY } from "../theme/tokens";
import { aboutYears, bioAgeEnabled, bioAgeFromLabs, formatYears } from "../lib/phenoAge";
import { scrollPhoneToTop } from "../lib/scroll";

/**
 * Biological age (Levine PhenoAge) — the header card on Home and Biology, and the
 * improvement simulator it opens.
 *
 * Behind a flag until the medical director signs off (see bioAgeEnabled): with the
 * flag off this renders nothing and computes nothing, so members never see it.
 *
 * Everything shown comes from the member's own lab rows and date of birth. When the
 * number can't be calculated the card says what's missing — never a guess, never a
 * partial-panel estimate.
 */

const DISCLAIMER = "Estimate from a published research model. Not a diagnosis.";

const fmtDate = (date) =>
  date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

/** One line on direction of travel. Under a year either way is noise, and says so. */
function trendLine(trend) {
  if (!trend) return null;
  const since = fmtDate(trend.since) || "previous";
  if (trend.direction === "steady") {
    return `About the same as your ${since} draw — changes under a year are within normal lab variation.`;
  }
  return `${aboutYears(Math.abs(trend.change)).replace(/^about/, "About")} ${trend.direction} relative to your age than your ${since} draw.`;
}

/** Where the "not yet" card sends the member, so it's an action rather than a dead end. */
function nextStep(out) {
  if (out.status === "missing") return { label: "Order bloodwork", screen: "orderlabs" };
  if (out.status === "unavailable" && out.reason === "no-age") return { label: "Add date of birth", screen: "account" };
  return null;
}

/** hs-CRP reads to a decimal place on every report ("1.0 mg/L"); glucose is whole. */
const leverValue = (lever, v) => (lever.key === "crp" ? Number(v).toFixed(1) : String(v));

function Simulator({ out, onClose }) {
  const { latest, draw, simulator, history } = out;
  const levers = simulator?.levers || [];
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%", zIndex: 100,
      background: COLORS.bgDeep, display: "flex", flexDirection: "column",
      padding: "20px 18px 100px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>What could move it</div>
        <button onClick={onClose} aria-label="Close" style={{
          background: COLORS.bgCardAlt, border: "none", borderRadius: 16, width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}><X size={16} color={COLORS.textSecondary} /></button>
      </div>

      <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
        Your biological age from your {fmtDate(draw?.date) || "latest"} draw is {latest.display}.
        Each line below reruns the same published model (Levine et al., 2018) with one value
        changed and everything else held as it was. These are estimates from a research model,
        not a diagnosis or a promise.
      </div>

      <SectionLabel>Top levers</SectionLabel>
      <Card>
        {levers.map((l, i) => (
          <div key={l.key} style={{
            padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
            borderBottom: i === levers.length - 1 && !simulator.combined ? "none" : `1px solid ${COLORS.border}`,
          }}>
            <div>
              <div style={{ fontSize: 13 }}>{l.label}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                {l.applicable
                  ? `${leverValue(l, l.current)} → ${leverValue(l, l.target)} ${l.unit}`
                  : `${leverValue(l, l.current)} ${l.unit} · already at or below ${leverValue(l, l.target)} ${l.unit}`}
              </div>
            </div>
            {l.applicable && (
              <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", color: l.effect === "small effect" ? COLORS.textSecondary : COLORS.good }}>
                {l.effect}
              </span>
            )}
          </div>
        ))}
        {simulator.combined && (
          <div style={{ padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13 }}>Both together</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>Calculated together, not added up</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", color: simulator.combined.effect === "small effect" ? COLORS.textSecondary : COLORS.good }}>
              {simulator.combined.effect}
            </span>
          </div>
        )}
      </Card>
      {simulator?.targets && !simulator.targets.approved && (
        <div style={{ fontSize: 11, color: COLORS.gold, lineHeight: 1.5, marginBottom: 14 }}>
          Target values are placeholders pending medical-director review.
        </div>
      )}

      {history?.length >= 2 && <>
        <SectionLabel>Your draws</SectionLabel>
        <Card>
          {history.map((h, i) => (
            <div key={h.key} style={{
              padding: "8px 0", display: "flex", justifyContent: "space-between", fontSize: 13,
              borderBottom: i === history.length - 1 ? "none" : `1px solid ${COLORS.border}`,
            }}>
              <span style={{ color: COLORS.textSecondary }}>{fmtDate(h.date) || h.key}</span>
              <span>{formatYears(h.phenoAge)} <span style={{ color: COLORS.textMuted }}>(age {h.age})</span></span>
            </div>
          ))}
        </Card>
      </>}

      <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>{DISCLAIMER}</div>
    </div>
  );
}

function BioAgeCardInner({ healthData, userProfile, setActive }) {
  const [open, setOpen] = useState(false);
  const labs = healthData?.labs;
  const dob = userProfile?.profile?.dob || null;
  const out = useMemo(() => bioAgeFromLabs(labs || [], { dob }), [labs, dob]);

  if (out.status !== "ok") {
    const step = nextStep(out);
    return (
      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.textMuted, marginBottom: 6 }}>
          Biological age
        </div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>{out.message}</div>
        {step && setActive && (
          <button onClick={() => setActive(step.screen)} style={{
            marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: COLORS.accent, display: "flex", alignItems: "center", gap: 4,
          }}>{step.label} <ChevronRight size={14} /></button>
        )}
      </Card>
    );
  }

  const { latest, draw, trend, simulator } = out;
  const canSimulate = simulator?.levers?.some((l) => l.applicable);
  const lowConfidence = latest.confidence === "low" ? latest.notes.find((n) => /fasting|hs-CRP|detection/i.test(n)) : null;
  const openSimulator = () => {
    if (!canSimulate) return;
    scrollPhoneToTop();
    setOpen(true);
  };

  return (
    <>
      {open && <Simulator out={out} onClose={() => setOpen(false)} />}
      <button onClick={openSimulator} style={{
        width: "100%", background: "none", border: "none", padding: 0, textAlign: "left",
        cursor: canSimulate ? "pointer" : "default", display: "block", marginBottom: 12,
      }}>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>Biological age</span>
            <span style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: COLORS.brand, letterSpacing: "-0.01em" }}>{latest.display}</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>(you're {latest.age})</span>
          </div>
          {draw?.date && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>From your {fmtDate(draw.date)} draw</div>
          )}
          <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 6 }}>{DISCLAIMER}</div>
          {lowConfidence && (
            <div style={{ fontSize: 11, color: COLORS.gold, marginTop: 6, lineHeight: 1.5 }}>Lower confidence: {lowConfidence}</div>
          )}
          {trend && (
            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 8, lineHeight: 1.5 }}>{trendLine(trend)}</div>
          )}
          {canSimulate && (
            <div style={{ fontSize: 11, color: COLORS.accent, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
              Tap to see what could move it <ChevronRight size={12} />
            </div>
          )}
        </Card>
      </button>
    </>
  );
}

/**
 * Renders nothing unless the biological-age flag is on. The flag is read once per
 * mount — flipping it in another tab takes effect on the next screen visit.
 */
function BioAgeCard(props) {
  const [enabled] = useState(bioAgeEnabled);
  if (!enabled) return null;
  return <BioAgeCardInner {...props} />;
}

export { BioAgeCard };

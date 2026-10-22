import React, { useMemo, useState } from "react";
import { track, useTrackOnce } from "../lib/analytics";
import { ChevronRight, X } from "lucide-react";
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";
import { COLORS, DISPLAY } from "../theme/tokens";
import { aboutYears, bioAgeFromLabs, formatYears } from "../lib/phenoAge";
import { scrollPhoneToTop } from "../lib/scroll";

/**
 * Biological age (Levine PhenoAge) — the header card on Home and Biology, and the
 * improvement simulator it opens.
 *
 * Shown to every member: Dr. Locker signed off on the model and the simulator
 * targets in Oct 2026.
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
        {latest.capped
          ? <>Your biological age from your {fmtDate(draw?.date) || "latest"} draw is more than 10 years younger than your age.</>
          : <>Your biological age from your {fmtDate(draw?.date) || "latest"} draw is {latest.display}.</>}
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

/** The member's bio-age result from their own labs and date of birth. */
function useBioAge(healthData, userProfile) {
  const labs = healthData?.labs;
  const dob = userProfile?.profile?.dob || null;
  // Intake answers that pause the score: each moves these markers for reasons
  // unrelated to aging.
  const intake = userProfile?.intake || {};
  const pregnant = intake.pregnancy === "Pregnant";
  const cancerTreatment = intake.cancerActiveTreatment === "Yes";
  const acuteIllness = intake.illnessAtLastDraw === "Yes";
  const out = useMemo(
    () => bioAgeFromLabs(labs || [], { dob, flags: { pregnant, cancerTreatment, acuteIllness } }),
    [labs, dob, pregnant, cancerTreatment, acuteIllness],
  );
  useTrackOnce("score_viewed", { score: "biological" }, out.status === "ok");
  useTrackOnce("score_missing_prompt_shown", { score: "biological", status: out.status }, out.status !== "ok");
  return out;
}

/** Opening the simulator: scroll up, show it, and record that the levers were tried. */
function simulatorOpener(out, setOpen) {
  const { simulator } = out;
  const canSimulate = out.status === "ok" && simulator?.levers?.some((l) => l.applicable);
  const open = () => {
    if (!canSimulate) return;
    scrollPhoneToTop();
    setOpen(true);
    // The simulator shows every lever's effect at once, so opening it is also the
    // member trying the levers.
    const levers = simulator.levers.filter((l) => l.applicable).map((l) => l.key);
    track("simulator_opened", { score: "biological", levers });
    track("simulator_lever_tried", { score: "biological", levers, combined: Boolean(simulator.combined) });
  };
  return { canSimulate, open };
}

function BioAgeCardInner({ healthData, userProfile, setActive }) {
  const [open, setOpen] = useState(false);
  const out = useBioAge(healthData, userProfile);

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

  const { latest, draw, trend } = out;
  const { canSimulate, open: openSimulator } = simulatorOpener(out, setOpen);
  const lowConfidence = latest.confidence === "low" ? latest.notes.find((n) => /fasting|hs-CRP|detection/i.test(n)) : null;

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
            {latest.capped
              ? <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: COLORS.brand }}>{latest.headline}</span>
              : <>
                  <span style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: COLORS.brand, letterSpacing: "-0.01em" }}>{latest.display}</span>
                  <span style={{ fontSize: 13, color: COLORS.textSecondary }}>(you're {latest.age})</span>
                </>}
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

function BioAgeCard(props) {
  return <BioAgeCardInner {...props} />;
}

/** "about 12 years younger than your age", or "about the same as your age" under a year. */
function gapLine(gap) {
  if (Math.abs(gap) < 1) return "About the same as your age";
  return `${aboutYears(Math.abs(gap)).replace(/^about/, "About")} ${gap < 0 ? "younger" : "older"} than your age`;
}

/**
 * Home's lead: biological age in the circle, actual age under it, and the button that
 * asks the care team how to bring it down. Replaced the Health Score dial on Oct 21
 * 2026 (Dr. Locker: "this part needs to go… we have this in a circle, you know, 50
 * years and then you put actual age on the bottom or minus however many years").
 *
 * Without a number it says what's missing and offers the one step that fixes it, the
 * same as the card on Biology.
 */
function BioAgeHero({ healthData, userProfile, setActive, onReduce }) {
  const [open, setOpen] = useState(false);
  const out = useBioAge(healthData, userProfile);
  const ok = out.status === "ok";
  const { canSimulate, open: openSimulator } = simulatorOpener(out, setOpen);
  const latest = ok ? out.latest : null;
  const step = ok ? null : nextStep(out);
  const R = 92;

  return (
    <>
      {open && <Simulator out={out} onClose={() => setOpen(false)} />}
      <Card style={{ textAlign: "center", paddingTop: 22, paddingBottom: 18 }}>
        <button onClick={openSimulator} aria-label={canSimulate ? "See what could move your biological age" : undefined} style={{
          background: "none", border: "none", padding: 0, display: "block", margin: "0 auto",
          cursor: canSimulate ? "pointer" : "default",
        }}>
          <div style={{ position: "relative", width: 204, height: 204 }}>
            <svg width="204" height="204" aria-hidden="true">
              <circle cx="102" cy="102" r={R} fill="none" stroke={ok ? COLORS.brand : COLORS.ringTrack} strokeWidth="10" />
            </svg>
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 2, padding: "0 30px",
            }}>
              {ok && !latest.capped && (
                <span style={{ fontFamily: DISPLAY, fontSize: 60, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: COLORS.textPrimary }}>{latest.display}</span>
              )}
              {ok && latest.capped && (
                <span style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: COLORS.textPrimary }}>{latest.headline}</span>
              )}
              {!ok && (
                <span style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 700, lineHeight: 1, color: COLORS.textMuted }}>—</span>
              )}
              <span style={{ fontSize: 10.5, color: COLORS.textMuted, fontWeight: 600, letterSpacing: "0.1em", marginTop: 4 }}>BIOLOGICAL AGE</span>
            </div>
          </div>
        </button>

        {ok ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary, marginTop: 12 }}>You're {latest.age}</div>
            {!latest.capped && (
              <div style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>{gapLine(latest.gap)}</div>
            )}
            {out.draw?.date && (
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>From your {fmtDate(out.draw.date)} draw</div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginTop: 12 }}>{out.message}</div>
        )}

        {ok && onReduce && (
          <button onClick={onReduce} style={{
            width: "100%", marginTop: 16, background: COLORS.accent, border: "none", color: COLORS.onAccent,
            fontSize: 14, fontWeight: 700, padding: "13px 14px", borderRadius: 12, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            Help me reduce my biological age <ChevronRight size={15} />
          </button>
        )}
        {!ok && step && setActive && (
          <button onClick={() => setActive(step.screen)} style={{
            width: "100%", marginTop: 16, background: COLORS.accent, border: "none", color: COLORS.onAccent,
            fontSize: 14, fontWeight: 700, padding: "13px 14px", borderRadius: 12, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            {step.label} <ChevronRight size={15} />
          </button>
        )}
        {canSimulate && (
          <button onClick={openSimulator} style={{
            marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: COLORS.accent,
          }}>See what in your labs could move it</button>
        )}
        <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 10 }}>{DISCLAIMER}</div>
      </Card>
    </>
  );
}

export { BioAgeCard, BioAgeHero };

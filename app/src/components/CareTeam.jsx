import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain, Check, ChevronDown, Dna, Ear, Eye, Flame, Flower2, HeartHandshake, HeartPulse,
  Moon, Pill, Salad, ShieldAlert, ShieldCheck, Soup, Sparkles, Stethoscope, TestTubeDiagonal, UserRound, Users,
} from "lucide-react";
import { COLORS } from "../theme/tokens";
import { member, readTeam, photoUrl, ADVOCATE, SAFETY } from "../lib/careTeam";

const ICONS = {
  Brain, Dna, Ear, Eye, Flame, Flower2, HeartHandshake, HeartPulse, Moon, Pill, Salad,
  ShieldCheck, Soup, Sparkles, Stethoscope, TestTubeDiagonal, UserRound,
};

const REDUCED = typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------------- avatar ---------------- */

export function TeamAvatar({ id, size = 28, state, ring = true }) {
  const m = member(id);
  const Icon = ICONS[m.icon] || Stethoscope;
  const working = state === "working";
  const src = photoUrl(id, Math.round(size * 3));
  const [broken, setBroken] = useState(false);
  const photo = src && !broken;
  // The specialty icon rides on the photo as a small badge, so the colour coding
  // still reads at a glance. Too small to be legible on the tiniest avatars.
  const badge = photo && size >= 26 ? Math.round(size * 0.42) : 0;
  return (
    <span style={{
      position: "relative", width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: m.color, display: "inline-flex", alignItems: "center", justifyContent: "center",
      boxShadow: ring ? `0 0 0 2px ${COLORS.bgCard}` : "none",
      animation: working && !REDUCED ? "ct-ring 1.4s ease-out infinite" : "none",
      "--ct-c": `${m.color}66`,
      transition: "width .35s, height .35s",
    }}>
      {photo ? (
        <img
          src={src} alt={m.label} onError={() => setBroken(true)} draggable={false}
          style={{
            width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block",
            border: `2px solid ${m.color}`, boxSizing: "border-box", background: COLORS.bgCardAlt,
          }}
        />
      ) : (
        <Icon size={Math.round(size * 0.52)} color="#fff" strokeWidth={2.2} />
      )}
      {badge > 0 && (
        <span style={{
          position: "absolute", left: -3, bottom: -3, width: badge, height: badge, borderRadius: "50%",
          background: m.color, border: `1.5px solid ${COLORS.bgCard}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon size={Math.round(badge * 0.6)} color="#fff" strokeWidth={2.4} /></span>
      )}
      {state === "done" && (
        <span style={{
          position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: "50%",
          background: COLORS.good, border: `2px solid ${COLORS.bgCard}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Check size={7} color="#fff" strokeWidth={4} /></span>
      )}
    </span>
  );
}

function Name({ id }) {
  const m = member(id);
  return <span style={{ fontWeight: 650, color: m.color }}>{m.label}</span>;
}

/* ---------------- small motion pieces ---------------- */

function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", verticalAlign: "middle" }}>
      {[0, 1, 2].map((i) => (
        <i key={i} style={{
          width: 5, height: 5, borderRadius: "50%", background: COLORS.textMuted,
          animation: REDUCED ? "none" : `ct-blink 1s ${i * 0.15}s infinite`,
        }} />
      ))}
    </span>
  );
}

/** Text that types itself out once, then stays put. */
function Typed({ text, animate, onGrow }) {
  const [n, setN] = useState(animate && !REDUCED ? 0 : text.length);
  useEffect(() => {
    if (n >= text.length) return undefined;
    const id = setTimeout(() => { setN((v) => Math.min(text.length, v + 3)); onGrow?.(); }, 18);
    return () => clearTimeout(id);
  }, [n, text, onGrow]);
  return <>{text.slice(0, n)}{n < text.length && <span style={{ opacity: 0.4 }}>▍</span>}</>;
}

/* ---------------- the reveal queue ---------------- */

/**
 * The team's events land at model speed, which is uneven: a consult can return in
 * under a second and the next in eight. Revealing them through a queue with a
 * minimum dwell keeps one voice on screen long enough to read, which is the
 * "one advocate at a time" behaviour agreed on the Oct 7 call. Stored turns skip
 * the queue entirely.
 */
function dwell(e) {
  if (!e) return 600;
  if (e.type === "specialist_done") return Math.min(4200, 900 + (e.finding || "").length * 9);
  if (e.type === "huddle_note") return Math.min(3200, 800 + (e.note || "").length * 14);
  if (e.type === "route_done") return 1800;
  if (e.type === "specialist_start") return 1300;
  return 900;
}

function useReveal(events, animate, onGrow) {
  const [n, setN] = useState(animate ? 0 : events.length);
  useEffect(() => {
    if (!animate) { setN(events.length); return undefined; }
    if (n >= events.length) return undefined;
    const id = setTimeout(() => { setN((v) => v + 1); onGrow?.(); }, n === 0 ? 0 : dwell(events[n - 1]));
    return () => clearTimeout(id);
  }, [n, events, animate, onGrow]);
  return events.slice(0, n);
}

/* ---------------- roster rail: who's on the case, and the baton ---------------- */

function RosterRail({ view }) {
  const ids = ["advocate", ...view.plan.map((p) => p.id), "safety"];
  const stateOf = (id) => {
    if (id === "advocate") return view.active === "advocate" ? "working" : view.done ? "done" : "idle";
    if (id === "safety") return view.safety?.done ? "done" : view.active === "safety" ? "working" : "idle";
    const c = view.consults.find((x) => x.id === id);
    if (view.huddle && !view.huddle.done && view.huddle.ids.includes(id)) return "working";
    return c ? c.state : "idle";
  };
  const activeIdx = Math.max(0, ids.indexOf(view.active));
  const slot = 100 / ids.length;

  return (
    <div style={{ position: "relative", padding: "6px 0 2px" }}>
      {/* The wire the baton travels along. */}
      <div style={{
        position: "absolute", top: 24, left: `${slot / 2}%`, right: `${slot / 2}%`, height: 2,
        background: `repeating-linear-gradient(90deg, ${COLORS.strokeStrong} 0 4px, transparent 4px 8px)`,
      }} />
      {view.active && (
        <div style={{
          position: "absolute", top: 20, width: 10, height: 10, borderRadius: "50%",
          left: `calc(${slot * activeIdx + slot / 2}% - 5px)`,
          background: member(view.active).color, boxShadow: `0 0 10px ${member(view.active).color}`,
          transition: REDUCED ? "none" : "left .7s cubic-bezier(.6,0,.3,1), background .4s",
          zIndex: 0,
        }} />
      )}
      <div style={{ position: "relative", display: "flex" }}>
        {ids.map((id) => {
          const s = stateOf(id);
          const on = id === view.active;
          const m = member(id);
          return (
            <div key={id} style={{
              width: `${slot}%`, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              opacity: s === "idle" && !on ? 0.5 : 1, transition: "opacity .4s",
              animation: REDUCED ? "none" : "ct-pop .35s ease-out",
            }}>
              <div style={{ height: 38, display: "flex", alignItems: "center" }}>
                <TeamAvatar id={id} size={on ? 36 : 28} state={on ? "working" : s} />
              </div>
              <span style={{
                fontSize: 9.5, lineHeight: 1.15, textAlign: "center", maxWidth: 64,
                color: on ? m.color : COLORS.textMuted, fontWeight: on ? 700 : 500,
              }}>{m.short || m.label}</span>
            </div>
          );
        })}
        {view.routing && [0, 1].map((i) => (
          <div key={`ph${i}`} style={{ width: `${slot}%`, display: "flex", justifyContent: "center", paddingTop: 5 }}>
            <span style={{
              width: 28, height: 28, borderRadius: "50%", background: COLORS.ringTrack,
              animation: REDUCED ? "none" : `ct-blink 1.2s ${i * 0.2}s infinite`,
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- live status line ---------------- */

function statusLine(view) {
  if (view.routing) return "My Advocate is reading your question and your chart";
  if (view.stage === "route") return `My Advocate is bringing in ${view.plan.length} specialist${view.plan.length === 1 ? "" : "s"}`;
  if (view.stage === "consult") {
    const c = view.consults[view.consults.length - 1];
    return c?.state === "working"
      ? `${member(c.id).label} is reviewing your record`
      : `${member(c.id).label} reported back`;
  }
  if (view.stage === "huddle") return view.huddle?.done ? "The team agreed on what matters most" : "The specialists are comparing notes";
  if (view.stage === "draft") return view.draft?.done ? "Answer drafted" : "My Advocate is writing your answer with live research";
  if (view.stage === "safety") return view.safety?.done ? "Safety review complete" : "Checking the answer against clinical safety rules";
  if (view.done) return "Your answer is ready";
  return "";
}

/* ---------------- timeline rows ---------------- */

function Row({ id, state, children, last }) {
  return (
    <div style={{ display: "flex", gap: 10, position: "relative", animation: REDUCED ? "none" : "ct-in .3s ease-out" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <TeamAvatar id={id} size={26} state={state} />
        {!last && <div style={{ flex: 1, width: 2, background: COLORS.border, marginTop: 4, minHeight: 10 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 12 }}>{children}</div>
    </div>
  );
}

function FlagPill({ flag }) {
  if (!flag || flag === "ok") return null;
  const urgent = flag === "urgent";
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase",
      padding: "2px 6px", borderRadius: 999, marginLeft: 6,
      background: urgent ? COLORS.badDim : COLORS.warnDim, color: urgent ? COLORS.danger : COLORS.gold,
    }}>{urgent ? "Urgent" : "Watch"}</span>
  );
}

function ConsultRow({ c, open, onToggle, animate, onGrow, last }) {
  const working = c.state === "working";
  const expanded = working || open;
  return (
    <Row id={c.id} state={c.state} last={last}>
      <button onClick={working ? undefined : onToggle} style={{
        all: "unset", display: "block", width: "100%", cursor: working ? "default" : "pointer",
      }}>
        <div style={{ fontSize: 12, lineHeight: 1.35, color: COLORS.textSecondary, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
          <Name id={c.id} />
          {working
            ? <span style={{ marginLeft: 6 }}><Dots /></span>
            : <>
                <FlagPill flag={c.flag} />
                <ChevronDown size={13} color={COLORS.textMuted} style={{
                  marginLeft: "auto", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s",
                }} />
              </>}
        </div>
        {working && (
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>{member(c.id).tagline}</div>
        )}
        {!working && c.headline && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.textPrimary, marginTop: 2, lineHeight: 1.35 }}>
            {c.headline}
          </div>
        )}
      </button>
      {expanded && (
        <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
          {/* The hand-off itself: who asked whom. */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: COLORS.textMuted }}>
            <TeamAvatar id="advocate" size={16} ring={false} />
            <span style={{ position: "relative", width: 28, height: 2, overflow: "hidden", background: COLORS.border, borderRadius: 2 }}>
              {working && !REDUCED && (
                <i style={{
                  position: "absolute", top: 0, left: 0, width: 10, height: 2, borderRadius: 2,
                  background: member(c.id).color, animation: "ct-handoff 1s ease-in-out infinite",
                }} />
              )}
            </span>
            <TeamAvatar id={c.id} size={16} ring={false} />
            <span>{working ? "handed off" : "reported back"}</span>
          </div>
          <div style={{
            fontSize: 11.5, lineHeight: 1.45, color: COLORS.textSecondary, background: COLORS.accentDim,
            borderLeft: `3px solid ${ADVOCATE.color}`, borderRadius: "4px 8px 8px 4px", padding: "6px 9px",
          }}>
            <span style={{ fontWeight: 650, color: ADVOCATE.color }}>My Advocate asked: </span>{c.ask}
          </div>
          {!working && c.finding && (
            <div style={{
              fontSize: 12, lineHeight: 1.5, color: COLORS.textPrimary, background: COLORS.bgCardAlt,
              borderRadius: "4px 12px 12px 12px", padding: "8px 10px",
            }}>
              <Typed text={c.finding} animate={animate} onGrow={onGrow} />
            </div>
          )}
        </div>
      )}
    </Row>
  );
}

function HuddleRow({ huddle, last, folded, onToggle }) {
  return (
    <Row id="advocate" state={huddle.done ? "done" : "working"} last={last}>
      <div onClick={huddle.done ? onToggle : undefined} style={{
        cursor: huddle.done ? "pointer" : "default",
        border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "8px 10px",
        background: `linear-gradient(180deg, ${COLORS.accentDim}, ${COLORS.bgCard})`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: COLORS.textPrimary }}>
          <Users size={13} color={COLORS.teal} /> Team huddle
          <span style={{ display: "inline-flex", marginLeft: 4 }}>
            {huddle.ids.map((id, i) => (
              <span key={id} style={{ marginLeft: i ? -6 : 0 }}><TeamAvatar id={id} size={18} /></span>
            ))}
          </span>
          {!huddle.done && <span style={{ marginLeft: "auto" }}><Dots /></span>}
          {huddle.done && (
            <ChevronDown size={13} color={COLORS.textMuted} style={{
              marginLeft: "auto", transform: folded ? "none" : "rotate(180deg)", transition: "transform .2s",
            }} />
          )}
        </div>
        <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
          {!folded && huddle.notes.map((n, i) => (
            <div key={i} style={{ animation: REDUCED ? "none" : "ct-in .3s ease-out" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: COLORS.textMuted, marginBottom: 3 }}>
                <TeamAvatar id={n.from} size={16} ring={false} />
                <Name id={n.from} />
                <span style={{ margin: "0 2px" }}>→</span>
                <TeamAvatar id={n.to} size={16} ring={false} />
                <Name id={n.to} />
              </div>
              <div style={{
                fontSize: 11.5, lineHeight: 1.45, color: COLORS.textPrimary, background: COLORS.bgCard,
                border: `1px solid ${member(n.from).color}33`, borderRadius: "4px 10px 10px 10px", padding: "6px 9px",
              }}>{n.note}</div>
            </div>
          ))}
          {huddle.done && huddle.consensus && (
            <div style={{ display: "flex", gap: 6, fontSize: 11.5, lineHeight: 1.45, color: COLORS.good, fontWeight: 600 }}>
              <Check size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {huddle.consensus}
            </div>
          )}
        </div>
      </div>
    </Row>
  );
}

function Timeline({ view, animate, onGrow }) {
  // The newest consult stays open; earlier ones fold to their headline so the
  // phone shows one voice at a time. Tapping a folded one reopens it.
  const [open, setOpen] = useState({});
  // The huddle folds to its consensus once the Advocate moves on to writing.
  const [huddleOpen, setHuddleOpen] = useState(null);
  const huddleFolded = huddleOpen === null ? !!view.draft : !huddleOpen;
  const rows = [];

  rows.push(
    <Row key="route" id="advocate" state={view.routing ? "working" : "done"}>
      <div style={{ fontSize: 12, lineHeight: 1.45, color: COLORS.textSecondary }}>
        <Name id="advocate" />
        {view.routing
          ? <div style={{ marginTop: 2 }}>Reading your question and your chart <Dots /></div>
          : (
            <div style={{ marginTop: 2, color: COLORS.textPrimary }}>
              Bringing in{" "}
              {view.plan.map((p, i) => (
                <React.Fragment key={p.id}>
                  {i > 0 && (i === view.plan.length - 1 ? " and " : ", ")}
                  <span style={{
                    background: `${member(p.id).color}14`, color: member(p.id).color, fontWeight: 650,
                    borderRadius: 6, padding: "0 5px",
                  }}>{member(p.id).label}</span>
                </React.Fragment>
              ))}
              {view.reason && <span style={{ color: COLORS.textSecondary }}>. {view.reason}</span>}
            </div>
          )}
      </div>
    </Row>
  );

  view.consults.forEach((c, i) => {
    const latest = i === view.consults.length - 1 && !view.huddle && !view.draft;
    rows.push(
      <ConsultRow
        key={`c${i}`} c={c} animate={animate} onGrow={onGrow}
        open={open[i] ?? (latest && !view.done)}
        onToggle={() => setOpen((o) => ({ ...o, [i]: !(o[i] ?? (latest && !view.done)) }))}
      />
    );
  });

  if (view.huddle) {
    rows.push(
      <HuddleRow
        key="huddle" huddle={view.huddle} folded={huddleFolded}
        onToggle={() => setHuddleOpen(huddleFolded)}
      />
    );
  }

  if (view.draft) {
    rows.push(
      <Row key="draft" id="advocate" state={view.draft.done ? "done" : "working"}>
        <div style={{ fontSize: 12, lineHeight: 1.45, color: COLORS.textSecondary }}>
          <Name id="advocate" />
          <div style={{ marginTop: 2, color: COLORS.textPrimary }}>
            {view.draft.done
              ? `Wrote your answer${view.draft.sources ? `, checking ${view.draft.sources} live source${view.draft.sources === 1 ? "" : "s"}` : ""}`
              : <>Writing your answer with live research <Dots /></>}
          </div>
        </div>
      </Row>
    );
  }

  if (view.safety) {
    const s = view.safety;
    rows.push(
      <Row key="safety" id="safety" state={s.done ? "done" : "working"}>
        <div style={{ fontSize: 12, lineHeight: 1.45, color: COLORS.textSecondary }}>
          <Name id="safety" />
          <div style={{ marginTop: 2, color: COLORS.textPrimary, display: "flex", gap: 5, alignItems: "flex-start" }}>
            {!s.done && <>Checking every line against clinical safety rules <Dots /></>}
            {s.done && s.revised && <><ShieldAlert size={14} color={COLORS.gold} style={{ flexShrink: 0, marginTop: 1 }} />Caught wording that crossed a safety rule and sent it back to My Advocate to fix.</>}
            {s.done && !s.revised && s.clean && <><ShieldCheck size={14} color={COLORS.good} style={{ flexShrink: 0, marginTop: 1 }} />Passed: no diagnoses, no prescriptions, grounded in your data.</>}
            {s.done && !s.revised && !s.clean && <><ShieldAlert size={14} color={COLORS.gold} style={{ flexShrink: 0, marginTop: 1 }} />Flagged for caution. Confirm with your clinician.</>}
          </div>
          {s.done && s.urgent?.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11.5, color: COLORS.danger, fontWeight: 600 }}>
              Needs prompt attention: {s.urgent.join("; ")}
            </div>
          )}
        </div>
      </Row>
    );
  }

  return (
    <div>
      {rows.map((r, i) => (i === rows.length - 1 ? React.cloneElement(r, { last: true }) : r))}
    </div>
  );
}

/* ---------------- the card ---------------- */

/**
 * The care team's working, drawn inside the chat above the Advocate's reply.
 *
 * Live: a roster rail across the top (who's on the case, with a baton that
 * travels to whoever is speaking), a status line, and a timeline where the
 * newest voice is open and earlier ones fold to a headline.
 * Done: folds to a one-line summary of who was consulted, tap to reopen.
 */
export function CareTeamCard({ events = [], animate = false, onRevealed, onGrow }) {
  const shown = useReveal(events, animate, onGrow);
  const view = useMemo(() => readTeam(shown), [shown]);
  const done = view.done;
  // A live round holds its finished state on screen for a beat, so the safety
  // review's pass is seen before the card folds away and the answer appears.
  const [held, setHeld] = useState(!animate);
  const finished = done && held;
  const [expanded, setExpanded] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    if (!done || held) return undefined;
    const id = setTimeout(() => setHeld(true), REDUCED ? 0 : 1600);
    return () => clearTimeout(id);
  }, [done, held]);

  useEffect(() => {
    if (finished && !reported.current) { reported.current = true; onRevealed?.(); }
  }, [finished, onRevealed]);

  const consulted = view.plan.map((p) => p.id);

  if (finished && !expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={{
        all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
        background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 999,
        padding: "5px 10px 5px 6px", maxWidth: "92%", boxSizing: "border-box",
        animation: animate && !REDUCED ? "ct-in .35s ease-out" : "none",
      }}>
        <span style={{ display: "inline-flex" }}>
          {["advocate", ...consulted, "safety"].map((id, i) => (
            <span key={id} style={{ marginLeft: i ? -7 : 0 }}><TeamAvatar id={id} size={22} /></span>
          ))}
        </span>
        <span style={{ fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 1.3, minWidth: 0 }}>
          <b style={{ color: COLORS.textPrimary }}>
            {consulted.length} specialist{consulted.length === 1 ? "" : "s"} consulted
          </b>
          {view.safety?.clean !== false && " · safety checked"}
          {view.seconds ? ` · ${view.seconds}s` : ""}
        </span>
        <ChevronDown size={14} color={COLORS.textMuted} style={{ flexShrink: 0 }} />
      </button>
    );
  }

  return (
    <div style={{
      width: "100%", boxSizing: "border-box", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
      borderRadius: 16, padding: "10px 12px 12px", boxShadow: "0 4px 18px rgba(26,60,94,0.07)",
      animation: animate && !REDUCED ? "ct-in .35s ease-out" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: COLORS.textMuted }}>
          My care team
        </span>
        {!finished && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700,
            color: COLORS.good, background: COLORS.goodDim, borderRadius: 999, padding: "1px 7px",
          }}>
            <i style={{
              width: 6, height: 6, borderRadius: "50%", background: COLORS.good,
              animation: REDUCED ? "none" : "ct-blink 1.2s infinite",
            }} />LIVE
          </span>
        )}
        {finished && (
          <button onClick={() => setExpanded(false)} style={{
            all: "unset", cursor: "pointer", marginLeft: "auto", fontSize: 11, color: COLORS.tealLight, fontWeight: 600,
          }}>Hide</button>
        )}
      </div>

      <RosterRail view={view} />

      {!finished && (
        <div className="ct-shimmer" aria-live="polite" style={{
          fontSize: 12.5, fontWeight: 600, margin: "6px 0 10px", lineHeight: 1.35,
        }}>{statusLine(view)}…</div>
      )}
      {finished && <div style={{ height: 8 }} />}

      <Timeline view={view} animate={animate} onGrow={onGrow} />
    </div>
  );
}

/** Small "My Advocate" byline over a team reply. */
export function AdvocateByline() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
      <TeamAvatar id="advocate" size={20} ring={false} />
      <span style={{ fontSize: 11.5, fontWeight: 650, color: ADVOCATE.color }}>{ADVOCATE.label}</span>
    </div>
  );
}

export const CARE_TEAM_CSS = `
@keyframes ct-ring { 0% { box-shadow: 0 0 0 0 var(--ct-c); } 70% { box-shadow: 0 0 0 8px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
@keyframes ct-blink { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
@keyframes ct-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes ct-pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
@keyframes ct-handoff { from { transform: translateX(-10px); } to { transform: translateX(28px); } }
@keyframes ct-sweep { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.ct-shimmer {
  color: ${COLORS.textPrimary};
  background: linear-gradient(90deg, ${COLORS.textPrimary} 0%, ${COLORS.textPrimary} 40%, ${COLORS.accentSoft} 50%, ${COLORS.textPrimary} 60%, ${COLORS.textPrimary} 100%);
  background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  animation: ct-sweep 2.4s linear infinite;
}
@media (prefers-reduced-motion: reduce) { .ct-shimmer { animation: none; -webkit-text-fill-color: currentColor; } }
`;

export { SAFETY };

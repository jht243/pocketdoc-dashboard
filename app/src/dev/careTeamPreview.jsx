// Dev-only harness for the care-team card: replays a scripted round at roughly
// the pace real model calls arrive, inside a phone-width column. See
// care-team-preview.html.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CareTeamCard, AdvocateByline, CARE_TEAM_CSS } from "../components/CareTeam";
import { RichReply } from "../components/RichReply";
import { COLORS } from "../theme/tokens";
import "../styles/global.css";

const SCRIPT = [
  [0, { type: "route_start" }],
  [2200, { type: "route_done", reason: "Your fatigue question touches thyroid, iron and statin effects.", consult: [
    { id: "endocrinology", ask: "Is my member's TSH trend from 2.1 to 3.8 over 18 months, with Hashimoto's, a plausible driver of their fatigue?" },
    { id: "bloodwork", ask: "Which markers alongside ferritin 48 and vitamin D 31 best explain my member's low energy, and what should be retested?" },
    { id: "pharmacy", ask: "Could my member's rosuvastatin 10mg or TRT be contributing to fatigue or CoQ10 depletion?" },
  ] }],
  [400, { type: "specialist_start", id: "endocrinology", ask: "Is my member's TSH trend from 2.1 to 3.8 over 18 months, with Hashimoto's, a plausible driver of their fatigue?" }],
  [3600, { type: "specialist_done", id: "endocrinology", headline: "TSH is drifting up toward under-replacement", flag: "watch",
    finding: "TSH has climbed from 2.1 (Jan 2025) to 3.8 (Jun 2026) while free T4 sits low-normal at 1.0 ng/dL. With Hashimoto's, that pattern is consistent with a slowly failing thyroid, and fatigue is one of its earliest signs. A full panel with free T3 and TPO antibodies would clarify it." }],
  [300, { type: "specialist_start", id: "bloodwork", ask: "Which markers alongside ferritin 48 and vitamin D 31 best explain my member's low energy, and what should be retested?" }],
  [3100, { type: "specialist_done", id: "bloodwork", headline: "Vitamin D and ferritin are both suboptimal", flag: "watch",
    finding: "Vitamin D at 31 ng/mL (Jun 2026) is in range but below the 40–60 functional target, and ferritin at 48 ng/mL is on the low side for energy. Neither alone explains fatigue, but together with the TSH trend they form a cluster worth retesting in 8–12 weeks." }],
  [300, { type: "specialist_start", id: "pharmacy", ask: "Could my member's rosuvastatin 10mg or TRT be contributing to fatigue or CoQ10 depletion?" }],
  [2900, { type: "specialist_done", id: "pharmacy", headline: "Statins can lower CoQ10; worth asking about", flag: "ok",
    finding: "Rosuvastatin can reduce CoQ10, which some people notice as muscle fatigue; the evidence for supplementing is mixed. Hematocrit is 47% on TRT, so not a cause here. Worth raising with his prescriber before changing anything." }],
  [300, { type: "huddle_start", ids: ["endocrinology", "bloodwork", "pharmacy"] }],
  [3000, { type: "huddle_note", from: "bloodwork", to: "endocrinology", note: "Low ferritin can blunt T4-to-T3 conversion, so your TSH finding and my iron finding may be the same story." }],
  [0, { type: "huddle_note", from: "endocrinology", to: "pharmacy", note: "Agreed. If he starts thyroid medication, his statin response may shift too, so flag a lipid recheck." }],
  [0, { type: "huddle_note", from: "pharmacy", to: "bloodwork", note: "I'd retest vitamin D and ferritin before adding CoQ10, so we're not stacking supplements on a thyroid problem." }],
  [0, { type: "huddle_done", consensus: "The rising TSH is the lead; retest the thyroid panel, ferritin and vitamin D together." }],
  [300, { type: "draft_start" }],
  [5200, { type: "draft_done", sources: 4 }],
  [200, { type: "safety_start" }],
  [900, { type: "safety_done", clean: true, revised: false, urgent: [] }],
  [0, { type: "answer", seconds: 21 }],
];

const REPLY = `## Short answer
Your fatigue most likely has more than one contributor, and **your thyroid is the lead**.

## What the team found
- **Endocrinology:** TSH rose from 2.1 to 3.8 over 18 months while free T4 sits low-normal.
- **Blood Work:** vitamin D (31 ng/mL) and ferritin (48 ng/mL) are both *below functional targets*.
  - Low iron can make thyroid conversion worse.

## What to test, and how often
| Test | How Often | Why | Note |
|------|-----------|-----|------|
| ApoB, LDL, HDL, TG | 3–6 mo | CVD risk, statin effect | ApoB is critical; LDL-C can lag behind |
| hs-CRP | 3–6 mo | Chronic inflammation | Over 1.0 mg/L is noteworthy |
| TSH, Free T4, Free T3, TPO ab | 6 mo | Thyroid autoimmunity | Symptoms can precede abnormal TSH |

---
1. Ask for a full thyroid panel.
2. Retest vitamin D and ferritin at the same draw.`;

function Preview() {
  const [run, setRun] = useState(0);
  const [events, setEvents] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const bottom = useRef(null);

  useEffect(() => {
    setEvents([]); setRevealed(false);
    let cancelled = false;
    (async () => {
      for (const [wait, e] of SCRIPT) {
        await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;
        setEvents((prev) => [...prev, e]);
      }
    })();
    return () => { cancelled = true; };
  }, [run]);

  const grow = useCallback(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }), []);

  return (
    <div style={{ minHeight: "100vh", background: "#E6EBF1", display: "flex", justifyContent: "center" }}>
      <style>{CARE_TEAM_CSS}</style>
      <div style={{ width: 390, maxWidth: "100%", background: COLORS.bgDeep, minHeight: "100vh", padding: "16px 14px 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => setRun((r) => r + 1)} style={{ alignSelf: "flex-start", fontSize: 11 }}>Replay</button>
        <div style={{ alignSelf: "flex-end", maxWidth: "84%", background: COLORS.teal, color: "#fff", padding: "10px 14px", borderRadius: 16, borderBottomRightRadius: 4, fontSize: 13 }}>
          Why am I so tired lately even though I sleep 8 hours?
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          {events.length > 0 && (
            <div style={{ width: "100%", marginBottom: 8, display: "flex" }}>
              <CareTeamCard key={run} events={events} animate onGrow={grow} onRevealed={() => setRevealed(true)} />
            </div>
          )}
          {revealed && (
            <>
              <AdvocateByline />
              <div style={{ maxWidth: "92%", background: COLORS.bgCard, padding: "10px 14px", borderRadius: 16, borderBottomLeftRadius: 4, fontSize: 13, lineHeight: 1.6, color: COLORS.textPrimary }}><RichReply text={REPLY} /></div>
            </>
          )}
        </div>
        <div ref={bottom} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Preview />);

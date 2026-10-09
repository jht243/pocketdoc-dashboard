/**
 * The care team: a Healthcare Advocate who brings in specialist advocates.
 *
 * Modelled on the Monitus manager/expert pipeline, translated into medicine. The
 * Advocate reads the question, decides which specialists to consult, asks each one
 * something specific, lets them compare notes, writes the reply, and the reply is
 * checked against the clinical rules before the member sees it.
 *
 * Demo stage: every specialist reads the SAME health record (buildHealthContext).
 * What differs is the lens each one is told to apply, not the data it can see.
 * Compartmentalised per-specialty knowledge bases come later; the event contract
 * below is what they will plug into, so the UI won't need to change when they do.
 *
 * Every step is a real model call, and each one is reported as an event the moment
 * it happens, which is what the chat animates. Nothing here is a timer pretending to
 * be work. The only pacing is in the UI, which holds each step on screen long enough
 * to read.
 */
import { callAI, firstText, firstCitations } from "./api";
import { violatesForbiddenOutput, hasFunctionalConcern, detectUrgentPatterns } from "./clinicalRules";

// Routing, consults and the huddle are short, structured calls, so a fast model
// keeps the whole round inside the time a member will watch it. The Advocate's
// reply still goes to the main chat model with live research.
const TEAM_MODEL = import.meta.env.VITE_AI_TEAM_MODEL || "gpt-4.1-mini";

export const ADVOCATE = {
  id: "advocate",
  // Written as the member's own: the Advocate works for them, not for the app.
  label: "My Advocate",
  short: "My Advocate",
  icon: "HeartHandshake",
  color: "#2E7D9F",
};

export const SAFETY = {
  id: "safety",
  label: "Safety Review",
  short: "Safety",
  icon: "ShieldCheck",
  color: "#1A7A4A",
};

/**
 * The specialists the Advocate can call on. `lens` is what makes each one think
 * differently about the shared record; `sex` restricts who is offered for a member
 * whose recorded sex makes the specialty irrelevant.
 */
export const SPECIALISTS = [
  { id: "bloodwork", label: "Blood Work", short: "Labs", icon: "TestTubeDiagonal", color: "#C2410C",
    lens: "lab interpretation: reference vs functional ranges, trends across draws, marker clusters, what to retest and when" },
  { id: "cardiology", label: "Cardiology", short: "Cardio", icon: "HeartPulse", color: "#DC2626",
    lens: "heart and vascular health: lipids (ApoB, LDL-P, Lp(a)), blood pressure, resting heart rate and HRV, inflammation (hs-CRP), cardiovascular risk" },
  { id: "endocrinology", label: "Endocrinology", short: "Hormones", icon: "Flame", color: "#D97706",
    lens: "hormones and metabolism: thyroid panel, glucose, insulin, A1c, cortisol, sex hormones, TRT monitoring" },
  { id: "gynecology", label: "Gynecology", short: "Gyn", icon: "Flower2", color: "#DB2777", sex: "female",
    lens: "women's health: menstrual cycle, fertility, pregnancy, perimenopause and menopause, estrogen/progesterone, pelvic health, cervical and breast screening" },
  { id: "urology", label: "Men's Health", short: "Men's", icon: "UserRound", color: "#2563EB", sex: "male",
    lens: "men's health: testosterone, PSA, prostate, fertility, erectile and urinary health, TRT side-effect monitoring (hematocrit, estradiol)" },
  { id: "audiology", label: "Audiology", short: "Hearing", icon: "Ear", color: "#0891B2",
    lens: "hearing and ear health: hearing loss, tinnitus, noise exposure, ototoxic medications, hearing screening schedule" },
  { id: "pharmacy", label: "Pharmacist", short: "Pharmacist", icon: "Pill", color: "#7C3AED",
    lens: "medications and supplements: interactions, dosing ranges, timing, nutrient depletions caused by medications, what to confirm with the prescriber" },
  { id: "nutrition", label: "Nutrition", short: "Nutrition", icon: "Salad", color: "#16A34A",
    lens: "diet and micronutrients: vitamin D, B12, iron/ferritin, magnesium, omega-3, protein intake, food patterns that move the markers in question" },
  { id: "sleep", label: "Sleep & Recovery", short: "Sleep", icon: "Moon", color: "#4F46E5",
    lens: "sleep and recovery: sleep duration and stages, HRV, readiness, circadian timing, training load from the wearable data" },
  { id: "genetics", label: "Genetics", short: "Genetics", icon: "Dna", color: "#9333EA",
    lens: "genetics: how any recorded variants (e.g. MTHFR, APOE, VDR) change risk, nutrient needs or medication response" },
  { id: "gastro", label: "Gastroenterology", short: "Gut", icon: "Soup", color: "#A16207",
    lens: "digestive health: gut symptoms, liver enzymes (ALT/AST/GGT), absorption, celiac and IBD markers, colon cancer screening" },
  { id: "neurology", label: "Brain & Mood", short: "Brain", icon: "Brain", color: "#BE185D",
    lens: "brain and mental health: mood, focus, stress, headaches, cognitive symptoms and the labs and habits linked to them" },
  { id: "dermatology", label: "Dermatology", short: "Skin", icon: "Sparkles", color: "#E11D48",
    lens: "skin, hair and nails: rashes, acne, hair loss, skin cancer screening, and the nutrient or hormone patterns behind them" },
  { id: "ophthalmology", label: "Eye Health", short: "Eyes", icon: "Eye", color: "#0E7490",
    lens: "eye health: vision changes, diabetic and hypertensive eye risk, glaucoma and retinal screening schedule" },
];

// One line under each name saying what that advocate is for (the role-tagline
// idea from Microsoft's MAI-DxO virtual panel), so a member watching can tell why
// each one was brought in.
const TAGLINES = {
  advocate: "Works for you and runs your team",
  safety: "Checks every answer before you see it",
  bloodwork: "Reads your labs and their trends",
  cardiology: "Heart, lipids and blood pressure",
  endocrinology: "Hormones, thyroid and metabolism",
  gynecology: "Cycle, fertility and menopause",
  urology: "Testosterone, prostate and TRT",
  audiology: "Hearing and ear health",
  pharmacy: "Medications, supplements, interactions",
  nutrition: "Diet and micronutrients",
  sleep: "Sleep, HRV and recovery",
  genetics: "How your variants change the picture",
  gastro: "Gut, liver and digestion",
  neurology: "Mood, focus and brain health",
  dermatology: "Skin, hair and nails",
  ophthalmology: "Vision and eye screening",
};
for (const m of [ADVOCATE, SAFETY, ...SPECIALISTS]) m.tagline = TAGLINES[m.id] || "";

// Portraits for the advocates: free-licence Unsplash photos, served from
// Unsplash's CDN with a face crop. The Safety Review keeps its shield on purpose:
// it is a rules check in code, and a face would suggest a person reviewed the
// answer.
const PHOTOS = {
  advocate: "1594824476967-48c8b964273f",
  bloodwork: "1736289173074-df6009da27c9",
  cardiology: "1612349317150-e413f6a5b16d",
  endocrinology: "1659353888906-adb3e0041693",
  gynecology: "1623854767648-e7bb8009f0db",
  urology: "1637059824899-a441006a6875",
  audiology: "1622253692010-333f2da6031d",
  pharmacy: "1770134223774-13b735e29201",
  nutrition: "1643297654416-05795d62e39c",
  sleep: "1645066928295-2506defde470",
  genetics: "1712215544003-af10130f8eb3",
  gastro: "1622902046580-2b47f47f5471",
  neurology: "1678695972687-033fa0bdbac9",
  dermatology: "1758691462651-611d730c5272",
  ophthalmology: "1758691463582-11aea602cd4a",
};
export function photoUrl(id, px) {
  const photo = PHOTOS[id];
  return photo
    ? `https://images.unsplash.com/photo-${photo}?w=${px}&h=${px}&fit=facearea&facepad=3&q=70&auto=format`
    : null;
}

const BY_ID = Object.fromEntries([ADVOCATE, SAFETY, ...SPECIALISTS].map((m) => [m.id, m]));
export const member = (id) => BY_ID[id] || { id, label: id, short: id, icon: "Stethoscope", color: "#5B6470" };

const MAX_SPECIALISTS = 3;

function recordedSex(userProfile) {
  const s = String(userProfile?.profile?.sex || userProfile?.sex || "").toLowerCase();
  if (/^f|female|woman/.test(s)) return "female";
  if (/^m|male|man/.test(s)) return "male";
  return null;
}

function rosterFor(userProfile) {
  const sex = recordedSex(userProfile);
  return SPECIALISTS.filter((s) => !s.sex || !sex || s.sex === sex);
}

/** Pull the first JSON object out of a model reply that may wrap it in prose or fences. */
function parseJson(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/* ---------------- 1. routing ---------------- */

async function route({ question, recentTurns, roster, healthContext }) {
  const list = roster.map((s) => `- ${s.id}: ${s.label} (${s.lens})`).join("\n");
  const system = `You are the Healthcare Advocate on a member's care team. Before answering a question you decide which specialist advocates to consult. You do not answer the question yourself here.

Available specialists:
${list}

Pick the 2 or 3 specialists whose lens matters most for THIS question and THIS member's data (pick 1 only for a trivial question). For each, write the specific thing you want them to look at, phrased as a direct ask that names the member's actual markers, values, medications or symptoms where relevant (max 22 words). You are the member's own advocate speaking to a colleague on their behalf, so refer to them as "my member" (e.g. "Is my member's TSH trend…"), never "he", "she" or "the patient".

Reply with JSON only:
{"reason":"one sentence, max 20 words, on why this team, written TO the member in the second person (\"your fatigue touches thyroid and iron\"), never \"this member\" or \"the patient\"","consult":[{"id":"<specialist id>","ask":"<the ask>"}]}

The member's health record:
${healthContext}`;
  const data = await callAI({
    system,
    messages: [...recentTurns, { role: "user", content: question }],
    model: TEAM_MODEL,
    maxTokens: 300,
  });
  const plan = parseJson(firstText(data));
  const valid = new Set(roster.map((s) => s.id));
  const seen = new Set();
  const consult = (plan?.consult || [])
    .filter((c) => valid.has(c?.id) && !seen.has(c.id) && seen.add(c.id))
    .slice(0, MAX_SPECIALISTS)
    .map((c) => ({ id: c.id, ask: clip(c.ask, 180) }));
  // A malformed plan still gets a team: the lab reader is the one specialist whose
  // lens applies to almost every question this app is asked.
  if (!consult.length) consult.push({ id: "bloodwork", ask: "What in this member's record bears most directly on their question?" });
  return { reason: clip(plan?.reason, 160), consult };
}

/* ---------------- 2. consults ---------------- */

async function consult({ spec, ask, question, healthContext }) {
  const system = `You are the ${spec.label} advocate on a member's care team. Your lens: ${spec.lens}.
The Healthcare Advocate is consulting you about the member's question. Answer the Advocate, not the member.

Rules:
- Ground everything in the member's record below. Quote specific values with their dates. If the record has nothing relevant to your lens, say so plainly and name what data would help.
- Describe patterns and possibilities, never a diagnosis. No prescriptions.
- Be brief: 2 to 3 sentences, max 70 words.
- The member can read this. Refer to them as "our member" (e.g. "our member's TSH"), never "he", "she", "this member" or "the patient".

Reply with JSON only:
{"headline":"your key point in max 9 words","finding":"your 2-3 sentence answer to the Advocate","flag":"ok|watch|urgent"}

The member's health record:
${healthContext}`;
  const data = await callAI({
    system,
    messages: [{ role: "user", content: `Member's question: "${question}"\n\nThe Advocate asks you: ${ask}` }],
    model: TEAM_MODEL,
    maxTokens: 260,
  });
  const out = parseJson(firstText(data)) || { finding: firstText(data) };
  return {
    headline: clip(out.headline, 70),
    finding: clip(out.finding, 480),
    flag: ["ok", "watch", "urgent"].includes(out.flag) ? out.flag : "ok",
  };
}

/* ---------------- 3. huddle ---------------- */

async function huddle({ question, findings }) {
  const team = findings.map((f) => `- ${f.id} (${member(f.id).label}): ${f.finding}`).join("\n");
  const system = `You are writing the short internal discussion between specialist advocates on a member's care team after each has reported. They react to EACH OTHER's findings: connect them, flag a conflict, or add a caveat the others missed. Only use what is in their findings; add no new data. The member can read this, so refer to them as "our member", never "he", "she", "this member" or "the patient".

Reply with JSON only, 2 to 4 notes in a natural order:
{"notes":[{"from":"<specialist id>","to":"<specialist id>","note":"max 26 words, first person, addressed to the other specialist"}],"consensus":"one sentence, max 22 words, on what the team agrees matters most"}`;
  const data = await callAI({
    system,
    messages: [{ role: "user", content: `Member's question: "${question}"\n\nFindings:\n${team}` }],
    model: TEAM_MODEL,
    maxTokens: 320,
  });
  const out = parseJson(firstText(data)) || {};
  const ids = new Set(findings.map((f) => f.id));
  const notes = (out.notes || [])
    .filter((n) => ids.has(n?.from) && ids.has(n?.to) && n.from !== n.to && n.note)
    .slice(0, 4)
    .map((n) => ({ from: n.from, to: n.to, note: clip(n.note, 200) }));
  return { notes, consensus: clip(out.consensus, 180) };
}

/* ---------------- orchestration ---------------- */

/**
 * Run one question through the care team.
 *
 * @param {object}   opts
 * @param {string}   opts.question        the member's message
 * @param {Array}    opts.apiMessages     the windowed thread, gateway-shaped (last item is the question)
 * @param {string}   opts.systemPrompt    the existing chat persona + full health context
 * @param {string}   opts.healthContext   the health context alone, for the team calls
 * @param {object}   opts.userProfile
 * @param {object}   opts.healthData
 * @param {string}   opts.chatModel       model for the Advocate's final reply
 * @param {Function} opts.cleanReply      the chat screen's markdown stripper
 * @param {Function} opts.onEvent         called with each event as it happens
 * @returns {Promise<{reply, citations, events}>}
 */
export async function runCareTeam({
  question, apiMessages, systemPrompt, healthContext, userProfile, healthData, chatModel, cleanReply, onEvent,
}) {
  const events = [];
  const started = Date.now();
  const emit = (e) => {
    const ev = { ...e, t: Date.now() - started };
    events.push(ev);
    onEvent?.(ev);
  };

  const recentTurns = apiMessages.slice(0, -1).slice(-6)
    .map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" }))
    .filter((m) => m.content);

  // 1. The Advocate decides who to bring in.
  emit({ type: "route_start" });
  const plan = await route({ question, recentTurns, roster: rosterFor(userProfile), healthContext });
  emit({ type: "route_done", reason: plan.reason, consult: plan.consult });

  // 2. Each specialist answers the Advocate's ask. Sequential on purpose: the
  // gateway serialises calls anyway, and one voice at a time is how the chat shows it.
  const findings = [];
  for (const c of plan.consult) {
    const spec = member(c.id);
    emit({ type: "specialist_start", id: c.id, ask: c.ask });
    try {
      const f = await consult({ spec, ask: c.ask, question, healthContext });
      findings.push({ id: c.id, ...f });
      emit({ type: "specialist_done", id: c.id, ...f });
    } catch (err) {
      emit({ type: "specialist_done", id: c.id, headline: "Couldn't report this time", finding: "", flag: "ok", failed: true });
      console.error("care team consult", c.id, err);
    }
  }

  // 3. With more than one voice, they compare notes.
  const reporting = findings.filter((f) => f.finding);
  let consensus = "";
  if (reporting.length > 1) {
    emit({ type: "huddle_start", ids: reporting.map((f) => f.id) });
    try {
      const h = await huddle({ question, findings: reporting });
      consensus = h.consensus;
      for (const n of h.notes) emit({ type: "huddle_note", ...n });
      emit({ type: "huddle_done", consensus });
    } catch (err) {
      console.error("care team huddle", err);
      emit({ type: "huddle_done", consensus: "" });
    }
  }

  // 4. The Advocate writes the reply, with the team's findings in front of it.
  emit({ type: "draft_start" });
  const briefing = reporting.length
    ? `\n\nYOUR CARE TEAM'S FINDINGS (you are the Healthcare Advocate; you consulted these specialist advocates before answering. Build on them, credit them naturally where useful, e.g. "Cardiology flagged…", and resolve any disagreement):\n${reporting.map((f) => `- ${member(f.id).label}: ${f.finding}`).join("\n")}${consensus ? `\nTeam consensus: ${consensus}` : ""}`
    : "";
  const data = await callAI({
    system: systemPrompt + briefing,
    messages: apiMessages,
    model: chatModel,
    maxTokens: 1200,
    webSearch: true,
  });
  let reply = cleanReply(firstText(data, "I couldn't generate a response."));
  const citations = firstCitations(data);
  emit({ type: "draft_done", sources: citations.length });

  // 5. Safety review. Deterministic, from the clinical rules: forbidden output is
  // caught in code, and a flagged draft is sent back once for a rewrite.
  emit({ type: "safety_start" });
  const urgent = detectUrgentPatterns({ healthData, messages: [{ role: "user", text: question }] })
    .filter((u) => u.kind !== "recheck");
  let problem = violatesForbiddenOutput(reply, { hasFunctionalConcern: hasFunctionalConcern(healthData) });
  let revised = false;
  if (problem) {
    emit({ type: "safety_flag", problem });
    try {
      const fix = await callAI({
        system: "You edit health guidance so it obeys the app's clinical rules. Keep the substance, structure and length. Change only what breaks the rule. Return the full corrected reply, nothing else.",
        messages: [{ role: "user", content: `Rule broken: ${problem}\n\nReply to correct:\n${reply}` }],
        model: TEAM_MODEL,
        maxTokens: 1200,
      });
      const fixed = cleanReply(firstText(fix));
      if (fixed) { reply = fixed; revised = true; }
      problem = violatesForbiddenOutput(reply, { hasFunctionalConcern: hasFunctionalConcern(healthData) });
    } catch (err) {
      console.error("care team revise", err);
    }
  }
  emit({
    type: "safety_done",
    clean: !problem,
    revised,
    // Crisis language is surfaced as the action, not as a "finding" in the record.
    urgent: urgent.map((u) => (u.id === "crisis" ? "If you're thinking about harming yourself, call or text 988 now" : u.label)),
  });

  emit({ type: "answer", seconds: Math.round((Date.now() - started) / 1000) });
  return { reply, citations, events };
}

/**
 * Fold the event list into what the chat draws. Pure, so a stored turn replays
 * through exactly the same path as a live one.
 */
export function readTeam(events = []) {
  const view = {
    stage: "route",          // route | consult | huddle | draft | safety | done
    routing: true,
    reason: "",
    plan: [],                // [{id, ask}]
    consults: [],            // [{id, ask, state: working|done, headline, finding, flag}]
    huddle: null,            // {ids, notes: [], consensus, done}
    draft: null,             // {done, sources}
    safety: null,            // {done, clean, revised, problem, urgent}
    active: "advocate",      // who is speaking right now
    done: false,
    seconds: null,
  };
  for (const e of events) {
    switch (e.type) {
      case "route_start": view.routing = true; view.active = "advocate"; break;
      case "route_done":
        view.routing = false; view.reason = e.reason; view.plan = e.consult || []; break;
      case "specialist_start":
        view.stage = "consult"; view.active = e.id;
        view.consults.push({ id: e.id, ask: e.ask, state: "working" }); break;
      case "specialist_done": {
        const c = [...view.consults].reverse().find((x) => x.id === e.id);
        if (c) Object.assign(c, { state: "done", headline: e.headline, finding: e.finding, flag: e.flag, failed: e.failed });
        break;
      }
      case "huddle_start":
        view.stage = "huddle"; view.active = e.ids?.[0];
        view.huddle = { ids: e.ids || [], notes: [], consensus: "", done: false }; break;
      case "huddle_note":
        if (view.huddle) { view.huddle.notes.push({ from: e.from, to: e.to, note: e.note }); view.active = e.from; }
        break;
      case "huddle_done":
        if (view.huddle) { view.huddle.done = true; view.huddle.consensus = e.consensus; } break;
      case "draft_start": view.stage = "draft"; view.active = "advocate"; view.draft = { done: false }; break;
      case "draft_done": if (view.draft) Object.assign(view.draft, { done: true, sources: e.sources }); break;
      case "safety_start": view.stage = "safety"; view.active = "safety"; view.safety = { done: false }; break;
      case "safety_flag": if (view.safety) view.safety.problem = e.problem; break;
      case "safety_done": if (view.safety) Object.assign(view.safety, { done: true, clean: e.clean, revised: e.revised, urgent: e.urgent || [] }); break;
      case "answer": view.stage = "done"; view.done = true; view.active = null; view.seconds = e.seconds; break;
      default: break;
    }
  }
  return view;
}

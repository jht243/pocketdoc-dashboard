/**
 * The care team: a Healthcare Advocate who brings in specialist advocates.
 *
 * Modelled on the Monitus manager/expert pipeline, translated into medicine. The
 * Advocate reads the question, decides which specialists to consult, asks each one
 * something specific, lets them compare notes, writes the reply, and the reply is
 * checked against the clinical rules before the member sees it.
 *
 * This is the browser fallback. The real team runs on the agents service
 * (app/agents, agentsClient.js); this one runs when the service is off or fails, so
 * it routes among the SAME roster: Blood Work, Hormone & Thyroid, Medication &
 * Interactions, Lifestyle and the scope-limited General. Every specialist here reads
 * the same health record (buildHealthContext); what differs is the lens each one is
 * told to apply. The event contract is the service's, so the card draws either one.
 *
 * Every step is a real model call, and each one is reported as an event the moment
 * it happens, which is what the chat animates. Nothing here is a timer pretending to
 * be work. The only pacing is in the UI, which holds each step on screen long enough
 * to read.
 */
import { callAI, firstText, firstCitations } from "./api";
import { violatesForbiddenOutput, hasFunctionalConcern, detectUrgentPatterns, scrubForbidden, offendingSentences, FORBIDDEN_OUTPUT_RULES } from "./clinicalRules";
import { logSafetyEvent, logAgentRun } from "./careTeamLog";

// Routing, consults and the huddle are short, structured calls, so a fast model
// keeps the whole round inside the time a member will watch it. The Advocate's
// reply still goes to the main chat model (no web search).
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
 * The specialists the Advocate can call on: the agents service's roster
 * (agents/lib/team.mjs), so the fallback routes exactly where the service would.
 * `lens` is what makes each one think differently about the shared record. Hormone
 * & Thyroid carries both the male and female modules, so nobody is filtered by sex.
 */
export const SPECIALISTS = [
  { id: "bloodwork", label: "Blood Work", short: "Labs", icon: "TestTubeDiagonal", color: "#C2410C",
    lens: "labs: CBC, CMP, lipids and ApoB, A1c and fasting insulin, liver, kidney, iron, vitamins, hs-CRP; each value against the lab range on the report and the Thumbprint target, trends across draws, what to retest and when" },
  { id: "hormones", label: "Hormone & Thyroid", short: "Hormones", icon: "Flame", color: "#D97706",
    lens: "hormones and thyroid, male and female: perimenopause and menopause, testosterone, estradiol, SHBG, progesterone, TSH, free T4/T3 and antibodies; peptide education and FDA status only" },
  { id: "medications", label: "Medication & Interactions", short: "Meds", icon: "Pill", color: "#7C3AED",
    lens: "medications and supplements: interactions, timing, nutrient depletions caused by medications, labs a medication moves, pharmacogenomics when on file, and what to confirm with the prescriber (never a dose)" },
  { id: "genetics", label: "Genetics", short: "Genetics", icon: "Dna", color: "#9333EA",
    lens: "the DNA report on file, all of it: health and trait variants, longevity, nutrition and fitness markers, carrier status and pharmacogenomic markers; what each genotype means, how strong the evidence is, which labs show whether a variant is doing anything, and what a consumer test cannot rule out" },
  { id: "lifestyle", label: "Lifestyle", short: "Lifestyle", icon: "Salad", color: "#16A34A",
    lens: "nutrition, sleep, activity and training, wearable trends (HRV, resting heart rate, readiness) against their own baseline, stress, and check-in patterns" },
  { id: "general", label: "General", short: "General", icon: "Compass", color: "#475569", scoped: true,
    lens: "scope-limited: ONLY the preventive screening schedule from the record, how the app works, preparing for an appointment, and wellness questions the record already answers. Anything else (a rash, an injury, pain, a new symptom, a diagnosis question) it does not answer: it says \"Let's bring this to your clinician\" and names what to raise" },
];

/**
 * The browser team's old roster, retired when the fallback moved to the service's
 * roster. Kept only so a stored conversation that consulted one of them still draws
 * its card (stored turns replay through readTeam and look members up by id).
 * Never offered for routing.
 */
const RETIRED = [
  { id: "cardiology", label: "Cardiology", short: "Cardio", icon: "HeartPulse", color: "#DC2626" },
  { id: "endocrinology", label: "Endocrinology", short: "Hormones", icon: "Flame", color: "#D97706" },
  { id: "gynecology", label: "Gynecology", short: "Gyn", icon: "Flower2", color: "#DB2777" },
  { id: "urology", label: "Men's Health", short: "Men's", icon: "UserRound", color: "#2563EB" },
  { id: "audiology", label: "Audiology", short: "Hearing", icon: "Ear", color: "#0891B2" },
  { id: "pharmacy", label: "Pharmacist", short: "Pharmacist", icon: "Pill", color: "#7C3AED" },
  { id: "nutrition", label: "Nutrition", short: "Nutrition", icon: "Salad", color: "#16A34A" },
  { id: "sleep", label: "Sleep & Recovery", short: "Sleep", icon: "Moon", color: "#4F46E5" },
  { id: "gastro", label: "Gastroenterology", short: "Gut", icon: "Soup", color: "#A16207" },
  { id: "neurology", label: "Brain & Mood", short: "Brain", icon: "Brain", color: "#BE185D" },
  { id: "dermatology", label: "Dermatology", short: "Skin", icon: "Sparkles", color: "#E11D48" },
  { id: "ophthalmology", label: "Eye Health", short: "Eyes", icon: "Eye", color: "#0E7490" },
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
  hormones: "Hormones, thyroid and menopause",
  medications: "Medications, supplements, interactions",
  lifestyle: "Nutrition, sleep, training and recovery",
  general: "Screenings, appointments and the app; knows what's for your clinician",
};
for (const m of [ADVOCATE, SAFETY, ...SPECIALISTS, ...RETIRED]) m.tagline = TAGLINES[m.id] || "";

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
  hormones: "1659353888906-adb3e0041693",
  medications: "1770134223774-13b735e29201",
  lifestyle: "1643297654416-05795d62e39c",
  // Reuses the retired Audiology portrait: a new face, not a second copy of one on the team.
  general: "1622253692010-333f2da6031d",
};
export function photoUrl(id, px) {
  const photo = PHOTOS[id];
  return photo
    ? `https://images.unsplash.com/photo-${photo}?w=${px}&h=${px}&fit=facearea&facepad=3&q=70&auto=format`
    : null;
}

const BY_ID = Object.fromEntries([ADVOCATE, SAFETY, ...SPECIALISTS, ...RETIRED].map((m) => [m.id, m]));
export const member = (id) => BY_ID[id] || { id, label: id, short: id, icon: "Stethoscope", color: "#5B6470" };

const MAX_SPECIALISTS = 3;

// The words a hand-off to the clinician always carries, as on the service.
const CLINICIAN_LINE = "Let's bring this to your clinician.";
const CLINICIAN_RE = /bring this to your clinician/i;

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

Pick only the specialists THIS question needs: one for a narrow question, two or three when it crosses areas. A genetics or DNA report question → genetics (add medications only if the member takes something or asks about a drug). Screening schedule, how the app works, or preparing for an appointment → general. A question outside every clinical lens (a rash, an injury, pain, a new symptom, a diagnosis question) → general alone; do not stretch the closest specialist to cover it. For each, write the specific thing you want them to look at, phrased as a direct ask that names the member's actual markers, values, medications or symptoms where relevant (max 22 words). You are the member's own advocate speaking to a colleague on their behalf, so refer to them as "my member" (e.g. "Is my member's TSH trend…"), never "he", "she" or "the patient".

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

// General answers a short approved list and hands everything else to the clinician
// (agents/briefs/general). It also says which it did, which is what the routing log
// counts as a fallback.
const SCOPED_RULES = `
- You answer ONLY: the preventive screening schedule from the record, how the app works, preparing for an appointment, and wellness questions the record already answers. A question you are not sure is on that list is not on it.
- Anything else: do not answer it, guess a cause or name a condition. Your finding says "${CLINICIAN_LINE}" and names two to four specific things to raise.`;

async function consult({ spec, ask, question, healthContext }) {
  const system = `You are the ${spec.label} advocate on a member's care team. Your lens: ${spec.lens}.
The Healthcare Advocate is consulting you about the member's question. Answer the Advocate, not the member.

Rules:
- Ground everything in the member's record below. Quote specific values with their dates. If the record has nothing relevant to your lens, say so plainly and name what data would help.
- Describe patterns and possibilities, never a diagnosis. Never give a supplement or medication dose, and never say to start, stop or change a medication.
- Be brief: 2 to 3 sentences, max 70 words.
- The member can read this. Refer to them as "our member" (e.g. "our member's TSH"), never "he", "she", "this member" or "the patient".${spec.scoped ? SCOPED_RULES : ""}

Reply with JSON only:
{"headline":"your key point in max 9 words","finding":"your 2-3 sentence answer to the Advocate","flag":"ok|watch|urgent"${spec.scoped ? ',"scope":"in if you answered it from the approved list, out if you handed it to the clinician","topic":"2 to 4 words naming what the question was about"' : ""}}

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
    ...(spec.scoped ? { scope: ["in", "out"].includes(out.scope) ? out.scope : null, topic: clip(out.topic, 60) || null } : {}),
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

/**
 * The safety review every AI chat reply goes through before the member sees it,
 * whether it came from the care team or from a photo question.
 *
 * Deterministic, from Dr. Locker's clinical rules. The spec says the rules are
 * enforced at the output, not just asked for: a flagged reply gets up to two
 * rewrites, and anything that still breaks a rule is cut in code.
 *
 * @returns {Promise<{reply, clean, revised, scrubbed, problem, urgent}>}
 */
export async function safetyReview({ reply, question = "", healthData, cleanReply = (t) => t, onFlag, messageId = null }) {
  const urgent = detectUrgentPatterns({ healthData, messages: [{ role: "user", text: question }] })
    .filter((u) => u.kind !== "recheck");
  const functional = hasFunctionalConcern(healthData);
  const breaks = (text) => violatesForbiddenOutput(text, { hasFunctionalConcern: functional });
  let problem = breaks(reply);
  let revised = false;
  let scrubbed = false;
  // What the model first wrote that broke a rule, for the medical director's log.
  const found = problem ? { problem, excerpt: offendingSentences(reply, breaks) } : null;
  if (problem) onFlag?.(problem);
  for (let attempt = 0; problem && attempt < 2; attempt++) {
    try {
      const fix = await callAI({
        system: `You edit health guidance so it obeys the app's clinical rules. Keep the substance, structure and length, and change only what breaks a rule. Return the full corrected reply, nothing else.

${FORBIDDEN_OUTPUT_RULES}

For doses specifically: remove EVERY amount of a supplement or medication, including ranges and "commonly used" or "typical" doses (any number with IU, mcg, mg, g or units). Say what the supplement is for and that the member's prescriber sets the amount. Lab values with their units (e.g. "28 ng/mL") are fine and stay.`,
        messages: [{ role: "user", content: `Rule broken: ${problem}\n\nReply to correct:\n${reply}` }],
        model: TEAM_MODEL,
        maxTokens: 1600,
      });
      const fixed = cleanReply(firstText(fix));
      if (fixed) { reply = fixed; revised = true; }
    } catch (err) {
      console.error("safety revise", err);
      break;
    }
    problem = breaks(reply);
  }
  if (problem) {
    const cut = scrubForbidden(reply, breaks);
    if (cut !== reply) { reply = cut; revised = true; scrubbed = true; }
    problem = breaks(reply);
  }
  // Logged for the weekly medical-director review (careTeamLog.js), fire-and-forget.
  if (found) {
    logSafetyEvent({
      kind: scrubbed || problem ? "rule_scrub" : "rule_rewrite",
      rule: `${found.problem}${problem ? " (NOT cleared: still present in the reply sent)" : ""}`,
      excerpt: found.excerpt,
      question,
      messageId,
    });
  }
  // The browser does not skip the team on crisis language as the service does; the
  // 988 line is raised as urgent instead. Still logged, so the review sees every one.
  if (urgent.some((u) => u.id === "crisis")) {
    logSafetyEvent({ kind: "crisis", rule: "Crisis language in the question (browser: the 988 line was raised as urgent).", excerpt: question, question, messageId });
  }
  return {
    reply,
    clean: !problem,
    revised,
    scrubbed,
    problem,
    // Crisis language is surfaced as the action, not as a "finding" in the record.
    urgent: urgent.map((u) => (u.id === "crisis" ? "If you're thinking about harming yourself, call or text 988 now" : u.label)),
  };
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
 * @param {object}   opts.healthData
 * @param {string}   opts.chatModel       model for the Advocate's final reply
 * @param {Function} opts.cleanReply      the chat screen's markdown stripper
 * @param {Function} opts.onEvent         called with each event as it happens
 * @param {string}  [opts.messageId]      the stored question, for the logs
 * @returns {Promise<{reply, citations, events, routing}>}
 */
export async function runCareTeam({
  question, apiMessages, systemPrompt, healthContext, healthData, chatModel, cleanReply, onEvent, messageId = null,
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
  const plan = await route({ question, recentTurns, roster: SPECIALISTS, healthContext });
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

  // Who answered, for the routing log: the same shape the service writes.
  const general = findings.find((f) => f.id === "general");
  const routing = {
    specialists: plan.consult.map((c) => c.id),
    general: Boolean(plan.consult.some((c) => c.id === "general")),
    fallback: Boolean(general && (general.scope === "out" || (!general.scope && CLINICIAN_RE.test(general.finding || "")))),
    topic: general?.topic || null,
  };

  // 4. The Advocate writes the reply, with the team's findings in front of it.
  emit({ type: "draft_start" });
  const outOfScope = routing.fallback
    ? `\n\nOUT OF SCOPE: the General advocate found this question${routing.topic ? ` (${routing.topic})` : ""} is outside what this team answers. Open your reply with "${CLINICIAN_LINE}", then list what to raise with them from General's finding. Do not answer that part, guess a cause, or name a condition.`
    : "";
  const briefing = reporting.length
    ? `\n\nYOUR CARE TEAM'S FINDINGS (you are the Healthcare Advocate; you consulted these specialist advocates before answering. Build on them, credit them naturally where useful, e.g. "Blood Work flagged…", and resolve any disagreement):\n${reporting.map((f) => `- ${member(f.id).label}: ${f.finding}`).join("\n")}${consensus ? `\nTeam consensus: ${consensus}` : ""}${outOfScope}`
    : "";
  const data = await callAI({
    system: systemPrompt + briefing,
    messages: apiMessages,
    model: chatModel,
    maxTokens: 1200,
    // No live web search for health answers (Adam Locker, Oct 19 2026): the record
    // and established guidelines only, the same as the agents service.
    webSearch: false,
  });
  let reply = cleanReply(firstText(data, "I couldn't generate a response."));
  const citations = firstCitations(data);
  emit({ type: "draft_done", sources: citations.length });

  // 5. Safety review (shared with photo questions; see safetyReview).
  emit({ type: "safety_start" });
  const review = await safetyReview({
    reply, question, healthData, cleanReply, messageId,
    onFlag: (problem) => emit({ type: "safety_flag", problem }),
  });
  reply = review.reply;
  if (routing.fallback && !CLINICIAN_RE.test(reply)) reply = `**${CLINICIAN_LINE}**\n\n${reply}`;
  emit({
    type: "safety_done",
    clean: review.clean,
    revised: review.revised,
    scrubbed: review.scrubbed,
    urgent: review.urgent,
  });

  const seconds = Math.round((Date.now() - started) / 1000);
  emit({ type: "answer", seconds });
  logAgentRun({ question, ...routing, seconds, messageId });
  return { reply, citations, events, routing };
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
    // The agents service calls its specialists all at once; the browser team calls
    // them one after another. The card draws whichever actually happened.
    parallel: false,
    consults: [],            // [{id, ask, state: working|done, headline, finding, flag}]
    lastReported: null,      // the specialist whose report landed most recently
    huddle: null,            // {ids, notes: [], consensus, done}
    draft: null,             // {done, research, sources, passages}
    safety: null,            // {done, clean, revised, problem, revising, urgent}
    active: "advocate",      // who is speaking right now (null while several work at once)
    done: false,
    seconds: null,
  };
  const working = () => view.consults.filter((c) => c.state === "working");
  for (const e of events) {
    switch (e.type) {
      case "route_start": view.routing = true; view.active = "advocate"; break;
      case "route_done":
        view.routing = false; view.reason = e.reason; view.plan = e.consult || []; view.parallel = Boolean(e.parallel); break;
      case "specialist_start":
        view.stage = "consult";
        view.consults.push({ id: e.id, ask: e.ask, state: "working" });
        view.active = view.parallel ? null : e.id;
        break;
      case "specialist_done": {
        const c = [...view.consults].reverse().find((x) => x.id === e.id);
        if (c) Object.assign(c, { state: "done", headline: e.headline, finding: e.finding, flag: e.flag, failed: e.failed });
        view.lastReported = e.id;
        // In parallel, the baton rests on whoever just reported until the next one does.
        if (view.parallel) view.active = working().length ? null : e.id;
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
      case "draft_start":
        view.stage = "draft"; view.active = "advocate";
        // Older stored turns carry no flag; they came from the browser team, which researches live.
        view.draft = { done: false, research: e.research !== false }; break;
      case "draft_done": if (view.draft) Object.assign(view.draft, { done: true, sources: e.sources, passages: e.passages || 0 }); break;
      case "safety_start": view.stage = "safety"; view.active = "safety"; view.safety = { done: false }; break;
      case "safety_flag": if (view.safety) view.safety.problem = e.problem; break;
      case "revise_start": if (view.safety) { view.safety.revising = true; view.safety.sentBack = true; view.active = "advocate"; } break;
      case "revise_done": if (view.safety) { view.safety.revising = false; view.active = "safety"; } break;
      case "safety_done": if (view.safety) Object.assign(view.safety, { done: true, clean: e.clean, revised: e.revised, urgent: e.urgent || [] }); break;
      case "answer": view.stage = "done"; view.done = true; view.active = null; view.seconds = e.seconds; break;
      default: break;
    }
  }
  return view;
}

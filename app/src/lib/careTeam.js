/**
 * The care team as the chat card draws it: My Advocate, the Safety Review and the
 * specialists, with their names, icons, colours, taglines and portraits, and
 * `readTeam`, which turns the agents service's event stream into the card's state.
 *
 * The team itself runs only on the agents service (app/agents, agentsClient.js). The
 * browser copy of it was removed on Oct 21 2026: every recommendation the app shows
 * comes from the service, under its rules and checks, or isn't shown.
 */
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
  { id: "weight", label: "Weight", short: "Weight", icon: "Scale", color: "#0D9488" },
  { id: "metabolism", label: "Metabolism", short: "Metabolism", icon: "Activity", color: "#B45309" },
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
  weight: "Weight, body fat and weight-loss medication",
  metabolism: "Blood sugar, insulin, blood fats and blood pressure",
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
  // Reuses the retired Gastroenterology portrait, which no current member of the team wears.
  weight: "1622902046580-2b47f47f5471",
  // Reuses the retired Cardiology portrait.
  metabolism: "1612349317150-e413f6a5b16d",
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

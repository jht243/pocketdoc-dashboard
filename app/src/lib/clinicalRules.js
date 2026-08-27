/**
 * The AI Clinical Intelligence Engine rules, as code.
 *
 * Source: "AI Clinical Intelligence Engine — Rules & System Prompt Specification
 * v1.0" (Dr. Adam Locker, Aug 2026). This module is the single place that
 * specification lives, so the insight cards, the supplement suggestions and any
 * future physician summary all reason under the same rules instead of each
 * screen's prompt drifting on its own.
 *
 * Two halves, and the split matters:
 *
 *  - The RULE TEXT below is what the model is told. It governs how a finding is
 *    framed: three reference points, clusters before single values, trend before
 *    position, differential pathways, provenance.
 *
 *  - The FUNCTIONS below are what the model is not trusted with. Principle 1.1 of
 *    the spec is explicit that the diagnosis boundary is "enforced at the output
 *    level, not just in introductory language", and Section 7's urgency triggers
 *    are specific numbers that must fire whether or not a language model noticed
 *    them. So urgency detection is deterministic and runs on every snapshot, and
 *    forbidden output is caught after generation, not merely discouraged before it.
 *
 * Pure — no network, no Supabase, no DOM.
 */

/**
 * Section 10 of the spec: these values require sign-off by a licensed physician or
 * NP before member-facing deployment. Kept as data rather than a comment so the
 * gate is visible to whoever wires the review, and so nothing silently ships as
 * "reviewed" because a threshold looked reasonable.
 */
export const CLINICAL_REVIEW = {
  required: true,
  items: [
    "Section 7 urgency thresholds (URGENT_RULES below)",
    "Functional ranges cited in member-facing output (Rule 2.3)",
    "Rule 4.3 specialist routing triggers",
    "Rule 5.2 wearable-to-lab domain pairings",
    "Rule 4.2 PGx flag persistence",
  ],
  reviewedBy: null,
  reviewedAt: null,
};

/* ==================================================================== */
/* RULE TEXT — what the model is told                                    */
/* ==================================================================== */

/**
 * Sections 1–5 and 8 of the spec, compressed to the parts that change what a
 * generated card actually says.
 *
 * The previous prompt asked for "short, specific, plain-language insight cards"
 * and forbade inventing values. That produced cards that were true but thin: a
 * single flagged marker restated with a reassuring sentence. Every rule here
 * exists to move output from restating a value to interpreting a pattern.
 */
export const CLINICAL_ANALYSIS_RULES = `HOW YOU ANALYSE (these rules govern every card you write)

1. PATTERNS, NEVER DIAGNOSES.
   You identify what a data pattern resembles and what it raises as a question. You never tell the member what they have.
   Write: "This pattern is consistent with several possibilities — most likely X, because [specific data point]. Here is what to bring to your doctor."
   Never write: "Your results indicate you have X."

2. SYNTHESIS IS THE POINT.
   No single doctor sees this person's whole picture; you do. A card that connects domains — a lab trend against a wearable trend, a symptom against a marker, a genetic variant against a medication, an uploaded report against a new result — is worth more than three single-domain cards. A card that restates one flagged value and stops is a failure, not an insight.

3. THREE REFERENCE POINTS, ALWAYS.
   Every marker you mention is evaluated against all three, and you say which one you are using:
   (a) the laboratory reference range that came with the result,
   (b) the functional / optimal range that longevity and integrative medicine target, which is usually narrower,
   (c) the member's OWN history — direction of travel across their panels.
   A value inside the lab range that has moved toward the edge across three panels is a real finding. Say so. Never call a result "normal" on lab range alone when (b) or (c) disagree.

4. TREND BEATS POSITION.
   When more than one panel exists, every value is read against its trajectory before it is interpreted. Give the numbers and the dates: "from 64 in Apr 2025 to 118 in Jan 2026". A stable mildly-abnormal value is more reassuring than an in-range value falling fast; say which situation this is.

5. CLUSTERS BEFORE SINGLE VALUES.
   Look for the cluster first. Low ferritin + low B12 + high MCV is a pattern; each alone is noise. Name the physiological system (metabolic, lipid/cardiovascular, thyroid, sex hormones, nutrients, inflammation, liver, kidney, haematology, adrenal/HPA) and describe the cross-marker pattern before you discuss any individual number.

6. DIFFERENTIAL PATHWAYS, MOST-LIKELY FIRST.
   For a concerning cluster, give what it could represent ordered by likelihood given this member's full profile — never worst-case first, which only frightens. For the leading pathway say what single test or data point would confirm or rule it out, and give the member the words to ask for it.

7. DISCLOSE DATA QUALITY AS INFORMATION, NOT AS A HEDGE.
   Bloodwork older than 6 months is stale and you say so before interpreting it. Bloodwork older than 12 months is historical context only and must never be the basis of a current finding. A wearable that has not synced in over 7 days is not usable as current data. Missing data is itself worth a card: name the panel or the refresh that would answer the open question.

8. CROSS-DOMAIN TREND DETECTION.
   On every pass, look explicitly for:
   - CONVERGENT signals — several domains moving the same concerning way at once. These are your highest-value cards.
   - DISCORDANT signals — the member reporting improvement while objective data declines, or the reverse. Name the discordance directly; it is a finding, not a contradiction to smooth over.
   - Known pairings worth checking: HRV decline with raised hs-CRP or cortisol; deep-sleep loss with rising fasting glucose or insulin; resting-HR rise with low ferritin or haemoglobin; longer sleep latency with raised TSH or low free T3; falling activity with low testosterone or DHEA-S.

9. WHAT THE MEMBER TOLD YOU IS DATA.
   Symptoms, home blood-pressure readings, mood, energy, and anything said in conversation are longitudinal data points, not chat. Weight them by how often they recur. Cross-reference every reported symptom against labs, wearable trends, genetics and documents before you write about it — surface the multi-domain picture, not the first matching thread. Label these clearly as member-reported so they are never confused with a measured result.

10. GENETICS IS CONTEXT, NEVER AN ACTION.
    A variant explains or reframes other data. It never by itself justifies a supplement or an intervention. Correct: "Your MTHFR C677T variant may reduce folate conversion, which is relevant context for your homocysteine of 14.2." Incorrect, always: going straight from a variant to a product or a dose.

11. PHARMACOGENOMICS OUTRANKS EVERYTHING MEDICATION-ADJACENT.
    If PGx data exists, check it before writing anything that touches a drug — prescription, OTC or under consideration. Disclose the conflict first, explain the mechanism in plain language, and give the member specific words for their prescriber. Never tell anyone to stop, start or change a medication.

12. FOOD SENSITIVITY IS A HYPOTHESIS.
    IgG panels measure exposure, not clinical reactivity. Frame a positive as something to test with a structured elimination trial alongside a matching symptom. Never tell a member they cannot eat a food.

13. WEARABLES ARE TRENDS, NOT STATUS.
    One night's HRV is noise. Interpret 7-, 30- and 90-day direction and flag directional change, not point values. A member with a wearable and nothing else still gets real findings: each metric read against their OWN rolling baseline is a comparison, and it is enough.

14. WORK WITH WHAT THEY HAVE.
   These rules describe the fullest picture, not a minimum bar. A member with one uploaded document, or one lab panel, or only a connected ring gets a real suggestion on day one — you narrow the claim, you never withhold the card. With a single panel, read its markers against each other and against the functional ranges. With a single document, read what it actually says. With a wearable only, read each metric against that person's own baseline. Never imply a trend you cannot see, never reference a domain that is not on file, and name the ONE thing worth adding next rather than listing everything absent.`;

/**
 * Section 9. Stated to the model, and separately enforced by
 * `violatesForbiddenOutput` on the way back.
 */
export const FORBIDDEN_OUTPUT_RULES = `NEVER WRITE ANY OF THESE, however the data looks:
- "You have [condition]" or any other diagnosis phrasing.
- "Your results are normal" when the value sits in the lab range but the functional range or the trend says otherwise.
- "Nothing to worry about" as reassurance when the data warrants attention.
- "Just talk to your doctor" as the whole answer. Always say what to raise and why.
- Any interpretation built on data more than 12 months old presented as current.
- A supplement or medication DOSE ("take 5,000 IU of D3"). You may describe what a class of supplement is for; you never prescribe an amount.
- Any instruction to start, stop or change a medication.
- A genetic variant leading directly to a product recommendation with no biomarker behind it.
- "This is not medical advice" bolted onto a thin answer. The disclaimer does not make a lazy card acceptable.`;

/**
 * The urgency contract, stated to the model. The deterministic detector below is
 * the backstop; this is what makes the model's own wording behave when it is the
 * one that spotted the pattern.
 */
export const URGENCY_RULES = `URGENCY OVERRIDES EVERYTHING.
If the data shows a pattern that needs evaluation today rather than at the next appointment, that is the only thing you write about. It goes first, it is never softened with "this may be nothing", and it is never listed among other topics. Tell the member plainly to contact their doctor's office now, or to go to urgent care or an emergency department if they cannot reach them.`;

/* ==================================================================== */
/* SECTION 7 — deterministic urgency detection                           */
/* ==================================================================== */

/**
 * Whole-token marker matching, mirroring the bloodwork scorer's approach: a naive
 * substring match makes "non-HDL cholesterol" answer to "hdl", and here the cost of
 * a mismatched marker is a false emergency message.
 */
function normalizeName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9()\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function matchesAlias(normalized, aliases) {
  return aliases.some((alias) => {
    const a = normalizeName(alias);
    if (normalized === a) return true;
    const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s|\\()${escaped}($|\\s|\\))`).test(normalized);
  });
}

function toNumber(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Sortable draw date. `date` is a display string ("Jun 2026") and sorts wrongly as text. */
const measuredOn = (lab) => String(lab?.drawnOn || lab?.created_at || lab?.date || "");

/** Most recent row for a marker, with its numeric value. */
function latestLab(labs, aliases) {
  const rows = (labs || [])
    .filter((l) => matchesAlias(normalizeName(l.name), aliases))
    .sort((a, b) => measuredOn(b).localeCompare(measuredOn(a)));
  for (const lab of rows) {
    const value = toNumber(lab.value);
    if (value != null) return { lab, value };
  }
  return null;
}

/** Upper bound the lab itself published, e.g. "0.5-4.5" or "<40". */
function rangeUpper(range) {
  const text = String(range || "");
  const span = text.match(/(-?\d+(?:\.\d+)?)\s*[-–—to]+\s*(-?\d+(?:\.\d+)?)/i);
  if (span) return Number(span[2]);
  const under = text.match(/[<≤]\s*(-?\d+(?:\.\d+)?)/);
  if (under) return Number(under[1]);
  return null;
}

/**
 * Cell counts arrive either as K/uL (platelets 150–400) or absolute (150,000–
 * 400,000) depending on the lab. Normalising to K/uL before comparing keeps a
 * normal 250,000 platelet count from reading as catastrophically high.
 */
function toThousands(value) {
  return value > 2000 ? value / 1000 : value;
}

/**
 * Section 7.1, as executable rules.
 *
 * PENDING CLINICAL SIGN-OFF (see CLINICAL_REVIEW). Every threshold here is quoted
 * from the specification and must be confirmed by the reviewing clinician before
 * these messages reach a member.
 *
 * Each rule returns null when it does not fire, or a message when it does. Rules
 * are deliberately conservative about units: where a value could plausibly be in
 * another unit system, the rule either normalises it or declines to fire.
 */
const URGENT_RULES = [
  {
    id: "potassium",
    aliases: ["potassium", "k", "serum potassium"],
    test: (v) => (v < 3.0 || v > 6.0) && v < 15 ? `Your potassium is ${v} mEq/L` : null,
  },
  {
    id: "sodium",
    aliases: ["sodium", "na", "serum sodium"],
    test: (v) => (v < 125 || v > 155) && v > 80 ? `Your sodium is ${v} mEq/L` : null,
  },
  {
    id: "troponin",
    aliases: ["troponin", "troponin i", "troponin t", "hs-troponin", "high sensitivity troponin"],
    // "Elevation of any level" — so this needs the lab's own ceiling, not a constant.
    test: (v, lab) => {
      const upper = rangeUpper(lab.range);
      if (upper == null) return lab.status && lab.status !== "normal" && lab.status !== "unknown"
        ? `Your troponin result is flagged above range`
        : null;
      return v > upper ? `Your troponin is ${v}${lab.unit ? " " + lab.unit : ""}, above the lab's upper limit of ${upper}` : null;
    },
  },
  {
    id: "glucose",
    aliases: ["glucose", "fasting glucose", "blood glucose", "fasting blood glucose", "fbg"],
    test: (v) => (v > 400 && v < 2000 ? `Your fasting glucose is ${v} mg/dL` : null),
  },
  {
    id: "hba1c",
    aliases: ["hba1c", "hemoglobin a1c", "haemoglobin a1c", "a1c", "hgb a1c"],
    test: (v) => (v > 10 && v < 25 ? `Your HbA1c is ${v}%` : null),
  },
  {
    id: "egfr",
    aliases: ["egfr", "gfr", "estimated gfr", "egfr creat"],
    test: (v) => (v < 20 && v > 0 ? `Your eGFR is ${v} mL/min/1.73m²` : null),
  },
  {
    id: "alt",
    aliases: ["alt", "alt (sgpt)", "sgpt", "alanine aminotransferase"],
    test: (v, lab) => {
      const uln = rangeUpper(lab.range) || 40;
      return v > uln * 10 ? `Your ALT is ${v}${lab.unit ? " " + lab.unit : " U/L"}, more than ten times the upper limit of normal` : null;
    },
  },
  {
    id: "ast",
    aliases: ["ast", "ast (sgot)", "sgot", "aspartate aminotransferase"],
    test: (v, lab) => {
      const uln = rangeUpper(lab.range) || 40;
      return v > uln * 10 ? `Your AST is ${v}${lab.unit ? " " + lab.unit : " U/L"}, more than ten times the upper limit of normal` : null;
    },
  },
  {
    id: "hemoglobin",
    aliases: ["hemoglobin", "haemoglobin", "hgb", "hb"],
    test: (v) => (v < 7.0 && v > 1 ? `Your haemoglobin is ${v} g/dL` : null),
  },
  {
    id: "platelets",
    aliases: ["platelets", "platelet count", "plt"],
    test: (v) => {
      const k = toThousands(v);
      if (k < 50 && k > 0) return `Your platelet count is ${v}`;
      if (k > 1000) return `Your platelet count is ${v}`;
      return null;
    },
  },
  {
    id: "wbc",
    aliases: ["wbc", "white blood cell count", "white blood cells", "leukocytes"],
    test: (v) => (toThousands(v) > 30 ? `Your white blood cell count is ${v}` : null),
  },
  {
    id: "calcium",
    aliases: ["calcium", "serum calcium", "total calcium"],
    test: (v) => (v > 12 && v < 30 ? `Your calcium is ${v} mg/dL` : null),
  },
];

/**
 * TSH above 10 mIU/L is urgent per the spec ONLY with symptoms, so it is checked
 * separately against what the member has actually reported rather than sitting in
 * the unconditional table above.
 */
const TSH_SYMPTOMS = ["fatigue", "cold", "weight gain", "brain fog", "depress", "hair loss", "constipat"];

/**
 * Phrases that indicate an active mental-health crisis (Section 7.1, final bullet).
 *
 * Deliberately narrow and literal. Loose matching turns "this commute is killing
 * me" into a crisis escalation, which teaches members that the safety message is
 * noise — the worst possible outcome for the one message that must be believed.
 */
const CRISIS_PHRASES = [
  "kill myself", "killing myself", "end my life", "ending my life", "take my own life",
  "suicidal", "suicide", "want to die", "wish i were dead", "wish i was dead",
  "better off dead", "no reason to live", "hurt myself", "harm myself", "self-harm",
  "hurt someone", "harm someone",
];

/**
 * Rule 5.3 / Section 7.1: a resting heart rate over 120 bpm sustained on the
 * wearable for more than 48 hours. Two consecutive synced days above the threshold
 * is the shortest run that qualifies; a single spike is explicitly not a finding.
 */
function sustainedTachycardia(history = []) {
  const recent = history.slice(0, 3).filter((r) => r?.resting_hr != null);
  if (recent.length < 2) return null;
  const run = recent.slice(0, 2);
  if (!run.every((r) => Number(r.resting_hr) > 120)) return null;
  return `Your resting heart rate has stayed above 120 bpm for more than 48 hours (${run.map((r) => Math.round(Number(r.resting_hr))).join(" and ")} bpm)`;
}

const ACT_NOW =
  "Please contact your doctor's office now. If you cannot reach them, go to an urgent care centre or an emergency department.";

/**
 * Every Section 7 pattern present in this snapshot.
 *
 * Runs before the model does and independently of it. If the model misses a
 * potassium of 6.4 — or writes a calm card about sleep instead — the member still
 * sees the escalation, because this function found it in the numbers.
 *
 * @param {object}   opts
 * @param {object}   opts.healthData
 * @param {Array}    [opts.messages]  conversation history, for the crisis check
 * @returns {Array<{id, label, message, source}>} empty when nothing qualifies
 */
export function detectUrgentPatterns({ healthData, messages = [] } = {}) {
  const found = [];
  const labs = healthData?.labs || [];

  for (const rule of URGENT_RULES) {
    const hit = latestLab(labs, rule.aliases);
    if (!hit) continue;
    const message = rule.test(hit.value, hit.lab);
    if (!message) continue;
    found.push({
      id: rule.id,
      label: hit.lab.name,
      message: `${message} — a level that needs evaluation today, not at your next appointment. ${ACT_NOW}`,
      source: `${hit.lab.name} ${hit.lab.value}${hit.lab.unit ? " " + hit.lab.unit : ""}${hit.lab.date ? `, ${hit.lab.date}` : ""}`,
    });
  }

  // TSH — urgent only alongside a matching reported symptom.
  const tsh = latestLab(labs, ["tsh", "thyroid stimulating hormone", "thyrotropin"]);
  if (tsh && tsh.value > 10 && tsh.value < 200) {
    const reported = [
      ...(healthData?.today?.recentSymptoms || []),
      ...(healthData?.symptoms || []),
    ].map((s) => String(s).toLowerCase());
    const match = reported.find((s) => TSH_SYMPTOMS.some((k) => s.includes(k)));
    if (match) {
      found.push({
        id: "tsh",
        label: "TSH",
        message: `Your TSH is ${tsh.value} mIU/L alongside reported ${match} — that combination needs evaluation now rather than at your next appointment. ${ACT_NOW}`,
        source: `TSH ${tsh.lab.value}${tsh.lab.unit ? " " + tsh.lab.unit : ""}${tsh.lab.date ? `, ${tsh.lab.date}` : ""}; symptom reported: ${match}`,
      });
    }
  }

  const tachy = sustainedTachycardia(healthData?.history);
  if (tachy) {
    found.push({
      id: "resting_hr",
      label: "Resting heart rate",
      message: `${tachy}. That needs evaluation today rather than at your next appointment. ${ACT_NOW}`,
      source: "Wearable resting heart rate, last two synced days",
    });
  }

  // Crisis language in the member's own messages only — never in the AI's replies,
  // which quote the member's words back and would otherwise re-trigger forever.
  const recentMember = (messages || []).filter((m) => m?.role === "user").slice(-25);
  const crisis = recentMember.some((m) => {
    const text = String(m.text || "").toLowerCase();
    return CRISIS_PHRASES.some((p) => text.includes(p));
  });
  if (crisis) {
    found.unshift({
      id: "crisis",
      label: "Support available now",
      message:
        "You have said something in this app that suggests you may be thinking about harming yourself. Please talk to someone now: call or text 988 (Suicide & Crisis Lifeline, US) or go to your nearest emergency department. If you are outside the US, your local emergency number will connect you to help.",
      source: "Something you wrote in your conversation here",
    });
  }

  return found;
}

/* ==================================================================== */
/* RULE 2.6 / 5.3 — data freshness                                       */
/* ==================================================================== */

const DAY = 24 * 60 * 60 * 1000;

/** A draw date we can do arithmetic on. Display strings like "Jun 2026" parse fine. */
function parseDate(lab) {
  const raw = lab?.drawnOn || lab?.created_at || lab?.date;
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/**
 * How old this member's data is, in the terms the spec uses.
 *
 * Fed to the model as fact rather than left for it to work out from dates, because
 * "stale" and "historical only" are rules with consequences (Rule 2.6 bars a
 * 12-month-old panel from being the basis of a current finding) and a model
 * re-deriving them from a display string like "Mar 2025" gets it wrong.
 */
export function dataFreshness(healthData) {
  const labs = healthData?.labs || [];
  const newest = labs.map(parseDate).filter(Boolean).sort((a, b) => b - a)[0] || null;
  const labAgeDays = newest ? Math.round((Date.now() - newest) / DAY) : null;

  const wearableDay = healthData?.history?.[0]?.day || healthData?.today?.day || null;
  const wearableT = wearableDay ? Date.parse(wearableDay) : NaN;
  const wearableAgeDays = Number.isFinite(wearableT) ? Math.round((Date.now() - wearableT) / DAY) : null;

  const notes = [];
  if (labAgeDays == null) {
    notes.push("- No dated bloodwork on file. Nothing here can be interpreted against a lab result.");
  } else if (labAgeDays > 365) {
    notes.push(`- Bloodwork is ${Math.floor(labAgeDays / 30)} months old. HISTORICAL CONTEXT ONLY — it must not be the basis of any current finding. Say a refresh is needed.`);
  } else if (labAgeDays > 180) {
    notes.push(`- Bloodwork is ${Math.floor(labAgeDays / 30)} months old — STALE. Flag the age before interpreting it, and name the panel worth repeating.`);
  } else {
    notes.push(`- Most recent bloodwork is ${labAgeDays} days old — current.`);
  }

  if (wearableAgeDays == null) {
    notes.push("- No wearable connected. Wearable context is unavailable, not normal.");
  } else if (wearableAgeDays > 7) {
    notes.push(`- Wearable has not synced in ${wearableAgeDays} days. Do not use wearable data as current; prompt reconnection.`);
  }

  const panelCount = new Set(labs.map((l) => measuredOn(l)).filter(Boolean)).size;
  if (panelCount > 1) {
    notes.push(`- ${panelCount} dated panels on file — trend analysis is REQUIRED, not optional.`);
  } else if (panelCount === 1) {
    notes.push("- One panel on file, so no lab trend exists yet. Read the markers against each other within this panel; do not imply a trajectory you cannot see.");
  }
  // Zero panels gets no line here: the lab-age note above already said there is no
  // bloodwork, and "only one panel on file" stacked on top of it contradicted it.

  return {
    labAgeDays,
    wearableAgeDays,
    panelCount,
    stale: labAgeDays != null && labAgeDays > 180,
    historicalOnly: labAgeDays != null && labAgeDays > 365,
    wearableStale: wearableAgeDays != null && wearableAgeDays > 7,
    notes: notes.join("\n"),
  };
}

/* ==================================================================== */
/* DATA BREADTH — what this member actually has                          */
/* ==================================================================== */

/**
 * The domains this member has data in, and the one worth adding next.
 *
 * The specification is written for a member with all six domains on file, and
 * following it literally produces an engine that says nothing useful until someone
 * has uploaded several panels. Most members will never be that member: one connects
 * an Oura ring and nothing else, another uploads a single PDF from one appointment.
 * Both have to get a real suggestion on day one.
 *
 * So breadth is stated to the model as fact, and the rules bend to it. With one
 * domain the engine works inside that domain — markers against each other within a
 * single panel, a wearable metric against that person's own rolling baseline —
 * rather than withholding a card because there is nothing to cross-reference against.
 * Synthesis is the goal (Principle 1.2); it is not the entry fee.
 *
 * @returns {{ present: string[], missing: string[], count: number, summary: string }}
 */
export function availableDomains(healthData, messages = []) {
  const labs = healthData?.labs || [];
  const panels = new Set(labs.map((l) => measuredOn(l)).filter(Boolean)).size;
  const docs = (healthData?.records || []).filter((r) => r?.text).length;
  const wearableDays = (healthData?.history || []).length;
  const genes = (healthData?.genetics || []).length;
  const symptoms = [...(healthData?.today?.recentSymptoms || []), ...(healthData?.symptoms || [])].length;
  const memberTurns = (messages || []).filter((m) => m?.role === "user").length;

  const domains = [
    { key: "bloodwork", has: labs.length > 0, note: `${labs.length} markers across ${panels || 1} panel${panels === 1 ? "" : "s"}` },
    { key: "uploaded documents", has: docs > 0, note: `${docs} readable document${docs === 1 ? "" : "s"}` },
    { key: "wearable", has: wearableDays > 0, note: `${wearableDays} days of synced readings` },
    { key: "genetics", has: genes > 0, note: `${genes} markers` },
    { key: "reported symptoms", has: symptoms > 0, note: `${symptoms} logged` },
    { key: "conversation", has: memberTurns > 0, note: `${memberTurns} messages from the member` },
  ];

  const present = domains.filter((d) => d.has);
  const missing = domains.filter((d) => !d.has).map((d) => d.key);

  // The single most useful thing they could add next, given what they already have.
  // One concrete ask converts; a list of six missing domains reads as a rejection.
  const nextBest = !labs.length
    ? "a lab panel — it is the one domain that turns wearable and symptom patterns into something a doctor can act on"
    : panels < 2
      ? "a second lab panel, including an older one they may already have, so trends become readable"
      : !wearableDays
        ? "a connected wearable, so day-to-day recovery can be read against their labs"
        : !genes
          ? "a genetic report, for medication and methylation context"
          : null;

  const stance = present.length === 0
    ? "NO DATA ON FILE. Write no findings. The only honest card is one naming what they could add first."
    : present.length === 1
      ? "SINGLE-DOMAIN MEMBER. You cannot cross-reference, and you must not pretend to. Work inside the domain they have and still produce a specific, useful finding. Saying nothing because a second source is missing is a failure, not caution."
      : "Cross-reference across the domains they DO have. Never write as though a domain they lack were present.";

  return {
    present: present.map((d) => d.key),
    missing,
    count: present.length,
    summary: [
      present.length
        ? `This member has data in ${present.length} of 6 domains: ${present.map((d) => `${d.key} (${d.note})`).join(", ")}.`
        : "This member has no health data on file yet.",
      missing.length ? `Not on file: ${missing.join(", ")}.` : "All six domains are on file.",
      stance,
      nextBest ? `The most valuable thing they could add next is ${nextBest}. Say so once, concretely, rather than listing everything they are missing.` : "",
    ].filter(Boolean).join("\n"),
  };
}

/* ==================================================================== */
/* SECTION 9 — output-level enforcement                                  */
/* ==================================================================== */

/**
 * Patterns that make a generated card unpublishable.
 *
 * Principle 1.1: the diagnosis boundary "is not semantic — it is the legal and
 * ethical boundary". A prompt instruction is a request; this is the boundary. A
 * card that trips any of these is dropped, and the screen falls back rather than
 * showing it.
 */

/**
 * What makes a sentence a diagnosis rather than a finding.
 *
 * "You have low ferritin at 22" reports a measured value and is allowed; "you have
 * Hashimoto's thyroiditis" names a disease and is not. The difference is the noun,
 * so the check looks for a condition — by the suffixes that mark one (-itis, -osis,
 * -emia, -opathy, -oma, -penia, -uria) plus the common conditions that don't carry
 * one. Matching on "you have" alone caught "you have logged fatigue twice this
 * month", which is exactly the member-reported cross-reference the rules ask for.
 */
const CONDITION = "(?:\\w+(?:itis|osis|emia|aemia|opathy|oma|uria|penia|paenia)\\b|(?:syndrome|disease|disorder|cancer|diabetes|prediabetes|hypothyroidism|hyperthyroidism|hypertension|depression|celiac|coeliac|copd|apnoea|apnea|insulin resistance|heart failure|hashimoto|graves)\\b)";

const FORBIDDEN = [
  { id: "diagnosis", re: new RegExp(`\\byou (?:have|'ve got|are diagnosed with|are suffering from)\\b[^.]{0,40}?${CONDITION}`, "i"),
    why: "diagnosis language" },
  { id: "diagnosis_state", re: /\byou are (?:diabetic|pre-?diabetic|hypothyroid|hyperthyroid|an(?:a)?emic|insulin[- ]resistant)\b/i,
    why: "diagnosis language" },
  { id: "diagnosis_results", re: /\b(?:results?|labs?|bloodwork|panel)\b[^.]{0,25}\b(?:indicate|show|confirm|mean)s?\b[^.]{0,30}\byou have\b/i,
    why: "diagnosis language" },
  { id: "reassurance", re: /\b(?:nothing to worry about|no cause for concern|don'?t worry)\b/i,
    why: "blanket reassurance" },
  { id: "just_see_doctor", re: /^(?:just |simply )?(?:talk to|consult|see|contact) your (?:doctor|physician|provider|clinician)\.?$/i,
    why: "\"just see your doctor\" with no substance" },
  // A dose attached to a supplement or drug. Units alone are fine — "30 ng/mL" is a
  // lab value — so this requires an amount adjacent to take/dose/daily language.
  { id: "dosing", re: /\b(?:take|taking|start|supplement(?:ing)? with|dose of)\b[^.]{0,40}\b\d[\d,.]*\s?(?:mg|mcg|µg|g|iu|ius|units?)\b/i,
    why: "a supplement or medication dose" },
  { id: "dosing_daily", re: /\b\d[\d,.]*\s?(?:mg|mcg|µg|iu|ius)\b[^.]{0,20}\b(?:daily|per day|a day|twice daily|bid|qd)\b/i,
    why: "a supplement or medication dose" },
  { id: "med_change", re: /\b(?:stop|discontinue|reduce|increase|switch off|come off)\b[^.]{0,30}\b(?:your |the )?(?:medication|prescription|dose|statin|metformin|ssri|beta.?blocker)\b/i,
    why: "an instruction to change a medication" },
  { id: "boilerplate", re: /\bthis is not medical advice\b/i,
    why: "boilerplate disclaimer" },
];

/**
 * "Your results are normal" is only forbidden when it is contradicted by the
 * functional range or the trend (Section 9, bullet 2) — which the caller knows and
 * this function does not. Passed in rather than guessed.
 */
const NORMAL_CLAIM = /\b(?:results?|labs?|levels?|values?|markers?|everything)\b[^.]{0,20}\b(?:are|is|look|looks|remain|remains)\b[^.]{0,10}\bnormal\b/i;

/**
 * @param {string} text            the card copy to check
 * @param {object} [opts]
 * @param {boolean} [opts.hasFunctionalConcern]  a marker is in lab range but outside
 *   the functional range, or is trending adversely — which makes "normal" a
 *   forbidden claim rather than a true one
 * @returns {string|null} why the text is unpublishable, or null when it is fine
 */
export function violatesForbiddenOutput(text, { hasFunctionalConcern = false } = {}) {
  const body = String(text || "");
  if (!body.trim()) return null;
  for (const rule of FORBIDDEN) {
    if (rule.re.test(body)) return rule.why;
  }
  if (hasFunctionalConcern && NORMAL_CLAIM.test(body)) {
    return "\"normal\" claimed while a marker is outside its functional range or trending adversely";
  }
  return null;
}

/**
 * Does this member have a marker that is inside the lab range but still a concern —
 * either outside the functional range the scorer uses, or moving the wrong way?
 *
 * This is what turns "your results are normal" from a true sentence into a
 * forbidden one, so it is computed from the scored data rather than inferred.
 */
export function hasFunctionalConcern(healthData) {
  const markers = healthData?.score?.bloodwork?.markers || [];
  // A marker the lab did not flag but the rubric placed in a sub-optimal band.
  const suboptimal = markers.some((m) => !m.excluded && m.max > 0 && m.points / m.max < 0.6);
  if (suboptimal) return true;

  // An adverse trend: three or more readings of the same marker moving one way.
  const byName = new Map();
  for (const lab of [...(healthData?.labs || [])].reverse()) {
    const key = normalizeName(lab.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    const v = toNumber(lab.value);
    if (v != null) byName.get(key).push(v);
  }
  for (const series of byName.values()) {
    if (series.length < 3) continue;
    const rising = series.every((v, i) => i === 0 || v > series[i - 1]);
    const falling = series.every((v, i) => i === 0 || v < series[i - 1]);
    if (rising || falling) return true;
  }
  return false;
}

/* ==================================================================== */
/* RULE 3.2 / 8.1 — conversation as data                                 */
/* ==================================================================== */

const MAX_CHAT_CHARS = 6000;

/**
 * The member's own words, as a data source rather than as chat.
 *
 * Rules 3.1–3.3 and 8.1 treat what someone says about how they feel as
 * longitudinal data to cross-reference against markers. Insight generation
 * previously ran blind to the conversation entirely, so a member could describe
 * three weeks of fatigue to the AI and get a card about their step count.
 *
 * Only member turns are included: the assistant's replies quote the member back,
 * and feeding them in doubles the apparent frequency of every symptom — which
 * matters because Rule 3.2 weights findings by how often they recur.
 */
export function conversationLines(messages = []) {
  const mine = (messages || []).filter((m) => m?.role === "user" && String(m.text || "").trim());
  if (!mine.length) return "";
  let budget = MAX_CHAT_CHARS;
  const lines = [];
  // Newest first so the most recent weeks survive the budget, then re-ordered
  // oldest-first for reading, since these are meant to show change over time.
  for (const m of [...mine].reverse()) {
    const when = m.createdAt ? String(m.createdAt).slice(0, 10) : "undated";
    const text = String(m.text).replace(/\s+/g, " ").trim().slice(0, 400);
    const line = `- ${when}: "${text}"`;
    if (line.length > budget) break;
    budget -= line.length;
    lines.push(line);
  }
  return lines.reverse().join("\n");
}

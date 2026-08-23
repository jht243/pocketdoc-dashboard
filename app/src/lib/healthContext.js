/**
 * Everything the app knows about the user, rendered as the AI's context block.
 *
 * One place builds this so a newly collected input can't reach a screen but miss
 * the chat. The rule here: if the user entered it or a device synced it, it goes
 * in. Questions are labelled from INTAKE_SECTIONS rather than hand-picked, so a
 * question added to the intake shows up in the prompt with no change here.
 *
 * Pure — no network, no Supabase, no DOM.
 */
import { INTAKE_SECTIONS, hiddenAnswerKeys, isBlankAnswer } from "./intakeContent";

/* ---------------- value formatting ---------------- */

function formatHeight(h) {
  if (h.unit === "metric") return h.cm ? `${h.cm} cm` : null;
  const parts = [h.feet ? `${h.feet} ft` : null, h.inches ? `${h.inches} in` : null].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/** Any answer value → a readable string, or null when there's nothing to say. */
export function formatAnswer(value) {
  if (isBlankAnswer(value)) return null;
  if (Array.isArray(value)) return value.map(formatAnswer).filter(Boolean).join(", ") || null;
  if (typeof value === "object") {
    // The two structured widgets: height (ft/in or cm) and dose (amount/unit/frequency).
    if ("feet" in value || "cm" in value) return formatHeight(value);
    if ("amount" in value) {
      return [value.amount, value.unit, value.frequency].filter(Boolean).join(" ") || null;
    }
    return Object.entries(value)
      .filter(([, v]) => !isBlankAnswer(v))
      .map(([k, v]) => `${k}: ${formatAnswer(v)}`)
      .join(", ") || null;
  }
  return String(value);
}

const bullet = (label, value) => {
  const text = formatAnswer(value);
  return text ? `- ${label}: ${text}` : null;
};

const section = (title, body) =>
  body && String(body).trim() ? `\n${title}\n${body}` : `\n${title}\n(none recorded)`;

/* ---------------- intake ---------------- */

/**
 * Every intake answer the user actually gave, grouped under its section heading
 * and labelled with the question it answered.
 *
 * Branch-hidden answers are dropped: if they later switched "on TRT" back to
 * "No", the stale dose that's still sitting in the blob would otherwise be fed
 * to the model as current fact. Deferred questions ("I'll add this later") are
 * reported as deferred rather than silently missing, so the AI can ask for them.
 */
export function intakeLines(intake = {}, profile = {}) {
  const hidden = new Set(hiddenAnswerKeys(intake, profile));
  const out = [];

  for (const sec of INTAKE_SECTIONS) {
    if (sec.showIf && !sec.showIf(intake, profile)) continue;
    const lines = [];
    for (const q of sec.questions) {
      if (q.type === "note" || hidden.has(q.id)) continue;
      if (intake[`${q.id}__remind`]) {
        lines.push(`- ${q.label}: (user deferred — not yet provided)`);
        continue;
      }
      const line = bullet(q.label, intake[q.id]);
      if (line) lines.push(line);
    }
    if (lines.length) out.push(`${sec.title}:\n${lines.join("\n")}`);
  }

  // Anything stored on the profile that no current question owns (legacy keys,
  // answers from a question since renamed) still belongs in the picture.
  const known = new Set(INTAKE_SECTIONS.flatMap((s) => s.questions.flatMap((q) => [q.id, `${q.id}__remind`])));
  const extras = Object.entries(intake)
    .filter(([k, v]) => !known.has(k) && k !== "medications" && !isBlankAnswer(v))
    .map(([k, v]) => bullet(k, v))
    .filter(Boolean);
  if (extras.length) out.push(`Other recorded answers:\n${extras.join("\n")}`);

  return out.join("\n\n");
}

/* ---------------- labs ---------------- */

function labLines(labs = []) {
  return labs
    .map((l) => {
      const detail = [
        l.status || "status n/a",
        // The lab's own reference range travels with the value: "TSH 4.2" is only
        // interpretable against the range the lab that ran it publishes.
        l.range ? `ref range ${l.range}` : null,
        l.date || null,
        l.source || null,
      ].filter(Boolean);
      return `- ${l.name}: ${l.value}${l.unit ? " " + l.unit : ""} (${detail.join(", ")})`;
    })
    .join("\n");
}

/* ---------------- uploaded documents ---------------- */

/**
 * How much document text the chat carries, and per document.
 *
 * Documents are the largest thing in this block by far, so they get a hard budget:
 * without one, a couple of long reports would push the user's labs, wearable trend
 * and medications out of the model's context window — losing the structured data to
 * make room for the unstructured.
 */
const MAX_DOC_CHARS = 9000;
const MAX_DOCS_TOTAL_CHARS = 20000;

/**
 * The uploaded documents themselves, transcribed, newest first.
 *
 * Previously this section listed file names only, so the model was told a longevity
 * report existed and nothing about what it said — and answered as if it had read it.
 * A document still being read, or one that failed to read, is labelled as such, so
 * the model can say "I can't see that file yet" instead of inventing its contents.
 */
export function documentLines(records = []) {
  let budget = MAX_DOCS_TOTAL_CHARS;
  return records
    .map((r) => {
      const head = `${r.name}${r.type ? ` (${r.type})` : ""}${r.uploadedAt ? `, uploaded ${String(r.uploadedAt).slice(0, 10)}` : ""}`;
      if (!r.text) {
        const why = r.textError
          ? `could not be read (${r.textError}) — you cannot see this file's contents`
          : "not yet transcribed — you cannot see this file's contents";
        return `- ${head}: ${why}`;
      }
      if (budget <= 0) {
        return `- ${head}: stored, but not included here — the older documents are omitted to leave room for the rest of this record`;
      }
      const slice = r.text.slice(0, Math.min(MAX_DOC_CHARS, budget));
      budget -= slice.length;
      const cut = slice.length < r.text.length ? "\n  [document continues — excerpt ends here]" : "";
      return `- ${head} — full text follows:\n"""\n${slice}${cut}\n"""`;
    })
    .join("\n\n");
}

/**
 * Multi-panel trends.
 *
 * Test mode ships a ready-made `labHistory`; live data is a flat marker list, so
 * derive the trend by grouping repeat measurements of the same marker. A single
 * reading is not a trend and is left out.
 */
export function labTrendLines(healthData) {
  if (healthData?.labHistory?.length) {
    return healthData.labHistory
      .map((s) => `- ${s.name}: ${(s.results || []).map((r) => `${r.value}${r.date ? " (" + r.date + ")" : ""}`).join(" → ")}${s.unit ? " " + s.unit : ""}`)
      .join("\n");
  }
  const byName = new Map();
  // `labs` arrives newest-first; reverse so each series reads oldest → newest.
  for (const lab of [...(healthData?.labs || [])].reverse()) {
    if (!byName.has(lab.name)) byName.set(lab.name, []);
    byName.get(lab.name).push(lab);
  }
  return [...byName.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([name, rows]) => `- ${name}: ${rows.map((r) => `${r.value}${r.date ? " (" + r.date + ")" : ""}`).join(" → ")}${rows[0].unit ? " " + rows[0].unit : ""}`)
    .join("\n");
}

/* ---------------- wearable ---------------- */

const MINUTE_FIELDS = new Set([
  "totalSleepMinutes", "timeInBedMinutes", "deepSleepMinutes", "remSleepMinutes",
  "awakeMinutes", "mediumActivityMinutes", "highActivityMinutes", "zone2Minutes",
]);

const TODAY_LABELS = {
  day: "Date of reading",
  readiness: "Readiness score",
  readinessTypical: "Readiness — typical for them",
  hrv: "HRV (ms)",
  hrvBaseline: "HRV baseline (ms)",
  restingHR: "Resting heart rate (bpm)",
  restingHRBaseline: "Resting HR baseline (bpm)",
  averageHR: "Average heart rate during sleep (bpm)",
  skinTempDeviation: "Skin temperature deviation (°C)",
  spo2: "Blood oxygen SpO₂ (%)",
  sleepScore: "Sleep score",
  sleepEfficiency: "Sleep efficiency (0-1)",
  totalSleepMinutes: "Total sleep",
  timeInBedMinutes: "Time in bed",
  deepSleepMinutes: "Deep sleep",
  remSleepMinutes: "REM sleep",
  awakeMinutes: "Awake during the night",
  activityScore: "Activity score",
  steps: "Steps",
  activeCalories: "Active calories (kcal)",
  mediumActivityMinutes: "Medium-intensity activity",
  highActivityMinutes: "High-intensity activity",
  zone2Minutes: "Active minutes (MET 4+)",
  zone2MinutesPlanned: "Active-minute daily target",
  strainYesterday: "Yesterday's training strain",
  recentSymptoms: "Recently logged symptoms",
};

function minutesText(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Today's reading — every synced field, not the three that fit on a card. */
export function wearableTodayLines(today) {
  if (!today) return "";
  return Object.entries(TODAY_LABELS)
    .map(([key, label]) => {
      const value = today[key];
      if (value == null || value === "") return null;
      if (Array.isArray(value)) return value.length ? `- ${label}: ${value.join(", ")}` : null;
      return `- ${label}: ${MINUTE_FIELDS.has(key) ? minutesText(Number(value)) : value}`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Each metric's latest value against its own trailing range — the real baseline. */
function metricRangeLines(metrics = []) {
  return metrics
    .map((m) => `- ${m.label}: now ${m.current ?? "n/a"} (their range over ${m.samples} days — low ${m.low}, typical ${m.typical}, high ${m.high})`)
    .join("\n");
}

/**
 * Recent raw days, so the model can see a run of bad nights rather than only the
 * latest reading. Capped: the whole loaded window would crowd out everything else.
 */
function wearableHistoryLines(history = [], days = 14) {
  return history
    .slice(0, days)
    .map((r) => {
      const bits = [
        r.readiness_score != null ? `readiness ${r.readiness_score}` : null,
        r.sleep_score != null ? `sleep ${r.sleep_score}` : null,
        r.total_sleep_minutes != null ? `slept ${minutesText(Number(r.total_sleep_minutes))}` : null,
        r.hrv_ms != null ? `HRV ${Math.round(Number(r.hrv_ms))}ms` : null,
        r.resting_hr != null ? `RHR ${Math.round(Number(r.resting_hr))}` : null,
        r.steps != null ? `${r.steps} steps` : null,
      ].filter(Boolean);
      return bits.length ? `- ${r.day}: ${bits.join(", ")}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

/* ---------------- wearable score ---------------- */

/**
 * The scored wearable picture: the number, how it was built, and how much history
 * stands behind it.
 *
 * The tier and the deviation matter more to the model than the raw value, because
 * they already carry the comparison the score is built on — "HRV 77ms" is a fact,
 * "HRV 19% below their own normal, Poor" is the finding. Confidence is included so
 * the model can hedge honestly when a member has only a few days of data instead of
 * speaking about a two-day "baseline" as if it were established.
 */
export function wearableScoreLines(score) {
  if (!score) return "";

  const metricLine = (m) => {
    const parts = [
      m.recorded ? `${m.value}${m.unit ? (m.unit === "%" ? "%" : ` ${m.unit}`) : ""}` : "not recorded",
      m.baseline != null ? `their usual ${m.baseline}` : "no baseline yet",
      m.deviationPct != null ? `${m.deviationPct > 0 ? "+" : ""}${m.deviationPct}% vs usual` : null,
      `tier ${m.tier}`,
      `${m.points}/${m.max} pts`,
      m.floorApplied ? `absolute clinical floor applied (below ${m.floorApplied.below})` : null,
    ].filter(Boolean);
    return `- ${m.label}: ${parts.join(", ")}`;
  };

  const alerts = (score.alerts || []).map((a) => `- ${a.label} (${a.severity}): ${a.message}`).join("\n");

  return [
    `- Wearable score: ${score.totalScore} of ${score.max} — ${score.label}`,
    `- Split: ${score.dailyScore}/${score.dailyMax} for today, ${score.trendScore}/${score.trendMax} for the 7-day trend`,
    `- Confidence: ${score.confidence.percent}% (${score.confidence.historyDays} days of baseline history). ${score.confidence.note}`,
    "",
    "Today, each metric against this person's OWN rolling baseline:",
    score.daily.map(metricLine).join("\n"),
    "",
    "Direction of travel — last 7 days vs their 20-day baseline:",
    score.trend.map(metricLine).join("\n"),
    alerts ? `\nClinical alerts raised by the scoring rubric:\n${alerts}` : "",
  ].filter(Boolean).join("\n");
}

/* ---------------- bloodwork score ---------------- */

/**
 * The scored bloodwork picture: which band each marker fell in and what the panel
 * doesn't cover.
 *
 * The gaps matter as much as the results here. Without them the model reads a
 * five-marker panel as a complete picture and reassures the user about
 * cardiovascular risk that nothing in the panel actually measured.
 */
export function bloodworkScoreLines(score) {
  if (!score) return "";
  if (!score.available) {
    return [
      `- Bloodwork is NOT scored: ${score.unavailableReason}`,
      score.markers?.length ? `- Markers on file anyway: ${score.markers.map((m) => `${m.label} ${m.value}${m.unit ? " " + m.unit : ""}`).join("; ")}` : null,
    ].filter(Boolean).join("\n");
  }

  const markerLine = (m) => m.excluded
    ? `- ${m.label}: ${m.value}${m.unit ? " " + m.unit : ""} — NOT scored (${m.note})`
    : `- ${m.label}: ${m.value}${m.unit ? " " + m.unit : ""}, band ${m.tier}, ${m.points}/${m.max} pts${m.measuredAt ? `, measured ${String(m.measuredAt).slice(0, 10)}` : ""}`;

  const alerts = (score.alerts || []).map((a) => `- ${a.label} (${a.severity}): ${a.message}`).join("\n");

  return [
    `- Bloodwork score: ${score.totalScore} of ${score.max} — ${score.label}`,
    `- Panel coverage: ${score.coverage.markers} scored markers, ${score.coverage.percent}% of the scoreable panel. ${score.recency.note}`,
    "",
    "Each marker against published clinical thresholds (NOT against their own baseline):",
    score.markers.map(markerLine).join("\n"),
    alerts ? `\nFlags raised by the bloodwork rubric:\n${alerts}` : "",
  ].filter(Boolean).join("\n");
}

/* ---------------- genetics ---------------- */

/**
 * Genetics arrive in two shapes: test mode puts plain strings here, a real import
 * puts rich marker objects. Render either, and for real markers give the model
 * everything the import captured — genotype and rsID included, so it can reason
 * about the variant rather than only repeat the report's summary.
 */
export function geneticLine(g) {
  if (typeof g === "string") return `- ${g}`;
  const head = [g.gene, g.variant, g.genotype ? `genotype ${g.genotype}` : null, g.rsid]
    .filter(Boolean)
    .join(" · ");
  const detail = [
    g.title,
    g.status && g.status !== "unknown" ? `status: ${g.status}` : null,
    g.impact ? `impact: ${g.impact}` : null,
    g.aiContext || g.what,
    g.notes,
    g.forYou?.length ? `suggested: ${g.forYou.join("; ")}` : null,
    g.medications?.length ? `medication relevance: ${g.medications.join("; ")}` : null,
    g.source ? `source: ${g.source}` : null,
  ].filter(Boolean);
  return `- ${head}${detail.length ? "\n    " + detail.join("\n    ") : ""}`;
}

/* ---------------- preventive care ---------------- */

/**
 * What screening this person is due for, and what they've already had.
 *
 * The AI is asked "what should I do next" constantly; without this it recommends
 * screenings the user completed last month. Items are keyed by `id` (the schedule's
 * own field) and a completion can be either `true` or the recorded date.
 */
function scheduleLines(schedule = [], completedItems = {}) {
  return schedule
    .map((item) => {
      const done = completedItems?.[item.id ?? item.key];
      const state = done
        ? `completed${typeof done === "string" ? ` ${done}` : ""}`
        : item.urgency || item.status || "due";
      const detail = [item.category, item.frequency, item.grade ? `USPSTF grade ${item.grade}` : null]
        .filter(Boolean)
        .join("; ");
      return `- ${item.name || item.title || item.id}: ${state}${detail ? ` — ${detail}` : ""}`;
    })
    .join("\n");
}

/* ---------------- the context block ---------------- */

/**
 * @param {object}  opts
 * @param {object}  opts.userProfile      { profile, intake, schedule, completedItems }
 * @param {object}  opts.healthData       labs / genetics / wearable / records / score
 * @param {object} [opts.healthHistory]   standalone Health History answers, when loaded
 * @param {boolean} [opts.testModeEnabled]
 * @returns {string} the block appended to the system prompt
 */
export function buildHealthContext({ userProfile, healthData, healthHistory, testModeEnabled }) {
  const profile = userProfile?.profile || {};
  const intake = userProfile?.intake || {};
  const today = healthData?.today;

  const age = profile.dob ? new Date().getFullYear() - new Date(profile.dob).getFullYear() : null;
  const identity = [
    bullet("Name", profile.name),
    age != null ? `- Age: ${age}` : null,
    bullet("Sex at birth / recorded sex", profile.sex),
    bullet("Height", intake.height),
    bullet("Current weight", intake.weight),
    profile.smoker ? "- Smoker: yes" : null,
    profile.familyEarlyHeartDisease ? "- Family history of early heart disease: yes" : null,
    profile.familyOrPersonalCancer ? "- Family or personal history of cancer: yes" : null,
    profile.diabetesOrPrediabetes ? "- Diabetes or prediabetes: yes" : null,
    bullet("Onboarding completed", userProfile?.onboardingCompletedAt),
  ].filter(Boolean).join("\n");

  const medLine = (m) =>
    typeof m === "string"
      ? `- ${m}`
      : `- ${[m.name, m.dose, m.frequency, m.prescriber ? `prescribed by ${m.prescriber}` : null, m.type].filter(Boolean).join(" — ")}`;
  // Fullest source first: the medications table rows (dose, frequency, prescriber,
  // type), then the test-mode snapshot, then the intake's name-only strings.
  const medSource = userProfile?.medicationsDetail?.length
    ? userProfile.medicationsDetail
    : healthData?.medications?.length
      ? healthData.medications
      : intake.medications || [];
  const meds = medSource.map(medLine).join("\n");

  const records = documentLines(healthData?.records || []);

  const body = healthData?.body
    ? Object.entries(healthData.body)
        .filter(([, v]) => !isBlankAnswer(v))
        .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(" → ") : v}`)
        .join("\n")
    : "";

  const scoreLines = healthData?.score
    ? [
        healthData.score.sleepScore != null ? `- Last night's sleep score (the device's own composite, not part of our score): ${healthData.score.sleepScore}${healthData.score.sleepNote ? ` (${healthData.score.sleepNote})` : ""}` : null,
        healthData.score.zone2Minutes != null ? `- Active minutes today: ${healthData.score.zone2Minutes}` : null,
        healthData.score.wakeupNote ? `- Morning check-in: ${healthData.score.wakeupNote}` : null,
      ].filter(Boolean).join("\n")
    : "";

  // The standalone Health History screen writes into the same profile blob the
  // intake uses, so it is normally already covered above. Included separately for
  // the test-mode snapshot, which carries its own copy.
  const historyExtra = healthHistory
    ? Object.entries(healthHistory)
        .filter(([, v]) => !isBlankAnswer(v))
        .map(([k, v]) => bullet(k, v))
        .filter(Boolean).join("\n")
    : "";

  return `DATA MODE: ${testModeEnabled ? "Seeded test snapshot — treat it exactly like real client data." : "Live client data — use only what's below; don't invent records."}

Everything the app has collected about this person follows. Treat "(none recorded)" as genuinely missing data worth asking about — never as a normal result.

SOURCE PRECEDENCE — for any marker that appears in more than one place, quote the MEASURED result, not the remembered one:
1. LAB RESULTS / LAB TRENDS / BLOODWORK SCORE below (values a lab actually ran).
2. UPLOADED RECORDS & DOCUMENTS (values you read out of the member's own report).
3. INTAKE QUESTIONNAIRE (what the member typed from memory at signup, often months old).
Numbers the member self-reported at intake are only worth citing when no lab result covers that marker — and when you do cite one, say it is self-reported. If a lab result and an intake answer disagree, the lab result is the fact and the difference is itself worth raising.
${section("USER PROFILE", identity)}
${section("INTAKE QUESTIONNAIRE (their own answers — SELF-REPORTED, may be out of date)", intakeLines(intake, profile))}
${section("MEDICATIONS & SUPPLEMENTS", meds)}
${section("LAB RESULTS (most recent)", labLines(healthData?.labs))}
${section("LAB TRENDS (repeat measurements over time)", labTrendLines(healthData))}
${section("WEARABLE SCORE (calculated from raw values vs their own baseline)", wearableScoreLines(healthData?.score?.wearable))}
${section("BLOODWORK SCORE (calculated from lab markers vs clinical thresholds)", bloodworkScoreLines(healthData?.score?.bloodwork))}
${section("WEARABLE — LATEST DAY (all synced metrics)", wearableTodayLines(today))}
${section("WEARABLE — EACH METRIC vs THEIR OWN RANGE", metricRangeLines(healthData?.metrics))}
${section("WEARABLE — RECENT DAYS", wearableHistoryLines(healthData?.history))}
${section("GENETICS", (healthData?.genetics || []).map(geneticLine).join("\n"))}
${section("PREVENTIVE CARE SCHEDULE", scheduleLines(userProfile?.schedule, userProfile?.completedItems))}
${section("BODY COMPOSITION", body)}
${section("UPLOADED RECORDS & DOCUMENTS (the member's own files, transcribed — read these, they are primary source material)", records)}
${section("DAILY SCORE INPUTS", scoreLines)}
${historyExtra ? section("HEALTH HISTORY (standalone questionnaire)", historyExtra) : ""}`;
}

/**
 * The four USPSTF screenings that are questionnaires, which the app can run itself.
 *
 *   depression  PHQ-2   (Kroenke, Spitzer & Williams 2003)        positive at 3+ of 6
 *   anxiety     GAD-2   (Kroenke et al. 2007)                      positive at 3+ of 6
 *   alcohol     AUDIT-C (Bush et al. 1998)                         positive at 4+ of 12 for men, 3+ for women
 *   drug_use    Single-question drug screen (Smith et al. 2010, NIDA)  positive at 1+ times
 *
 * The question and answer wording is the validated wording, word for word. Changing
 * it changes what the score means, so edit these only to fix a transcription error.
 *
 * Results are screens, not diagnoses. A positive screen means "worth raising with
 * your clinician", and that's all the app says about it.
 *
 * No imports, so the scoring can be unit tested in Node.
 */

const FREQUENCY_2_WEEKS = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

export const QUESTIONNAIRES = {
  phq2: {
    id: "phq2",
    scheduleId: "depression",
    name: "PHQ-2",
    title: "Mood check",
    intro: "Two questions about the last two weeks. Your answers are private to you.",
    stem: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
    questions: [
      { id: "interest", text: "Little interest or pleasure in doing things", options: FREQUENCY_2_WEEKS },
      { id: "down", text: "Feeling down, depressed, or hopeless", options: FREQUENCY_2_WEEKS },
    ],
    max: 6,
    positiveMessage:
      "Your answers suggest it's worth raising how you've been feeling with your clinician. A two-question check can't say what's behind it — it only flags when a fuller conversation would help.",
    negativeMessage: "Your answers don't point to anything that needs follow-up right now.",
  },
  gad2: {
    id: "gad2",
    scheduleId: "anxiety",
    name: "GAD-2",
    title: "Anxiety check",
    intro: "Two questions about the last two weeks. Your answers are private to you.",
    stem: "Over the last 2 weeks, how often have you been bothered by the following problems?",
    questions: [
      { id: "nervous", text: "Feeling nervous, anxious or on edge", options: FREQUENCY_2_WEEKS },
      { id: "worrying", text: "Not being able to stop or control worrying", options: FREQUENCY_2_WEEKS },
    ],
    max: 6,
    positiveMessage:
      "Your answers suggest it's worth raising worry and anxiety with your clinician. A two-question check can't say what's behind it — it only flags when a fuller conversation would help.",
    negativeMessage: "Your answers don't point to anything that needs follow-up right now.",
  },
  auditc: {
    id: "auditc",
    scheduleId: "alcohol",
    name: "AUDIT-C",
    title: "Alcohol check",
    intro: "Three questions about drinking. One standard drink is 12 oz of beer, 5 oz of wine, or 1.5 oz of spirits.",
    stem: null,
    questions: [
      {
        id: "frequency",
        text: "How often do you have a drink containing alcohol?",
        options: [
          { label: "Never", value: 0 },
          { label: "Monthly or less", value: 1 },
          { label: "2-4 times a month", value: 2 },
          { label: "2-3 times a week", value: 3 },
          { label: "4 or more times a week", value: 4 },
        ],
      },
      {
        id: "typical",
        text: "How many standard drinks containing alcohol do you have on a typical day?",
        options: [
          { label: "1 or 2", value: 0 },
          { label: "3 or 4", value: 1 },
          { label: "5 or 6", value: 2 },
          { label: "7 to 9", value: 3 },
          { label: "10 or more", value: 4 },
        ],
        // Someone who never drinks scores 0 on the rest; asking them is pointless.
        skipIf: (answers) => answers.frequency === 0,
      },
      {
        id: "sixOrMore",
        text: "How often do you have six or more drinks on one occasion?",
        options: [
          { label: "Never", value: 0 },
          { label: "Less than monthly", value: 1 },
          { label: "Monthly", value: 2 },
          { label: "Weekly", value: 3 },
          { label: "Daily or almost daily", value: 4 },
        ],
        skipIf: (answers) => answers.frequency === 0,
      },
    ],
    max: 12,
    positiveMessage:
      "Your answers are above the level where screening guidelines suggest talking drinking through with your clinician. That conversation is routine, and a brief one is often all that's needed.",
    negativeMessage: "Your answers are within the range screening guidelines consider lower risk.",
  },
  single_drug: {
    id: "single_drug",
    scheduleId: "drug_use",
    name: "Single-question drug screen",
    title: "Drug use check",
    intro: "One question. Your answer is private to you.",
    stem: null,
    questions: [
      {
        id: "times",
        text: "How many times in the past year have you used an illegal drug or used a prescription medication for non-medical reasons?",
        // The validated answer is a count; positive is any use at all. Buckets keep it
        // one tap on a phone, and each stores the lowest count it covers.
        options: [
          { label: "Never", value: 0 },
          { label: "Once", value: 1 },
          { label: "2 to 5 times", value: 2 },
          { label: "6 or more times", value: 6 },
        ],
      },
    ],
    max: null,
    positiveMessage:
      "Your answer is worth raising with your clinician. They can talk it through in confidence, and it helps them choose medications and tests safely.",
    negativeMessage: "Nothing here needs follow-up right now.",
  },
};

/** Which questionnaire runs a schedule item, if any. */
export const QUESTIONNAIRE_FOR_ITEM = Object.fromEntries(
  Object.values(QUESTIONNAIRES).map((q) => [q.scheduleId, q.id]),
);

/** The questions still to ask, given the answers so far (AUDIT-C skips two for non-drinkers). */
export function visibleQuestions(instrument, answers = {}) {
  const def = QUESTIONNAIRES[instrument];
  if (!def) return [];
  return def.questions.filter((q) => !(q.skipIf && q.skipIf(answers)));
}

/**
 * The positive-screen threshold. AUDIT-C is sex-specific (4 for men, 3 for women);
 * when sex isn't known the lower cut-off is used, so nobody is missed.
 */
export function cutoffFor(instrument, { sex } = {}) {
  switch (instrument) {
    case "phq2":
    case "gad2":
      return 3;
    case "auditc":
      return sex === "male" ? 4 : 3;
    case "single_drug":
      return 1;
    default:
      return null;
  }
}

/**
 * Score a completed questionnaire.
 *
 * @returns {{ complete: boolean, score: number|null, positive: boolean|null, cutoff: number|null }}
 *   `complete` is false while any visible question is unanswered; score and
 *   positive are null until then.
 */
export function scoreQuestionnaire(instrument, answers = {}, { sex } = {}) {
  const def = QUESTIONNAIRES[instrument];
  if (!def) return { complete: false, score: null, positive: null, cutoff: null };
  const shown = visibleQuestions(instrument, answers);
  const valid = (q) => q.options.some((o) => o.value === answers[q.id]);
  const complete = shown.every(valid);
  const cutoff = cutoffFor(instrument, { sex });
  if (!complete) return { complete: false, score: null, positive: null, cutoff };
  const score = shown.reduce((sum, q) => sum + answers[q.id], 0);
  return { complete: true, score, positive: score >= cutoff, cutoff };
}

/** One line for a positive or negative result, and whether to show the 988 line. */
export function resultMessage(instrument, result) {
  const def = QUESTIONNAIRES[instrument];
  if (!def || !result?.complete) return null;
  return {
    text: result.positive ? def.positiveMessage : def.negativeMessage,
    // Only a positive PHQ-2 carries the crisis line: it is the depression screen.
    show988: Boolean(result.positive && instrument === "phq2"),
  };
}

const SCREEN_FOR = { phq2: "depression screen", gad2: "anxiety screen", auditc: "alcohol-use screen", single_drug: "drug-use screen" };

/**
 * Completed in-app screening questionnaires, newest first: the score, whether it
 * crossed the validated cut-off, and each answer in the member's own words. A
 * positive screen is a reason to raise it with a clinician, never a diagnosis.
 */
export function questionnaireLines(rows = []) {
  return rows.slice(0, 12).map((r) => {
    const def = QUESTIONNAIRES[r.instrument];
    if (!def) return null;
    const max = def.max != null ? ` of ${def.max}` : "";
    const verdict = r.positive
      ? `POSITIVE screen (cut-off ${r.cutoff}): worth raising with their clinician`
      : `negative screen (cut-off ${r.cutoff})`;
    const answers = def.questions
      .filter((q) => r.answers && r.answers[q.id] != null)
      .map((q) => {
        const opt = q.options.find((o) => o.value === r.answers[q.id]);
        return `"${q.text}": ${opt ? opt.label : r.answers[q.id]}`;
      })
      .join("; ");
    // The drug screen's stored value is a count bucket, not a score worth quoting.
    const score = def.max != null ? `score ${r.score}${max}, ` : "";
    return `- ${r.completed_on} ${def.name} (${SCREEN_FOR[r.instrument] || def.title}; the member knows it as the "${def.title}"): ${score}${verdict}.${answers ? ` Answers: ${answers}.` : ""}`;
  }).filter(Boolean).join("\n");
}

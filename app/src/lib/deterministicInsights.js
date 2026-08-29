// These suggestions are intentionally deterministic. Each card is a transparent
// template tied to named data points, which keeps it repeatable and avoids
// presenting generated medical advice as a clinical conclusion.
//
// This is what the Records screen shows from the moment the first document is read
// until the AI card arrives — and what it keeps showing if the AI returns nothing
// or its card is dropped by the Section 9 filter. A member who has uploaded
// records must never be looking at the "upload something" locked box.

/** Section names the clinical spec uses (Rule 2.4), keyed by scoring panel. */
const SYSTEM_BY_PANEL = {
  cardiovascular: "Lipid / cardiovascular",
  metabolic: "Metabolic",
  inflammation: "Inflammation",
  organ: "Liver / kidney",
  nutrients: "Nutrients / thyroid",
};

// Worst first. `critical` and `poor` are findings on their own; `fair` is a
// functional-range finding — inside the lab's range, outside the optimal band —
// which Rule 1.3 treats as legitimate on a single panel.
const TIER_RANK = { critical: 0, poor: 1, fair: 2 };

function formatDate(value, opts = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return null;
  const date = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, opts);
}

const withUnit = (marker) => `${marker.value}${marker.unit ? ` ${marker.unit}` : ""}`;

/** "Ferritin 18 ng/mL (Mar 3, 2026)" — the value with the date it was measured. */
function markerPhrase(marker) {
  const on = formatDate(marker.measuredAt);
  return `${marker.label} ${withUnit(marker)}${on ? ` (${on})` : ""}`;
}

/**
 * Direction of travel for a marker, but only where more than one reading exists —
 * a single panel gets a value, never a trend.
 */
function trendFor(marker, labs = []) {
  const readings = labs
    .filter((lab) => String(lab.name || "").toLowerCase() === String(marker.label || "").toLowerCase())
    .filter((lab) => Number.isFinite(Number(lab.value)));
  if (readings.length < 2) return "";
  const earliest = readings[readings.length - 1];
  const on = formatDate(earliest.drawnOn || earliest.created_at, { month: "short", year: "numeric" });
  if (Number(earliest.value) === Number(marker.value)) return "";
  const direction = Number(marker.value) > Number(earliest.value) ? "up" : "down";
  return ` That is ${direction} from ${earliest.value}${earliest.unit ? ` ${earliest.unit}` : ""}${on ? ` in ${on}` : ""}.`;
}

/**
 * The strongest finding in the member's scored bloodwork.
 *
 * Pattern first, values second (Rule 2.4): where more than one marker in the same
 * system is off, the card is about the system, not about whichever marker happened
 * to score worst.
 */
function fromScoredMarkers(healthData) {
  const markers = (healthData?.score?.bloodwork?.markers || [])
    .filter((marker) => !marker.excluded && marker.tier && marker.tier in TIER_RANK);
  if (!markers.length) return null;

  const ranked = [...markers].sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
  const lead = ranked[0];
  const system = SYSTEM_BY_PANEL[lead.panel] || "Bloodwork";
  const cluster = ranked.filter((marker) => marker.panel === lead.panel).slice(0, 3);
  const labs = healthData?.labs || [];

  const body = cluster.length > 1
    ? `${cluster.length} markers in the same system are outside their optimal bands: ${cluster.map(markerPhrase).join(", ")}.${trendFor(lead, labs)} Read together they are worth raising as one question rather than as separate results.`
    : `${markerPhrase(lead)} sits outside the optimal band this app scores against.${trendFor(lead, labs)} It is worth reviewing alongside how you have been feeling.`;

  return {
    type: "bloodwork_pattern",
    system,
    title: `Worth a closer look: ${system.toLowerCase()}`,
    body,
    basis: `Scored against this app's clinical bands, not only the lab's reference range. ${cluster.map(markerPhrase).join("; ")}.`,
    doctorPath: `${cluster.length > 1 ? "Ask what these results mean together" : `Ask what your ${lead.label.toLowerCase()} means`} in the context of your symptoms and history, and whether a repeat or follow-up test is warranted.`,
    selfPayPath: `If you cannot get a follow-up through your clinician, a self-pay panel covering ${cluster.map((marker) => marker.label).join(" and ")} keeps the trend comparable — order it in the same units and review the results with a qualified clinician.`,
  };
}

/**
 * Anything the report itself flagged.
 *
 * The scorer only covers the markers in its rubric, so a panel full of results it
 * doesn't score would otherwise produce no card at all. The lab's own high/low flag
 * is a reference point in its own right.
 */
function fromFlaggedLabs(healthData) {
  const flagged = (healthData?.labs || []).filter((lab) => lab.status === "high" || lab.status === "low");
  if (!flagged.length) return null;

  const lead = flagged[0];
  const named = flagged.slice(0, 3);
  const list = named
    .map((lab) => `${lab.name} ${lab.value}${lab.unit ? ` ${lab.unit}` : ""}${lab.status === "high" ? " (high)" : " (low)"}${lab.date ? `, ${lab.date}` : ""}`)
    .join("; ");

  return {
    type: "flagged_results",
    system: "Bloodwork",
    title: named.length > 1 ? "Results your report flagged" : `Worth following up: ${lead.name}`,
    body: `Your uploaded results include ${named.length > 1 ? `${named.length} markers` : "a marker"} the report itself marked outside its reference range: ${list}. That flag is the lab's, not a diagnosis — what it means depends on your symptoms, medications and history.`,
    basis: `Reference range as printed on your own report. ${list}.`,
    doctorPath: `Ask what ${lead.name} at ${lead.value}${lead.unit ? ` ${lead.unit}` : ""} means for you specifically, and whether it needs repeating before anything is read into it.`,
    selfPayPath: `If a repeat is not available through your clinician, a self-pay test of the same marker in the same units keeps the two results comparable — then review them with a qualified clinician.`,
  };
}

/**
 * A document is on file but nothing numeric has come out of it yet — a report with
 * no parsed markers, or an extraction still running. The member has still given us
 * something, so the card says where things stand instead of asking again for what
 * they already uploaded.
 */
function fromDocuments(healthData) {
  const records = [...(healthData?.records || [])]
    .filter((record) => !record.textError)
    .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  if (!records.length) return null;
  const readable = records.filter((record) => record.text);
  const newest = records[0];

  return {
    type: "records_on_file",
    system: "Your records",
    title: readable.length ? "Reading across your records" : "Your records are being read",
    body: readable.length
      ? `${readable.length === 1 ? `${newest.name} has been read` : `${readable.length} of your uploaded documents have been read, the most recent being ${newest.name}`}. Nothing in ${readable.length === 1 ? "it" : "them"} crosses a threshold this app scores numerically — the fuller reading of the text itself arrives here shortly, and sharpens with each result you add.`
      : `${newest.name} is on file and still being read. Patterns appear here once the text has been extracted.`,
    basis: `${records.length} uploaded ${records.length === 1 ? "document" : "documents"} on file.`,
    doctorPath: "Bring the report itself to your next visit and ask which results your clinician wants repeated, and when.",
    selfPayPath: "If you are ordering your own tests, keep the same units and note the collection date so each new result stays comparable to this one.",
  };
}

function getRecordInsight(healthData) {
  const today = healthData?.today;
  const thyroid = healthData?.labHistory?.find((series) => series.name === "TPO antibodies");
  const tpoValues = thyroid?.results || [];
  const hasRisingTpo = tpoValues.length >= 3 && tpoValues.every((result, index) =>
    index === 0 || Number(result.value) > Number(tpoValues[index - 1].value)
  );
  const latestTpo = tpoValues.at(-1);
  const thyroidSymptoms = (today?.recentSymptoms || []).filter((symptom) =>
    ["fatigue", "cold sensitivity"].includes(symptom)
  );

  if (hasRisingTpo && Number(latestTpo?.value) >= 100 && thyroidSymptoms.length >= 2) {
    const firstTpo = tpoValues[0];
    return {
      type: "thyroid_pattern",
      system: "Thyroid",
      title: "Worth a closer look: thyroid pattern",
      body: `TPO antibodies rose from ${firstTpo.value} to ${latestTpo.value} ${thyroid.unit} across ${tpoValues.length} panels, while you also logged ${thyroidSymptoms.join(" and ")}. That combination is worth bringing to your next visit.`,
      basis: `Trend across ${tpoValues.length} panels, plus symptoms you logged yourself.`,
      doctorPath: "Ask whether a full thyroid antibody panel or an ultrasound referral makes sense in the context of your symptoms and trend.",
      selfPayPath: "If you cannot get testing through your clinician, compare self-pay thyroid antibody panels before ordering—then review the results with a qualified clinician.",
    };
  }

  const vitaminD = healthData?.labs?.find((lab) => lab.name === "Vitamin D");
  if (vitaminD && Number(vitaminD.value) < 30) {
    return {
      type: "vitamin_d",
      system: "Nutrients / thyroid",
      title: "Worth following up: Vitamin D",
      body: `Your latest Vitamin D result is ${vitaminD.value} ${vitaminD.unit}, which is below the 30 ng/mL threshold in wide clinical use. It is worth reviewing with your clinician alongside your symptoms and current supplements.`,
      basis: `Threshold 30 ng/mL. Vitamin D ${vitaminD.value} ${vitaminD.unit}${vitaminD.date ? `, ${vitaminD.date}` : ""}.`,
      doctorPath: "Ask what target range and re-test timing fit your situation.",
      selfPayPath: "Keep any self-pay follow-up results with the same units and collection date so the trend remains comparable.",
    };
  }

  // Ordered by how specific the finding is: scored bands, then the report's own
  // flags, then the fact that records exist at all.
  return fromScoredMarkers(healthData) || fromFlaggedLabs(healthData) || fromDocuments(healthData);
}

export { getRecordInsight };

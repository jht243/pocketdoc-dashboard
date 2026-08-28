// Traffic-light colour for a lab marker.
//
// The dot next to a value is the only signal most members read, so it has to mean
// what a traffic light means: green in range, amber borderline, red out of range by
// enough to act on. The old palette painted "normal" in the app's blue accent — the
// same blue used for links and buttons — which read as decoration rather than a
// verdict, and gave high and low the same amber.
//
// Severity comes from the reference range the lab itself printed, not from the
// extractor's `status` word: "high" says nothing about how high. Where no range
// parses we fall back to the status and deliberately stop at amber, because an
// out-of-range flag with no bound to measure against can't justify red.
import { COLORS } from "../theme/tokens";

const TONE_COLOR = {
  good: COLORS.good,
  warn: COLORS.warning,
  bad: COLORS.danger,
  unknown: COLORS.textMuted,
};

/** How far past a bound a value may sit and still count as borderline. */
const BORDERLINE_MARGIN = 0.2;

/**
 * Numeric value of a lab reading. "<3.0" and ">150" are censored results — the
 * true value is on the stated side of the bound, so the bound itself is the
 * closest honest number to compare with.
 */
function toNumber(raw) {
  if (raw == null) return null;
  const text = String(raw).replace(/,/g, "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lower/upper bounds from a printed range: "0.5-4.5", "0.5 – 4.5", "<40", "≥ 60".
 * Either side may be null when the lab only published one bound.
 */
function parseRange(range) {
  const text = String(range || "").trim();
  if (!text) return null;
  const span = text.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (span) return { low: Number(span[1]), high: Number(span[2]) };
  const under = text.match(/[<≤]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (under) return { low: null, high: Number(under[1]) };
  const over = text.match(/[>≥]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (over) return { low: Number(over[1]), high: null };
  return null;
}

/** How far outside a bound a value sits, as a fraction of that bound. */
function overshoot(value, bound) {
  const scale = Math.abs(bound) || 1;
  return Math.abs(value - bound) / scale;
}

/**
 * "good" | "warn" | "bad" | "unknown" for one marker.
 */
function labTone(marker) {
  const status = String(marker?.status || "").toLowerCase();
  const range = parseRange(marker?.range || marker?.ref_range);
  const value = toNumber(marker?.value);

  if (range && value != null) {
    if (range.high != null && value > range.high) {
      return overshoot(value, range.high) <= BORDERLINE_MARGIN ? "warn" : "bad";
    }
    if (range.low != null && value < range.low) {
      return overshoot(value, range.low) <= BORDERLINE_MARGIN ? "warn" : "bad";
    }
    return "good";
  }

  if (status === "normal" || status === "favorable") return "good";
  if (status === "low" || status === "high" || status === "watch" || status === "variant") return "warn";
  return "unknown";
}

/** The colour to paint that marker's dot, chip, or label. */
function labToneColor(marker) {
  return TONE_COLOR[labTone(marker)];
}

export { labTone, labToneColor, TONE_COLOR };

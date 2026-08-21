/**
 * Ranking and cleanup for the web-research citations the advocate cites.
 *
 * The persona asks the model for peer-reviewed research and clinical guidelines,
 * but the hosted search tool decides what it actually returns, and asking nicely
 * is not a control. A question about a drug's sexual side effects came back citing
 * `consumersadvisory.org` and `healthrx.com` — SEO content farms dressed as health
 * authorities. On a health product that is a credibility problem, so the ranking
 * here is deterministic: authoritative sources are surfaced first, and when none
 * exist the member is told the evidence is weak rather than shown a content farm
 * with the same styling a NEJM link would get.
 *
 * Deliberately a suffix allowlist rather than a blocklist of bad domains: content
 * farms are infinite and new ones appear constantly, while the set of institutions
 * that publish trustworthy medical evidence is small and stable.
 *
 * Pure — no network, no DOM.
 */

// Tier 1 — primary evidence and the bodies that set clinical practice: government
// agencies, universities, guideline issuers, and peer-reviewed journals.
const TIER_1 = [
  ".gov", ".edu", ".ac.uk", ".nhs.uk",
  "who.int", "europa.eu", "nice.org.uk", "cochrane.org", "cochranelibrary.com",
  "nejm.org", "jamanetwork.com", "thelancet.com", "bmj.com", "nature.com",
  "sciencedirect.com", "springer.com", "cell.com", "academic.oup.com",
  "wiley.com", "onlinelibrary.wiley.com", "plos.org", "annals.org",
  "ahajournals.org", "diabetesjournals.org", "frontiersin.org", "biomedcentral.com",
];

// Tier 2 — established medical organizations and professionally edited references.
// Not primary evidence, but accountable, reviewed, and safe to show a member.
const TIER_2 = [
  "mayoclinic.org", "clevelandclinic.org", "hopkinsmedicine.org", "stanfordhealthcare.org",
  "heart.org", "cancer.org", "diabetes.org", "endocrine.org", "thyroid.org",
  "aad.org", "acog.org", "aafp.org", "psychiatry.org", "kidney.org", "lung.org",
  "arthritis.org", "urologyhealth.org", "asrm.org",
  "uptodate.com", "merckmanuals.com", "medscape.com", "drugs.com", "examine.com",
];

/** Tracking noise the search tool appends; never useful, and it leaks the referrer. */
const TRACKING_PARAMS = /^(utm_|ref_?$|ref_src|fbclid|gclid|mc_[ce]id|igshid|_hs)/i;

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function matches(host, suffixes) {
  return suffixes.some((s) => (
    s.startsWith(".") ? host.endsWith(s) : host === s || host.endsWith(`.${s}`)
  ));
}

/** 1 = primary/guideline, 2 = established medical org, 3 = everything else. */
export function sourceTier(url) {
  const host = hostOf(url);
  if (!host) return 3;
  if (matches(host, TIER_1)) return 1;
  if (matches(host, TIER_2)) return 2;
  return 3;
}

/** Drop tracking params so the link the member opens is the article, nothing else. */
export function cleanUrl(url) {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Sort citations best-source-first and tag each with its tier and host.
 *
 * Weak sources are kept rather than dropped — that is the fallback the product
 * needs. A question with no .gov/.edu answer (a new supplement, a niche
 * interaction) should still show the member what the model actually read; it just
 * has to arrive labelled instead of disguised as authority.
 */
export function rankCitations(citations = []) {
  return citations
    .map((c) => {
      const url = cleanUrl(c.url);
      const host = hostOf(url);
      return { ...c, url, host, tier: sourceTier(url), title: c.title || host };
    })
    .sort((a, b) => a.tier - b.tier);
}

/**
 * The caveat to show above the source chips, or null when the sources speak for
 * themselves. Only fires when nothing authoritative was found — the honest signal
 * that the member should treat what follows as weaker than usual.
 */
export function sourceCaveat(citations = []) {
  if (!citations.length) return null;
  const best = Math.min(...citations.map((c) => c.tier ?? sourceTier(c.url)));
  if (best <= 2) return null;
  return "No guideline or peer-reviewed source was found for this. Treat the sources below as general reading, and confirm anything that matters with your clinician.";
}

/**
 * Which ongoing therapies the member's own record shows: testosterone (TRT) and
 * peptides. Read from the intake answers ("Are you currently using testosterone?",
 * the peptide question) and from every medication list the app holds.
 *
 * Screens use this to offer therapy-specific things, like the monitoring panels on
 * Order Labs, only to members who are actually on the therapy. Shown to everyone,
 * "Recommended for your therapies: TRT monitoring" read as personal advice to people
 * who have never taken testosterone.
 *
 * Pure — no network, no Supabase, no DOM.
 */
import { onTRT, onPeptides } from "./intakeContent";

const TRT = /\b(testosterone|trt|cypionate|enanthate|undecanoate|androgel|testim|jatenzo|xyosted|aveed|nebido|tlando|kyzatrex)\b/i;
// Growth-hormone-axis and repair peptides: the ones the peptide panel (IGF-1 among
// others) monitors. GLP-1 drugs are peptides too, but they are not what that panel
// is for, so they don't count here.
const PEPTIDE = /\b(peptides?|bpc-?157|tb-?500|thymosin|ghk-?cu|sermorelin|ipamorelin|cjc-?1295|tesamorelin|mots-?c|selank|semax|aod-?9604|hexarelin|ghrp-?[26]|mk-?677|ibutamoren|epitalon|kisspeptin|pt-?141)\b/i;

function medicationNames({ userProfile, healthData }) {
  const lists = [userProfile?.medicationsDetail, healthData?.medications, userProfile?.intake?.medications];
  return lists.flatMap((list) => (Array.isArray(list) ? list : []))
    .map((m) => (typeof m === "string" ? m : [m?.name, m?.type].filter(Boolean).join(" ")))
    .filter(Boolean);
}

/** @returns {{ trt: boolean, peptides: boolean }} */
export function memberTherapies({ userProfile, healthData } = {}) {
  const intake = userProfile?.intake || {};
  const meds = medicationNames({ userProfile, healthData });
  return {
    trt: onTRT(intake) || meds.some((m) => TRT.test(m)),
    peptides: onPeptides(intake) || meds.some((m) => PEPTIDE.test(m)),
  };
}

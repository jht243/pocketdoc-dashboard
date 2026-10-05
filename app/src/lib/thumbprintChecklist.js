/**
 * "Building your Thumbprint" — the five pieces of baseline data a new member is
 * asked for (doc 15, Building Your Thumbprint; Sep 30 call). Each item's status is
 * read from data the app already holds, never from a box the member ticks:
 *   todo     — nothing on file
 *   uploaded — a file is on file but has not yet produced this kind of data
 *   started  — (health history only) some sections finished
 *   done     — the data is on file
 */
import { intakeProgressSummary } from "./intakeContent";

// Hereditary-risk genes a clinical genomics (CGx) panel reports on (doc 15's list).
// APOE is left out on purpose: consumer ancestry reports include it, and counting a
// 23andMe export as a completed CGx panel would tell the member they're done when a
// hereditary cancer screen was never run.
const CGX_GENES = new Set([
  "BRCA1", "BRCA2", "MLH1", "MSH2", "MSH6", "PMS2", "EPCAM", "PALB2", "CHEK2", "ATM",
  "TP53", "PTEN", "CDH1", "STK11", "APC", "MUTYH",
  "MYH7", "MYBPC3", "LDLR", "PCSK9", "KCNQ1", "KCNH2", "SCN5A",
]);

const geneOf = (m) => String(m?.gene || "").trim().toUpperCase();

export function buildThumbprintChecklist({ healthData, userProfile, healthHistory }) {
  const labs = healthData?.labs || [];
  const records = healthData?.records || [];
  const genetics = healthData?.genetics || [];
  const labFileOnly = records.some((r) => r.type === "Lab result");
  const geneticFileOnly = records.some((r) => r.type === "genetic");
  const intake = intakeProgressSummary(healthHistory || userProfile?.intake);

  const fileStatus = (hasData, hasFile) => (hasData ? "done" : hasFile ? "uploaded" : "todo");

  const items = [
    {
      id: "blood",
      title: "Comprehensive blood panel",
      detail: "Hormones, lipids, thyroid, inflammation, nutrients.",
      status: fileStatus(labs.length > 0, labFileOnly),
      target: "importlabs",
      required: true,
    },
    {
      id: "pgx",
      title: "Pharmacogenomics (PGx)",
      detail: "How you process medications and supplements.",
      status: fileStatus(genetics.some((m) => m.category === "pharma"), geneticFileOnly),
      target: "importlabs",
      required: true,
    },
    {
      id: "cgx",
      title: "Clinical genomics (CGx)",
      detail: "Inherited disease and cancer risk.",
      status: fileStatus(genetics.some((m) => CGX_GENES.has(geneOf(m))), geneticFileOnly),
      target: "importlabs",
      required: true,
    },
    {
      id: "history",
      title: "Health history",
      detail: "Five short sections. Finish anytime.",
      status: intake.complete ? "done" : intake.done > 0 ? "started" : "todo",
      progress: intake,
      target: "healthhistory",
      required: true,
    },
    {
      id: "wearable",
      title: "Wearable",
      detail: "Daily sleep, HRV, and recovery. Oura recommended.",
      status: healthData?.today ? "done" : "todo",
      target: "profile",
      required: false,
    },
  ];

  const required = items.filter((i) => i.required);
  const done = required.filter((i) => i.status === "done").length;
  return { items, done, total: required.length, complete: done === required.length };
}

// Which panel a lab marker belongs to.
//
// A member who imports three or four panels ends up with 200+ deduped rows on the
// Labs screen — one flat alphabet-free list they have to scroll to find anything in.
// Clinicians read bloodwork by panel (lipids, thyroid, CBC…), so the list is grouped
// the same way and sorted A→Z inside each group.
//
// Matching is on the marker name, because that is all every extractor reliably
// returns. Order matters: the first pattern that matches wins, so narrower panels
// (thyroid, iron) are tested before the broad ones (chemistry) that would otherwise
// swallow them.

const GROUPS = [
  {
    name: "Lipids",
    test: /CHOLESTEROL|LDL|HDL|TRIGLYCERIDE|APO\s?B|APOLIPOPROTEIN|LIPOPROTEIN|LP\(A\)|NON HDL|NON-HDL/i,
  },
  {
    name: "Thyroid",
    test: /THYROID|\bTSH\b|\bT3\b|\bT4\b|THYROXINE|TRIIODOTHYRONINE|\bTPO\b|THYROGLOBULIN/i,
  },
  {
    name: "Metabolic",
    test: /GLUCOSE|\bA1C\b|HEMOGLOBIN A1C|INSULIN|C-PEPTIDE|FRUCTOSAMINE|HOMA/i,
  },
  {
    name: "Hormones",
    test: /TESTOSTERONE|ESTRADIOL|ESTROGEN|PROGESTERONE|\bDHEA\b|CORTISOL|\bLH\b|\bFSH\b|PROLACTIN|\bSHBG\b|\bIGF\b|\bPSA\b/i,
  },
  {
    name: "Vitamins & minerals",
    test: /VITAMIN|FOLATE|\bB12\b|COBALAMIN|MAGNESIUM|ZINC|COPPER|SELENIUM|CALCIUM|IODINE|\bCOQ10\b|OMEGA/i,
  },
  {
    name: "Iron studies",
    test: /\bIRON\b|FERRITIN|TRANSFERRIN|\bTIBC\b|\bUIBC\b|SATURATION/i,
  },
  {
    name: "Complete blood count",
    test: /\bWBC\b|\bRBC\b|HEMOGLOBIN|HEMATOCRIT|PLATELET|\bMCV\b|\bMCH\b|\bMCHC\b|\bRDW\b|\bMPV\b|NEUTROPHIL|LYMPHOCYTE|MONOCYTE|EOSINOPHIL|BASOPHIL|IMMATURE GRANULOCYTE/i,
  },
  {
    name: "Liver",
    test: /\bALT\b|\bAST\b|\bALP\b|ALKALINE PHOSPHATASE|BILIRUBIN|ALBUMIN|\bGGT\b|TOTAL PROTEIN|GLOBULIN|A\/G RATIO/i,
  },
  {
    name: "Kidney & electrolytes",
    test: /CREATININE|\bBUN\b|UREA|\bEGFR\b|\bGFR\b|CYSTATIN|SODIUM|POTASSIUM|CHLORIDE|CO2|CARBON DIOXIDE|PHOSPH|URIC ACID|ANION GAP/i,
  },
  {
    name: "Inflammation & immune",
    test: /C-REACTIVE|\bCRP\b|\bESR\b|SEDIMENTATION|HOMOCYSTEINE|FIBRINOGEN|INTERLEUKIN|\bIGA\b|\bIGG\b|\bIGM\b|\bANA\b|COMPLEMENT/i,
  },
];

const OTHER = "Other markers";

/** The panel name for one marker. */
function labGroup(marker) {
  const name = String(marker?.name || "");
  for (const g of GROUPS) if (g.test.test(name)) return g.name;
  return OTHER;
}

/**
 * Markers bucketed into panels, each panel's rows sorted A→Z, panels in clinical
 * order with "Other markers" last. Empty panels are dropped.
 */
function groupMarkers(markers) {
  const byGroup = new Map();
  for (const m of markers) {
    const g = labGroup(m);
    const list = byGroup.get(g) || [];
    list.push(m);
    byGroup.set(g, list);
  }
  const order = [...GROUPS.map((g) => g.name), OTHER];
  return order
    .filter((name) => byGroup.has(name))
    .map((name) => ({
      name,
      markers: byGroup.get(name).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
      ),
    }));
}

export { labGroup, groupMarkers, OTHER };

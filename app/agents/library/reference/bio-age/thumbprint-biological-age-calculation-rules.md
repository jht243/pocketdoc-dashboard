---
title: Thumbprint rules for calculating and displaying biological age
source: Thumbprint Health Developer Build Spec, Oct 2026
evidence: Moderate
approved_by: pending
as_of: 2026-10
url: https://pmc.ncbi.nlm.nih.gov/articles/PMC5940111/
---

These are Thumbprint Health product rules for the PhenoAge biological age score, set by the Thumbprint build spec. They are app rules, not part of the Levine 2018 paper.

- All nine markers must come from the same blood draw; if one is missing, no score is shown and the missing test is named (usually CBC with differential or hs-CRP).
- Glucose must be fasting; a non-fasting result is flagged or the score is marked low confidence.
- An hs-CRP above 10 mg/L usually signals a short-term illness or injury, so the score is not calculated and a recheck in 2 to 3 weeks is suggested.
- An hs-CRP below the lab's detection limit is entered at the lab's lower reporting limit.
- The score is shown only for ages roughly 20 to 84, matching the validation population, and is suppressed during pregnancy, active cancer treatment or acute illness.
- Results show in whole or half years. Changes smaller than 1 year between draws are treated as within normal lab variation, not as real change.
- What-if estimates rerun the full formula with one value changed and are labelled as estimates; effects under half a year show as a small effect. Keywords: bio age not showing, why no biological age, biological age changed.

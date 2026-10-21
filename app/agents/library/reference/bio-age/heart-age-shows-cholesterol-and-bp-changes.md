---
title: How Thumbprint shows cholesterol and blood pressure changes as Heart Age
source: Thumbprint Health Developer Build Spec, Oct 2026
evidence: Moderate
approved_by: Dr. Adam Locker, 2026-10-21
reviewed: 2026-10-21
as_of: 2026-10
url: https://www.aafp.org/afp/2025/0200/editorial-aha-prevent-equations
---

This is a Thumbprint Health product rule from the Thumbprint build spec. Because the PhenoAge biological age formula has no LDL, cholesterol or blood pressure term, Thumbprint shows improvements in those markers through Heart Age, which is calculated from the AHA PREVENT equations.

PREVENT uses total cholesterol and HDL, not LDL. To estimate an LDL change, the app assumes HDL and triglycerides stay the same, so total cholesterol falls by roughly the same amount as LDL, and reruns PREVENT with the new value. The result is shown two ways: the change in 10-year cardiovascular risk, and the change in Heart Age. Systolic blood pressure changes are handled the same way.

If a member already takes a cholesterol-lowering medication, that input stays marked yes. PREVENT was built for prevention estimates, so these what-if numbers are approximations from a population model, not precise predictions for one person. No fixed table converts points of LDL into years; every estimate is a fresh calculation. Keywords: will lowering LDL lower my age, cholesterol and heart age, blood pressure and heart age, what if my LDL improves.

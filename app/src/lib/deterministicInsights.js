// These suggestions are intentionally deterministic. Each card is a transparent
// template tied to named data points, which keeps the demo repeatable and avoids
// presenting generated medical advice as a clinical conclusion.
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
      title: "Worth a closer look: thyroid pattern",
      body: `TPO antibodies rose from ${firstTpo.value} to ${latestTpo.value} ${thyroid.unit} across ${tpoValues.length} panels, while you also logged ${thyroidSymptoms.join(" and ")}. That combination is worth bringing to your next visit.`,
      doctorPath: "Ask whether a full thyroid antibody panel or an ultrasound referral makes sense in the context of your symptoms and trend.",
      selfPayPath: "If you cannot get testing through your clinician, compare self-pay thyroid antibody panels before ordering—then review the results with a qualified clinician.",
    };
  }

  const vitaminD = healthData?.labs?.find((lab) => lab.name === "Vitamin D");
  if (vitaminD && Number(vitaminD.value) < 30) {
    return {
      type: "vitamin_d",
      title: "Worth following up: Vitamin D",
      body: `Your latest Vitamin D result is ${vitaminD.value} ${vitaminD.unit}, which is below the 30 ng/mL threshold used in this demo. It is worth reviewing with your clinician alongside your symptoms and current supplements.`,
      doctorPath: "Ask what target range and re-test timing fit your situation.",
      selfPayPath: "Keep any self-pay follow-up results with the same units and collection date so the trend remains comparable.",
    };
  }

  return null;
}

export { getRecordInsight };

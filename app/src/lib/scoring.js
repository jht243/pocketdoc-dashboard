

function useScoreModel(nutritionEnabled) {
  const baseItems = [
    { name: "Annual physical", status: "current", detail: "Completed Mar 2026", pts: 8, max: 8 },
    { name: "Comprehensive bloodwork", status: "current", detail: "Completed Jan 2026", pts: 8, max: 8 },
    { name: "Monthly bloodwork (TRT panel)", status: "due_soon", detail: "Due in 6 days, tracks hormone levels while on therapy", pts: 2, max: 8, action: "Complete this month's TRT panel" },
    { name: "Colonoscopy", status: "overdue", detail: "Due at 45, last completed at 42", pts: 0, max: 10, action: "Schedule your colonoscopy" },
    { name: "Prostate exam (PSA)", status: "due_soon", detail: "Due within 3 months", pts: 4, max: 8, action: "Book your PSA screening" },
    { name: "EEG / baseline neuro screen", status: "current", detail: "Completed Aug 2025", pts: 8, max: 8 },
    { name: "Skin cancer screening", status: "overdue", detail: "Over 18 months since last visit", pts: 0, max: 8, action: "Schedule a skin check" },
  ];

  // Daily training effort, scored from Zone 2+ minutes reported by the wearable.
  // Tiers: under 20 min = below threshold, 20-29 = partial credit scaling up,
  // 30-44 = full points (the target), 45+ = capped bonus, no reward past the cap.
  const zone2Minutes = 34;
  const scoreEffort = (min, max) => {
    if (min < 20) return Math.round((min / 20) * (max * 0.4));
    if (min < 30) return Math.round((max * 0.4) + ((min - 20) / 10) * (max * 0.6));
    return max;
  };

  // Nutrition is opt-in, set on the Profile page. When off, the daily score is built from
  // sleep, training effort, and the wake-up check-in at their full weights, out of 50. When
  // on, nutrition becomes a real fourth component and the other three shrink proportionally
  // to make room, so the daily ring always reads as "100% of what you've chosen to track,"
  // rather than nutrition being extra credit stacked on top of an already-full scale.
  const baseWeights = { sleep: 15, effort: 15, wakeup: 20 };
  const nutritionWeight = 10;
  let weights;
  if (nutritionEnabled) {
    const remaining = 50 - nutritionWeight;
    const sumBase = baseWeights.sleep + baseWeights.effort + baseWeights.wakeup;
    weights = {
      sleep: Math.round((baseWeights.sleep / sumBase) * remaining),
      effort: Math.round((baseWeights.effort / sumBase) * remaining),
      wakeup: Math.round((baseWeights.wakeup / sumBase) * remaining),
      nutrition: nutritionWeight,
    };
  } else {
    weights = { ...baseWeights, nutrition: 0 };
  }

  const effortPts = scoreEffort(zone2Minutes, weights.effort);
  const nutritionLogged = false; // today's logging state; toggled per day, separate from the opt-in setting
  const nutritionPts = nutritionEnabled && nutritionLogged ? Math.round(weights.nutrition * 0.8) : 0;

  const dailyItems = [
    { name: "Sleep score (Oura)", value: "82", note: "Good night last night", pts: weights.sleep, max: weights.sleep },
    { name: "Training effort (Zone 2+)", value: `${zone2Minutes} min`, note: "Target: 30 min Zone 2 or higher", pts: effortPts, max: weights.effort },
    { name: "Wake-up check-in", value: "Logged", note: "Felt rested", pts: weights.wakeup, max: weights.wakeup },
  ];
  if (nutritionEnabled) {
    dailyItems.push({
      name: "Nutrition", value: nutritionLogged ? "Logged" : "Not logged today",
      note: "Opted in on your profile", pts: nutritionPts, max: weights.nutrition,
      action: nutritionLogged ? undefined : "Log today's meals",
    });
  }

  const baseTotal = baseItems.reduce((s, i) => s + i.pts, 0);
  const baseMax = baseItems.reduce((s, i) => s + i.max, 0);
  const dailyTotal = dailyItems.reduce((s, i) => s + i.pts, 0);
  const dailyMax = dailyItems.reduce((s, i) => s + i.max, 0);

  // The gauge displays everything on a consistent 0-50 scale per ring regardless of how
  // many raw points the underlying item list sums to, since baseMax in particular isn't
  // a round number.
  const baseDisplay = Math.round((baseTotal / baseMax) * 50);
  const dailyDisplay = Math.round((dailyTotal / dailyMax) * 50);

  return {
    baseItems, dailyItems, nutritionEnabled, nutritionLogged,
    baseTotal, baseMax, dailyTotal, dailyMax, baseDisplay, dailyDisplay,
  };
}

export { useScoreModel };

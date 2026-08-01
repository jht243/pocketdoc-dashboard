

function useScoreModel(nutritionEnabled, healthData) {
  const source = healthData?.score;
  if (!source) return { hasData: false, baseItems: [], dailyItems: [], baseDisplay: 0, dailyDisplay: 0 };
  const baseItems = source.baseItems || [];

  // Daily training effort, scored from Zone 2+ minutes reported by the wearable.
  // Tiers: under 20 min = below threshold, 20-29 = partial credit scaling up,
  // 30-44 = full points (the target), 45+ = capped bonus, no reward past the cap.
  const zone2Minutes = source.zone2Minutes || 0;
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
  const nutritionLogged = Boolean(source.nutritionLogged); // today's logging state; toggled per day, separate from the opt-in setting
  const nutritionPts = nutritionEnabled && nutritionLogged ? Math.round(weights.nutrition * 0.8) : 0;

  const dailyItems = [
    { name: "Sleep score (Oura)", value: String(source.sleepScore || "—"), note: source.sleepNote || "No sleep data yet", pts: source.sleepScore ? weights.sleep : 0, max: weights.sleep },
    { name: "Training effort (Zone 2+)", value: `${zone2Minutes} min`, note: "Target: 30 min Zone 2 or higher", pts: effortPts, max: weights.effort },
    { name: "Wake-up check-in", value: source.wakeupLogged ? "Logged" : "Not logged", note: source.wakeupNote || "No check-in yet", pts: source.wakeupLogged ? weights.wakeup : 0, max: weights.wakeup },
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
  const baseDisplay = baseMax ? Math.round((baseTotal / baseMax) * 50) : 0;
  const dailyDisplay = dailyMax ? Math.round((dailyTotal / dailyMax) * 50) : 0;

  return {
    hasData: true, baseItems, dailyItems, nutritionEnabled, nutritionLogged,
    baseTotal, baseMax, dailyTotal, dailyMax, baseDisplay, dailyDisplay,
  };
}

export { useScoreModel };

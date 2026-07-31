

function getDailyRecommendation() {
  // Stand-in for today's actual device, lab, and log data. In production these would be
  // pulled from the same sources already powering Body, Labs, and the score model.
  const today = {
    readiness: 68,
    readinessTypical: 78,
    restingHR: 64,
    restingHRBaseline: 52,
    hrv: 42,
    hrvBaseline: 50,
    skinTempDeviation: 0.4,
    sleepEfficiency: 0.91,
    strainYesterday: "high",
    zone2MinutesPlanned: 30,
    vitaminD: 28, // ng/mL, last checked
    tpoAntibodiesTrend: "rising",
    recentSymptoms: ["fatigue", "cold sensitivity"],
    nutritionEnabled: false,
    nutritionLoggedToday: false,
    proteinLowOnTrainingDays: true,
    bodyFatTrend: "down",
    weightTrend: "flat",
    goalAchieved: false,
  };

  const candidates = [];

  // Highest confidence: two independent signals agreeing (device + self-report).
  if (today.skinTempDeviation > 0.3 && today.restingHR - today.restingHRBaseline > 8 && today.recentSymptoms.length > 0) {
    candidates.push({
      priority: 100, type: "illness_onset", icon: "alert",
      title: "Possible onset detected",
      body: `Your device shows elevated overnight temperature and a ${today.restingHR - today.restingHRBaseline} bpm resting heart rate increase, alongside what you've reported feeling. This pattern has preceded a cold for you before. Consider rest, hydration, and extra vitamin C and zinc today.`,
      action: { label: "See immune support options", target: "iv" },
    });
  }

  // Low readiness with poor sleep but no illness signal: sleep debt, not illness.
  if (today.readiness < today.readinessTypical - 8 && today.sleepEfficiency < 0.92 && today.skinTempDeviation <= 0.3) {
    candidates.push({
      priority: 70, type: "sleep_debt", icon: "moon",
      title: "Recovery is lagging, likely sleep debt",
      body: `Your readiness is ${today.readinessTypical - today.readiness} points below your typical range, with no illness signal. Sleep efficiency was lower than usual. An earlier bedtime tonight, even by 30-45 minutes, is the highest-leverage thing you can do.`,
      action: null,
    });
  }

  // High strain yesterday + low HRV today: suggest backing off today's training.
  if (today.strainYesterday === "high" && today.hrvBaseline - today.hrv > 5) {
    candidates.push({
      priority: 65, type: "recovery_day", icon: "activity",
      title: "Consider an easier day",
      body: `Yesterday's training load was high and your HRV is still ${today.hrvBaseline - today.hrv}ms below baseline this morning. Today might be better as active recovery than your planned Zone 2 session.`,
      action: null,
    });
  }

  // Lab + symptom + readiness trend cross-reference (the Hashimoto's-style thread).
  if (today.tpoAntibodiesTrend === "rising" && today.recentSymptoms.includes("fatigue") && today.recentSymptoms.includes("cold sensitivity")) {
    candidates.push({
      priority: 60, type: "lab_symptom_pattern", icon: "sparkles",
      title: "Today's symptoms line up with your lab trend",
      body: `You've reported fatigue and cold sensitivity again. This matches the antibody trend in your last 3 panels. Nothing urgent, but worth keeping in your Discussion Page for your next visit.`,
      action: { label: "Open Discussion Page", target: "discussion" },
    });
  }

  // Known deficiency + related daily complaint.
  if (today.vitaminD < 30 && today.recentSymptoms.includes("fatigue")) {
    candidates.push({
      priority: 40, type: "vitamin_d_link", icon: "sparkles",
      title: "Low Vitamin D may be contributing to today's fatigue",
      body: `Your last result was ${today.vitaminD} ng/mL, below the recommended range. Consistent daily supplementation is the main lever here, and it can take several weeks to show up in energy levels.`,
      action: { label: "Shop Vitamin D3 in Marketplace", target: "vitd3" },
    });
  }

  // Nutrition tied to training load, only relevant if opted in and actually logged.
  if (today.nutritionEnabled && today.nutritionLoggedToday && today.proteinLowOnTrainingDays && today.zone2MinutesPlanned >= 30) {
    candidates.push({
      priority: 35, type: "protein_training_day", icon: "activity",
      title: "Protein has been light on training days",
      body: "On days with 30+ minutes of Zone 2 or higher, your logged protein has been running low. Worth adding a serving around today's session.",
      action: null,
    });
  }

  // Body composition reframe: weight flat but body fat down is a win, not a stall.
  if (today.weightTrend === "flat" && today.bodyFatTrend === "down" && !today.goalAchieved) {
    candidates.push({
      priority: 25, type: "recomposition", icon: "sparkles",
      title: "Your weight looks flat, but you're recomposing",
      body: "Body fat has been trending down while weight has held steady, that's muscle replacing fat, not a stall. Worth looking at the trend, not just today's number.",
      action: { label: "View body fat trend", target: "bodyfat_history" },
    });
  }

  // Soft nutrition nudge: only fires if opted in but not logging, and only as a low-priority invite.
  if (today.nutritionEnabled && !today.nutritionLoggedToday && today.weightTrend === "flat" && today.bodyFatTrend !== "down") {
    candidates.push({
      priority: 15, type: "nutrition_nudge", icon: "sparkles",
      title: "Want to see what's driving your trend?",
      body: "Your body fat goal has been flat for a few weeks and nutrition hasn't been logged recently. Logging a few days could help spot what's going on, no pressure either way.",
      action: null,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0];
}

export { getDailyRecommendation };

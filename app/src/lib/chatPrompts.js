/**
 * The suggested questions on an empty chat, built from what the member actually has
 * on file. Fixed suggestions ("my thyroid trend", "my vitamin D result") told a
 * member with no labs that we held results we don't, which is the one thing the app
 * must never do. A suggestion names a kind of data only when that data is here.
 */
const has = (labs, re) => labs.some((l) => re.test(String(l?.name || "")));

export function startingPrompts(healthData, userProfile) {
  const labs = healthData?.labs || [];
  const meds = userProfile?.medicationsDetail?.length
    ? userProfile.medicationsDetail
    : userProfile?.intake?.medications || [];
  const out = [];
  if (labs.length) out.push("What stands out in my latest bloodwork?");
  if (has(labs, /\b(tsh|thyroid|t4|t3)\b/i)) out.push("What should I discuss with my doctor about my thyroid results?");
  else if (has(labs, /vitamin d|25-?oh/i)) out.push("How does my vitamin D result fit my overall profile?");
  if (healthData?.genetics?.length) out.push("What does my genetics report say about me?");
  if (meds.length) out.push("Do any of my medications or supplements interact?");
  if (healthData?.today) out.push("My readiness is low today — should I still train?");
  if (!labs.length) out.push("What information should I upload first?");
  out.push("How can I prepare for my next doctor visit?");
  return out.slice(0, 4);
}

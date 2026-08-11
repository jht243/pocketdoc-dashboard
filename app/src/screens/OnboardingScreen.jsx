import React, { useState, useRef, useEffect } from "react";
import { CheckCircle2, Circle, Dna, Sparkles, Upload, X } from "lucide-react";
import { Card } from "../components/Card";
import { buildPreventiveCareSchedule } from "../lib/preventiveCare";
import { isScreeningDone } from "../lib/screeningDates";
import { COLORS, SERIF } from "../theme/tokens";
import { callAI, firstText } from "../lib/api";
import { scrollPhoneToTop } from "../lib/scroll";
import { useAuth } from "../lib/AuthContext";
import { uploadDocument } from "../lib/profileStore";
import { IntakeForm } from "../components/IntakeForm";
import { emptyAnswers } from "../lib/intakeContent";

// ---- ONBOARDING SCREEN ----
// Three steps: profile inputs → instant preventive care schedule → first AI insight.
// Delivers value before the user has uploaded anything or connected any device.
function OnboardingScreen({ onComplete, onStepComplete, initial }) {
  const { user } = useAuth();
  const [step, setStep] = useState(initial?.onboardingStep || 1); // 1-fast facts | 2-preventive care | 3-health intake | 4-bloodwork | 5-AI insight
  const [profile, setProfile] = useState(initial?.profile || {
    name: "", dob: "", sex: "male", smoker: false,
    familyEarlyHeartDisease: false, familyOrPersonalCancer: false, diabetesOrPrediabetes: false,
  });
  // The intake now covers the full health questionnaire (lib/intakeContent.js);
  // emptyAnswers() seeds every field with the right empty type, and any resumed
  // intake overrides on top. The persisted keys (conditions, medications,
  // familyHistory, pastEvents, primaryConcern, exercise, sleep) are unchanged.
  const [intake, setIntake] = useState(() => ({ ...emptyAnswers(), ...(initial?.intake || {}) }));
  const [schedule, setSchedule] = useState(initial?.schedule || []);
  const [completedItems, setCompletedItems] = useState(initial?.completedItems || {});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [storing, setStoring] = useState(false);
  const [storeError, setStoreError] = useState(null);
  const [storedDoc, setStoredDoc] = useState(null);
  const [insight, setInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Advance and persist in one call, so a drop-off mid-onboarding can be resumed
  // instead of restarting. Persisting is best-effort — never block navigation on it.
  const goToStep = (next) => {
    setStep(next);
    scrollPhoneToTop();
    onStepComplete?.({ profile, intake, schedule, completedItems }, next);
  };
  const fileRef = useRef(null);

  const urgencyColor = { overdue: COLORS.danger, due_soon: COLORS.warning, upcoming: COLORS.tealLight };
  const urgencyLabel = { overdue: "Overdue", due_soon: "Due soon", upcoming: "Upcoming" };

  const persistProfile = (nextProfile) => {
    setProfile(nextProfile);
    onStepComplete?.({ profile: nextProfile, intake, schedule, completedItems }, step);
  };

  const persistIntake = (nextIntake) => {
    setIntake(nextIntake);
    onStepComplete?.({ profile, intake: nextIntake, schedule, completedItems }, step);
  };

  // <IntakeForm> reports one changed field at a time; persist immediately so a
  // drop-off mid-intake can be resumed.
  const onIntakeChange = (key, value) => persistIntake({ ...intake, [key]: value });

  const computeSchedule = (p) => {
    const birthDate = new Date(p.dob);
    const today = new Date();
    const age =
      today.getFullYear() - birthDate.getFullYear() -
      (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
    return buildPreventiveCareSchedule({ ...p, age });
  };

  const goToStep2 = () => {
    if (!profile.dob || !profile.name) return;
    // Compute before setState so the step-progress save includes the schedule
    // (setSchedule alone would leave goToStep reading a stale empty array).
    const nextSchedule = computeSchedule(profile);
    setSchedule(nextSchedule);
    setStep(2);
    scrollPhoneToTop();
    onStepComplete?.({ profile, intake, schedule: nextSchedule, completedItems }, 2);
  };

  const toggleScreeningDone = (id) => {
    const next = { ...completedItems };
    if (isScreeningDone(completedItems[id])) {
      delete next[id];
    } else {
      // Onboarding is done/not-done only — month/year is collected later in the app.
      next[id] = true;
    }
    setCompletedItems(next);
    // Persist immediately so closing the app mid-step doesn't lose mark-done taps.
    onStepComplete?.({ profile, intake, schedule, completedItems: next }, step);
  };

  // The schedule is derived state, built when step 1 is submitted. A user resuming at
  // step 2+ never passes through that handler, so rebuild it here or they'd see an
  // empty schedule ("0 overdue") despite having a complete profile.
  useEffect(() => {
    if (!schedule.length && profile.dob && profile.name) {
      setSchedule(computeSchedule(profile));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.dob, profile.name]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setStoreError(null);
    setStoredDoc(null);

    // Store immediately rather than on completion. Steps 4 and 5 involve a slow AI
    // call the user can abandon; deferring the upload meant their file was silently
    // lost if they left, even though the UI had told them it was ready.
    if (user) {
      setStoring(true);
      const { document, error } = await uploadDocument(user.id, file, "lab");
      setStoring(false);
      if (error) setStoreError(error.message || "Upload failed");
      else setStoredDoc(document);
    }

    const reader = new FileReader();
    reader.onload = (ev) => setUploadedFile({ base64: ev.target.result.split(",")[1], mediaType: file.type || "application/pdf" });
    reader.readAsDataURL(file);
  };

  const generateInsight = async () => {
    goToStep(5);
    setLoadingInsight(true);
    try {
      const overdueItems = schedule.filter(i => i.urgency === "overdue").map(i => i.name);
      const concernText = intake.primaryConcern ? `Their primary health concern is: "${intake.primaryConcern}".` : "";
      const conditionText = intake.conditions.length > 0 ? `Current conditions: ${intake.conditions.join(", ")}.` : "";
      const medText = intake.medications.length > 0 ? `Current medications/supplements: ${intake.medications.join(", ")}.` : "";
      const familyText = intake.familyHistory.length > 0 ? `Family history of: ${intake.familyHistory.join(", ")}.` : "";
      const uploadText = uploadedFile ? "They have uploaded bloodwork for analysis." : "";

      const messages = [{
        role: "user",
        content: uploadedFile ? [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: uploadedFile.base64 } },
          { type: "text", text: `This is ${profile.name}'s bloodwork PDF. ${conditionText} ${medText} ${familyText} ${concernText} Analyze the bloodwork and write a warm, specific 3-paragraph health advocate message addressing their primary concern and the most important findings. Reference actual values from the bloodwork where possible. End with one sentence about what having this complete picture will let them do. Never diagnose. Never prescribe.` }
        ] : [{ type: "text", text: `${profile.name} is a ${(() => { const b = new Date(profile.dob); const t = new Date(); return t.getFullYear() - b.getFullYear() - (t < new Date(t.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0); })()}-year-old ${profile.sex}. ${conditionText} ${medText} ${familyText} Preventive care items overdue: ${overdueItems.length > 0 ? overdueItems.join(", ") : "none"}. ${concernText} Write a warm, specific 3-paragraph health advocate message addressing their primary concern and the 1-2 most important things to focus on given their age and profile. Reference specific details they shared. End with one sentence about what having this complete picture will let them do. Never diagnose. Never prescribe.` }]
      }];

      const data = await callAI({
        system: "You are a personal health advocate. Be warm, direct, and specific. Write in 3 short conversational paragraphs. Never use bullet points. Never diagnose. Never prescribe. Always frame recommendations as advocacy — helping someone have better conversations with their doctors.",
        messages,
        pdf: true,
      });
      setInsight(firstText(data));
    } catch {
      setInsight(`Welcome, ${profile.name}. Based on what you've shared, your advocate now has a picture of your health to work from. The most important next step is uploading your most recent bloodwork — that's where the real personalization begins.`);
    }
    setLoadingInsight(false);
  };

  const progressPct = ((step - 1) / 4) * 100;

  return (
    <div style={{ padding: "28px 20px", minHeight: "100%" }}>
      {/* Progress bar */}
      {step < 5 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>
              {["", "About you", "Your screenings", "Your health history", "Your bloodwork"][step]}
            </span>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>Step {step} of 4</span>
          </div>
          <div style={{ height: 3, background: COLORS.border, borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: COLORS.teal, borderRadius: 2, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* STEP 1: Fast facts — name, age, sex, risk factors */}
      {step === 1 && (
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 6 }}>Let's get started</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
            A few quick facts and we'll show you exactly what preventive care you should be getting at your age — before you do anything else.
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 5 }}>First name</div>
            <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} onBlur={() => onStepComplete?.({ profile, intake, schedule, completedItems }, step)} placeholder="Your first name" style={{ width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "11px 14px", color: COLORS.textPrimary, fontSize: 14, outline: "none" }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 5 }}>Date of birth</div>
            <input type="date" value={profile.dob} onChange={e => persistProfile({ ...profile, dob: e.target.value })}
              max={new Date().toISOString().split("T")[0]}
              style={{ width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "11px 14px", color: COLORS.textPrimary, fontSize: 14, outline: "none" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>Biological sex</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["male", "female"].map(s => (
                <button key={s} onClick={() => persistProfile({ ...profile, sex: s })} style={{ flex: 1, padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: profile.sex === s ? COLORS.teal : COLORS.bgCardAlt, color: profile.sex === s ? COLORS.onAccent : COLORS.textSecondary, border: "none", textTransform: "capitalize" }}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>Risk factors — optional, but each one changes your screening recommendations</div>
            {[
              { key: "smoker", label: "Current or former smoker" },
              { key: "familyEarlyHeartDisease", label: "Family history of heart disease before age 60" },
              { key: "familyOrPersonalCancer", label: "Personal or family history of cancer" },
              { key: "diabetesOrPrediabetes", label: "Diabetes or pre-diabetes (personal or family)" },
            ].map(item => (
              <button key={item.key} onClick={() => persistProfile({ ...profile, [item.key]: !profile[item.key] })} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: profile[item.key] ? `${COLORS.teal}20` : COLORS.bgCardAlt, border: `1px solid ${profile[item.key] ? COLORS.teal : COLORS.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", marginBottom: 8, textAlign: "left" }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, background: profile[item.key] ? COLORS.teal : "none", border: `2px solid ${profile[item.key] ? COLORS.teal : COLORS.textMuted}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {profile[item.key] && <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.onAccent }} />}
                </div>
                <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{item.label}</span>
              </button>
            ))}
          </div>

          <button onClick={goToStep2} disabled={!profile.name || !profile.dob} style={{ width: "100%", background: !profile.name || !profile.dob ? COLORS.bgCardAlt : COLORS.teal, border: "none", color: !profile.name || !profile.dob ? COLORS.textMuted : COLORS.onAccent, fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: !profile.name || !profile.dob ? "default" : "pointer" }}>
            See my screening schedule →
          </button>
        </div>
      )}

      {/* STEP 2: Preventive care schedule — immediate value */}
      {step === 2 && (
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Your screening schedule</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>
            These are the screenings recommended for your age and profile, {profile.name}. We don’t
            know your history yet — <strong style={{ color: COLORS.textPrimary }}>mark anything you’ve
            already had</strong> and we’ll track the rest from there.
          </div>

          {/* Only claim status we can actually justify. Before the user tells us what
              they've had, an "overdue" badge would be the app inventing information. */}
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            background: COLORS.accentDim, border: `1px solid ${COLORS.accent}22`,
            borderRadius: 10, padding: "9px 11px", marginBottom: 4,
            fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 1.45,
          }}>
            <CheckCircle2 size={15} color={COLORS.accent} style={{ flexShrink: 0 }} />
            <span>Tap <strong style={{ color: COLORS.textPrimary }}>Mark done</strong> on anything you’ve already completed. You can change these later.</span>
          </div>

          {[...new Set(schedule.map(i => i.category))].map(cat => (
            <div key={cat}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6, marginTop: 16 }}>{cat.toUpperCase()}</div>
              {schedule.filter(i => i.category === cat).map((item) => {
                const done = isScreeningDone(completedItems[item.id]);
                return (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: done ? 400 : 600, opacity: done ? 0.55 : 1 }}>{item.name}</div>
                      <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 1 }}>{item.frequency}</div>
                      {item.note && (
                        <div style={{ fontSize: 10.5, color: COLORS.accent, marginTop: 2 }}>{item.note}</div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleScreeningDone(item.id)}
                      style={{
                        flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                        // Unchecked state uses the app's interactive blue: a grey outline
                        // read as a disabled label rather than a control.
                        background: done ? COLORS.goodDim : COLORS.accentDim,
                        border: `1px solid ${done ? COLORS.good : COLORS.accent}59`,
                        color: done ? COLORS.good : COLORS.accent,
                        borderRadius: 999, padding: "7px 12px",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      {done
                        ? <><CheckCircle2 size={14} /> Done</>
                        : <><Circle size={14} strokeWidth={2.2} /> Mark done</>}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

          <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 14, marginBottom: 20 }}>
            {Object.values(completedItems).filter(isScreeningDone).length} of {schedule.length} marked as done —
            we’ll remind you about the rest.
          </div>

          <button onClick={() => goToStep(3)} style={{ width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent, fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer" }}>
            Tell me about your health →
          </button>
        </div>
      )}

      {/* STEP 3: Health intake — purposeful questionnaire, no hiding behind chat */}
      {step === 3 && (
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 6 }}>Your health picture</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
            The more you share now, the more specific your advocate can be. Every field is optional — but each one changes the quality of what you get back.
          </div>

          <IntakeForm answers={intake} onChange={onIntakeChange} variant="onboarding" />

          <button onClick={() => goToStep(4)} style={{ width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent, fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer" }}>
            Upload bloodwork →
          </button>
          <button onClick={generateInsight} style={{ width: "100%", background: "none", border: "none", color: COLORS.textMuted, fontSize: 12, padding: "10px", cursor: "pointer", marginTop: 4 }}>
            Skip bloodwork, show my insight now
          </button>
        </div>
      )}

      {/* STEP 4: Bloodwork upload */}
      {step === 4 && (
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 6 }}>Upload your bloodwork</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
            This is where the real personalization happens. Upload a PDF or photo of any recent lab results — Quest, LabCorp, your doctor's office, anything.
          </div>

          <input type="file" ref={fileRef} accept=".pdf,image/*" onChange={handleFileUpload} style={{ display: "none" }} />

          {!uploadedFileName ? (
            <>
              <button onClick={() => fileRef.current?.click()} style={{ width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.tealLight}50`, borderRadius: 14, padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
                <Upload size={28} color={COLORS.tealLight} />
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>Upload PDF or photo</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>From Quest, LabCorp, or any lab report</div>
              </button>
              <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center", marginBottom: 20 }}>
                Or forward results to <span style={{ color: COLORS.tealLight }}>records@hello-app.health</span>
              </div>
            </>
          ) : (
            <Card style={{
              border: `1px solid ${storeError ? COLORS.danger : storedDoc ? COLORS.good : COLORS.accent}40`,
              marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {storeError
                  ? <X size={20} color={COLORS.danger} />
                  : <CheckCircle2 size={20} color={storedDoc ? COLORS.good : COLORS.accent} />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{uploadedFileName}</div>
                  {/* Report what actually happened. "Ready to analyze" implied the file
                      was safe while it was still only in browser memory. */}
                  <div style={{ fontSize: 11, color: storeError ? COLORS.danger : COLORS.textMuted }}>
                    {storing
                      ? "Saving to your records…"
                      : storeError
                        ? `Couldn't save: ${storeError}`
                        : storedDoc
                          ? "Saved to your records"
                          : "Ready to analyze"}
                  </div>
                </div>
                <button
                  onClick={() => { setUploadedFile(null); setUploadedFileName(null); setStoredDoc(null); setStoreError(null); }}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}
                >
                  <X size={16} />
                </button>
              </div>
            </Card>
          )}

          {/* Genetic testing offer — shown here because user now understands the platform */}
          <Card style={{ border: `1px solid ${COLORS.gold}40`, background: COLORS.warnDim, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Dna size={18} color={COLORS.gold} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Want deeper personalization? Order a genetic panel.</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
                  A genetic panel tells your advocate how you process medications, which supplements actually work for your biology, and your hereditary risk factors. It changes the specificity of everything.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ background: COLORS.gold, border: "none", color: COLORS.onAccent, fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>Order panel — $299</button>
                  <button style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: 11, padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>I already have 23andMe data →</button>
                </div>
              </div>
            </div>
          </Card>

          <button onClick={generateInsight} style={{ width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent, fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer" }}>
            {uploadedFileName ? "Analyze my bloodwork →" : "Show my insight →"}
          </button>
        </div>
      )}

      {/* STEP 5: AI insight — the payoff */}
      {step === 5 && (
        <div>
          {loadingInsight ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <Sparkles size={32} color={COLORS.tealLight} style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 6 }}>
                {uploadedFile ? "Reading your bloodwork..." : "Building your health picture..."}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                Your advocate is reviewing everything you shared.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 20 }}>Hi {profile.name}</div>
              <Card style={{ border: `1px solid ${COLORS.tealLight}30`, marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
                  <Sparkles size={16} color={COLORS.tealLight} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.tealLight, letterSpacing: 0.5 }}>YOUR HEALTH ADVOCATE</span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{insight}</div>
              </Card>
              <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
                Your preventive care schedule, health history, and any uploaded bloodwork are now saved. Your advocate gets smarter as you add more over time.
              </div>
              <button onClick={() => onComplete({ profile, intake, schedule, completedItems })} style={{ width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent, fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer" }}>
                Go to my health record
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { OnboardingScreen };

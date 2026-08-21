import React, { useState, useEffect, useCallback } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { TabBar } from "./components/TabBar";
import { COLORS } from "./theme/tokens";
import { useAuth } from "./lib/AuthContext";
import { isConfigured } from "./lib/supabase";
import { scrollPhoneToTop } from "./lib/scroll";
import {
  loadFullProfile,
  loadDocuments,
  loadLabMarkers,
  loadGeneticMarkers,
  saveScreenings,
  saveOnboardingProgress,
  completeOnboarding,
  acceptConsent,
  saveMedications,
  saveHealthHistory,
} from "./lib/profileStore";
import {
  disableTestMode,
  enableTestMode,
  loadTestModeSnapshot,
} from "./lib/testMode";
import { loadWearableSnapshot, readOuraCallbackResult } from "./lib/wearableStore";
import { generateAIInsights } from "./lib/aiInsights";
import { buildBaseItems } from "./lib/scoring";
import AuthScreen from "./screens/AuthScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import PrivacyScreen, { CONSENT_VERSION } from "./screens/PrivacyScreen";
import { AIChatScreen } from "./screens/AIChatScreen";
import { BodyScreen } from "./screens/BodyScreen";
import { BrowseSupplementsScreen } from "./screens/BrowseSupplementsScreen";
import { CheckInScreen } from "./screens/CheckInScreen";
import { DiscussionPageScreen } from "./screens/DiscussionPageScreen";
import { GeneticProfileScreen } from "./screens/GeneticProfileScreen";
import { HealthHistoryScreen } from "./screens/HealthHistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ImportLabsScreen } from "./screens/ImportLabsScreen";
import { LabsScreen } from "./screens/LabsScreen";
import { MarketScreen } from "./screens/MarketScreen";
import { MedicationScreen } from "./screens/MedicationScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { OrderLabsScreen } from "./screens/OrderLabsScreen";
import { PreventiveCareScreen } from "./screens/PreventiveCareScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { RecordsScreen } from "./screens/RecordsScreen";

const Splash = ({ children }) => (
  <div
    style={{
      padding: 40,
      textAlign: "center",
      color: COLORS.textSecondary,
      fontSize: 13.5,
      lineHeight: 1.6,
    }}
  >
    {children}
  </div>
);

/**
 * Consume the `?oura=…` params exactly once per page load.
 *
 * Module scope rather than an effect or a state initializer, because reading them
 * also strips them from the URL — and React invokes both render bodies and state
 * initializers twice under StrictMode, which would clear the params on the run whose
 * result gets discarded.
 */
let pendingOuraNotice;
function takeOuraNotice() {
  if (pendingOuraNotice === undefined) pendingOuraNotice = readOuraCallbackResult();
  return pendingOuraNotice;
}

/**
 * Assemble the live `healthData.score`.
 *
 * Returns undefined when neither half has data — HomeScreen then shows the locked
 * "unlock your score" panel instead of a ring reading zero, which would look like a
 * terrible score rather than an absent one.
 */
function buildLiveScore(storedProfile, wearable) {
  const baseItems = buildBaseItems(storedProfile?.schedule, storedProfile?.completedItems);
  if (!baseItems.length && !wearable?.score) return undefined;
  return { baseItems, ...(wearable?.score || {}) };
}

// Shape the DB rows (labs, uploaded documents, wearable) plus the derived score into
// the single `liveHealthData` object every screen reads. Kept here so the mount load,
// the onboarding hand-off, and the test-mode-off path can never drift apart.
function buildLiveHealthData(stored, documents = [], labMarkers = [], wearable = null, geneticMarkers = []) {
  return {
    labs: labMarkers.map((marker) => ({ ...marker, date: new Date(marker.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) })),
    records: documents.map((document) => ({ name: document.file_name || "Untitled upload", type: document.kind === "lab" ? "Lab result" : document.kind })),
    // Real imported genomes (rich objects), read by the Genetic Profile screen and
    // summarized into the AI chat's health context. Empty until the user imports a source.
    genetics: geneticMarkers,
    today: wearable?.today,
    vitals: wearable?.vitals || [],
    score: buildLiveScore(stored, wearable),
  };
}

function App() {
  const { user, loading: authLoading, recovering } = useAuth();
  const [active, setActive] = useState("onboarding");
  const [marketHighlight, setMarketHighlight] = useState(null);
  const [nutritionEnabled, setNutritionEnabled] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [healthHistory, setHealthHistory] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [testSnapshot, setTestSnapshot] = useState(null);
  const [testModeSaving, setTestModeSaving] = useState(false);
  const [liveHealthData, setLiveHealthData] = useState(null);
  // AI-generated insight cards for Home / Records / Labs. null = not ready yet or
  // AI unavailable → screens fall back to their deterministic templates.
  const [aiInsights, setAiInsights] = useState(null);
  // Pre-auth routing: welcome → auth, with privacy reachable from either.
  const [gate, setGate] = useState("welcome");
  const [resumeData, setResumeData] = useState(null);

  // Health snapshot in play: the seeded test-mode snapshot, or live records.
  const healthData = testModeEnabled ? testSnapshot?.health || null : liveHealthData;

  // Result of returning from Oura's consent screen, read once per page load.
  // Read during render rather than in an effect: the profile-load effect decides
  // which screen to land on, and it has to already know a connection just completed
  // or it would send the user to Home and the notice would never be seen.
  const [ouraNotice, setOuraNotice] = useState(takeOuraNotice);

  // Re-pull the wearable slice after a connect/sync/disconnect, without refetching
  // the whole profile. Merges rather than replaces so labs and records survive.
  const refreshWearable = useCallback(async () => {
    if (!user) return;
    const wearable = await loadWearableSnapshot(user.id);
    setLiveHealthData((prev) => ({
      ...(prev || {}),
      today: wearable?.today,
      vitals: wearable?.vitals || [],
      score: {
        ...(prev?.score || {}),
        ...(wearable?.score || {}),
        // A disconnect-and-purge leaves no wearable data; drop the daily fields
        // rather than stranding yesterday's sleep score on the ring forever.
        ...(wearable ? {} : { sleepScore: undefined, sleepNote: undefined, zone2Minutes: undefined }),
      },
    }));
  }, [user]);

  // Regenerate AI insights whenever the snapshot changes. Reset to null first so a
  // stale set never lingers over new data; screens fall back to deterministic
  // templates until this resolves (and if it fails).
  useEffect(() => {
    if (!user || !healthData) { setAiInsights(null); return; }
    let cancelled = false;
    setAiInsights(null);
    generateAIInsights(healthData, userProfile).then((res) => {
      if (!cancelled) setAiInsights(res);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, healthData]);

  // On sign-in, pull the stored profile. Completion — not merely having a dob — is
  // what decides home-vs-onboarding, now that we save partway through.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setUserProfile(null);
      setResumeData(null);
      setHealthHistory(null);
      setTestModeEnabled(false);
      setTestSnapshot(null);
      setLiveHealthData(null);
      setActive("onboarding");
      return;
    }
    setProfileLoading(true);
    Promise.all([loadFullProfile(user.id), loadTestModeSnapshot(user.id), loadDocuments(user.id), loadLabMarkers(user.id), loadWearableSnapshot(user.id), loadGeneticMarkers(user.id)]).then(([stored, testMode, documents, labMarkers, wearable, geneticMarkers]) => {
      if (cancelled) return;
      // Both halves of the ring come from `buildLiveHealthData`: base = preventive-care
      // coverage (the same schedule the Preventive Care screen renders), daily = today's
      // wearable. `score` is what switches the health-score ring on — useScoreModel
      // returns hasData:false without it — and stays undefined until at least one half
      // has real data, so the ring is hidden rather than rendering an honest-looking zero.
      setLiveHealthData(buildLiveHealthData(stored, documents, labMarkers, wearable, geneticMarkers));
      // Coming back from Oura's consent screen lands on Profile, where the device
      // list and the result notice are — otherwise the user is dropped on Home with
      // no confirmation that anything happened.
      const landing = ouraNotice ? "profile" : "home";
      if (testMode.enabled && testMode.snapshot?.profile) {
        setTestModeEnabled(true);
        setTestSnapshot(testMode.snapshot);
        setUserProfile(testMode.snapshot.profile);
        setHealthHistory(testMode.snapshot.healthHistory || null);
        setActive(landing);
      } else if (stored?.onboardingCompletedAt) {
        setTestModeEnabled(false);
        setTestSnapshot(null);
        setUserProfile(stored);
        setHealthHistory(null);
        setActive(landing);
      } else {
        // Partially onboarded (or brand new): hand what we have back to the form
        // so they resume where they stopped instead of starting over — including
        // medications and any screenings already marked done.
        setResumeData(stored?.profile?.dob ? stored : null);
        setTestModeEnabled(false);
        setTestSnapshot(null);
        setHealthHistory(null);
        setActive("onboarding");
      }
      setProfileLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Record consent once, on the first authenticated render after sign-up.
  useEffect(() => {
    if (user) acceptConsent(user.id, CONSENT_VERSION);
  }, [user]);

  // Any screen change starts at the top — the phone frame is the scroll container,
  // so without this you land at the previous screen's offset.
  useEffect(() => {
    scrollPhoneToTop();
  }, [active, gate]);

  const goToMarket = (highlight) => {
    setMarketHighlight(highlight);
    setActive("market");
  };

  // Persist after each step (and on screening/med toggles) so a drop-off keeps
  // profile fields, mark-done screenings, and medications — not just the step number.
  const handleStepComplete = (data, nextStep) => {
    if (!user) return;
    saveOnboardingProgress(user.id, data, nextStep);
    if (data.schedule?.length) {
      saveScreenings(user.id, data.schedule, data.completedItems || {});
    }
    // Health-history is step 3; once we're on or past it, keep medications in sync.
    if (nextStep >= 3) {
      saveMedications(user.id, data.intake?.medications || []);
    }
  };

  const handleOnboardingComplete = async (data) => {
    setUserProfile(data);
    // Unlock the health-score ring the instant they land on Home. The mount effect is
    // what normally builds liveHealthData, but it's keyed on `user` and doesn't re-run
    // on completion — so without this the score stayed locked ("import a lab to unlock")
    // until a full reload, even though onboarding just produced a schedule and labs.
    // Derive the score synchronously from the schedule the user just built; labs,
    // records, and wearable merge in below once their tables come back.
    setLiveHealthData((prev) => ({
      ...(prev || {}),
      score: buildLiveScore(data, null),
    }));
    setActive("home");
    if (!user) return;
    // The user shouldn't wait on the network to reach home; these settle behind it.
    await completeOnboarding(user.id, data);
    await saveScreenings(user.id, data.schedule, data.completedItems);
    await saveMedications(user.id, data.intake?.medications || []);
    // Uploads are no longer deferred to here — OnboardingScreen stores the file the
    // moment it's picked, so abandoning steps 4/5 can't lose it. Pull the labs, records,
    // and wearable saved during onboarding and fold them in over the interim score.
    const [documents, labMarkers, wearable, geneticMarkers] = await Promise.all([
      loadDocuments(user.id),
      loadLabMarkers(user.id),
      loadWearableSnapshot(user.id),
      loadGeneticMarkers(user.id),
    ]);
    setLiveHealthData(buildLiveHealthData(data, documents, labMarkers, wearable, geneticMarkers));
  };

  const handleTestModeChange = async (nextEnabled) => {
    if (!user || testModeSaving) return;
    setTestModeSaving(true);
    if (nextEnabled) {
      const { snapshot, error } = await enableTestMode(user.id);
      if (!error && snapshot?.profile) {
        setTestSnapshot(snapshot);
        setTestModeEnabled(true);
        setUserProfile(snapshot.profile);
        setHealthHistory(snapshot.healthHistory || null);
        setActive("home");
      }
    } else {
      const { error } = await disableTestMode(user.id);
      if (!error) {
        const stored = await loadFullProfile(user.id);
        const [documents, labMarkers, wearable, geneticMarkers] = await Promise.all([loadDocuments(user.id), loadLabMarkers(user.id), loadWearableSnapshot(user.id), loadGeneticMarkers(user.id)]);
        setTestModeEnabled(false);
        setTestSnapshot(null);
        setHealthHistory(null);
        // Rebuild the full live snapshot — including `score`, which this path used to
        // omit, leaving the ring locked after leaving test mode.
        setLiveHealthData(buildLiveHealthData(stored, documents, labMarkers, wearable, geneticMarkers));
        if (stored?.onboardingCompletedAt) {
          setUserProfile(stored);
          setActive("home");
        } else {
          setUserProfile(null);
          setResumeData(stored?.profile?.dob ? stored : null);
          setActive("onboarding");
        }
      }
    }
    setTestModeSaving(false);
  };

  const screens = {
    onboarding: (
      <OnboardingScreen
        onComplete={handleOnboardingComplete}
        onStepComplete={handleStepComplete}
        initial={resumeData}
      />
    ),
    home: <HomeScreen setActive={setActive} goToMarket={goToMarket} nutritionEnabled={nutritionEnabled} userProfile={userProfile} healthHistory={healthHistory} healthData={healthData} aiInsights={aiInsights} testModeEnabled={testModeEnabled} testModeSaving={testModeSaving} onTestModeChange={handleTestModeChange} />,
    checkin: <CheckInScreen testModeEnabled={testModeEnabled} />,
    aichat: <AIChatScreen setActive={setActive} userProfile={userProfile} healthData={healthData} testModeEnabled={testModeEnabled} />,
    records: <RecordsScreen setActive={setActive} healthData={healthData} aiInsights={aiInsights} />,
    labs: <LabsScreen setActive={setActive} goToMarket={goToMarket} healthData={healthData} aiInsights={aiInsights} testModeEnabled={testModeEnabled} />,
    market: <MarketScreen highlight={marketHighlight} setActive={setActive} healthData={healthData} />,
    discussion: <DiscussionPageScreen setActive={setActive} userProfile={userProfile} healthData={healthData} />,
    orderlabs: <OrderLabsScreen setActive={setActive} />,
    browsesupplements: <BrowseSupplementsScreen setActive={setActive} />,
    profile: <ProfileScreen setActive={setActive} nutritionEnabled={nutritionEnabled} setNutritionEnabled={setNutritionEnabled} userProfile={userProfile} healthHistory={healthHistory} healthData={healthData} testModeEnabled={testModeEnabled} ouraNotice={ouraNotice} onOuraNoticeSeen={() => setOuraNotice(null)} onWearableChange={refreshWearable} />,
    body: <BodyScreen setActive={setActive} healthData={healthData} />,
    importlabs: <ImportLabsScreen setActive={setActive} />,
    geneticprofile: <GeneticProfileScreen setActive={setActive} healthData={healthData} testModeEnabled={testModeEnabled} />,
    medications: <MedicationScreen setActive={setActive} userProfile={userProfile} goToMarket={goToMarket} />,
    preventivecare: <PreventiveCareScreen setActive={setActive} userProfile={userProfile} onCompletedItemsChange={(completedItems) => setUserProfile((p) => (p ? { ...p, completedItems } : p))} />,
    healthhistory: <HealthHistoryScreen setActive={setActive} userProfile={userProfile} healthHistory={healthHistory} onSave={(data) => { setHealthHistory(data); if (user) saveHealthHistory(user.id, data); }} />,
  };

  const hiddenTabBar = [
    "onboarding", "discussion", "orderlabs", "browsesupplements", "body",
    "importlabs", "geneticprofile", "medications", "preventivecare", "healthhistory",
  ];
  const showTabBar = user && !recovering && !hiddenTabBar.includes(active);

  let content;
  if (!isConfigured) {
    content = (
      <Splash>
        Supabase isn’t configured.
        <br />
        Copy <code>.env.example</code> to <code>.env.local</code> and set
        <br />
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
      </Splash>
    );
  } else if (authLoading) {
    content = <Splash>Loading…</Splash>;
  } else if (recovering) {
    // Arrived from a password-reset link — set the new password before anything else,
    // even though a (temporary) recovery session exists.
    content = <ResetPasswordScreen />;
  } else if (profileLoading) {
    content = <Splash>Loading…</Splash>;
  } else if (!user) {
    if (gate === "privacy") {
      content = <PrivacyScreen onBack={() => setGate("welcome")} />;
    } else if (gate === "auth") {
      content = <AuthScreen onPrivacy={() => setGate("privacy")} />;
    } else {
      content = (
        <WelcomeScreen
          onContinue={() => setGate("auth")}
          onPrivacy={() => setGate("privacy")}
        />
      );
    }
  } else {
    content = screens[active];
  }

  return (
    <div
      style={{
        background:
          "radial-gradient(1200px 800px at 50% -10%, #ffffff 0%, #e4e9ef 60%)",
        padding: 16,
        // The page never scrolls — the phone frame sizes to the viewport and owns
        // its own scrolling internally.
        height: "100dvh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PhoneFrame tabBar={showTabBar ? <TabBar active={active} setActive={setActive} /> : null}>
        {content}
      </PhoneFrame>
    </div>
  );
}

export default App;

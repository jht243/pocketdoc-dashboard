import React, { useState, useEffect } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { TabBar } from "./components/TabBar";
import { COLORS } from "./theme/tokens";
import { useAuth } from "./lib/AuthContext";
import { isConfigured } from "./lib/supabase";
import { scrollPhoneToTop } from "./lib/scroll";
import {
  loadProfile,
  loadDocuments,
  loadLabMarkers,
  saveScreenings,
  saveOnboardingProgress,
  completeOnboarding,
  acceptConsent,
  saveMedications,
  uploadDocument,
} from "./lib/profileStore";
import {
  disableTestMode,
  enableTestMode,
  loadTestModeSnapshot,
} from "./lib/testMode";
import AuthScreen from "./screens/AuthScreen";
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

function App() {
  const { user, loading: authLoading } = useAuth();
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
  // Pre-auth routing: welcome → auth, with privacy reachable from either.
  const [gate, setGate] = useState("welcome");
  const [resumeData, setResumeData] = useState(null);
  const pendingFileRef = React.useRef(null);

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
    Promise.all([loadProfile(user.id), loadTestModeSnapshot(user.id), loadDocuments(user.id), loadLabMarkers(user.id)]).then(([stored, testMode, documents, labMarkers]) => {
      if (cancelled) return;
      setLiveHealthData({
        labs: labMarkers.map((marker) => ({ ...marker, date: new Date(marker.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) })),
        records: documents.map((document) => ({ name: document.file_name || "Untitled upload", type: document.kind === "lab" ? "Lab result" : document.kind })),
      });
      if (testMode.enabled && testMode.snapshot?.profile) {
        setTestModeEnabled(true);
        setTestSnapshot(testMode.snapshot);
        setUserProfile(testMode.snapshot.profile);
        setHealthHistory(testMode.snapshot.healthHistory || null);
        setActive("home");
      } else if (stored?.onboardingCompletedAt) {
        setTestModeEnabled(false);
        setTestSnapshot(null);
        setUserProfile(stored);
        setHealthHistory(null);
        setActive("home");
      } else {
        // Partially onboarded (or brand new): hand what we have back to the form
        // so they resume where they stopped instead of starting over.
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

  // Persist after each step so a drop-off resumes instead of restarting.
  const handleStepComplete = (data, nextStep) => {
    if (user) saveOnboardingProgress(user.id, data, nextStep);
  };

  // The raw File is handed up when picked, then uploaded on completion — uploading
  // mid-flow would orphan files for users who never finish.
  const handleFileSelected = (file) => {
    pendingFileRef.current = file;
  };

  const handleOnboardingComplete = async (data) => {
    setUserProfile(data);
    setActive("home");
    if (!user) return;
    // The user shouldn't wait on the network to reach home; these settle behind it.
    await completeOnboarding(user.id, data);
    await saveScreenings(user.id, data.schedule, data.completedItems);
    await saveMedications(user.id, data.intake?.medications);
    if (pendingFileRef.current) {
      await uploadDocument(user.id, pendingFileRef.current, "lab");
      pendingFileRef.current = null;
    }
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
        const stored = await loadProfile(user.id);
        const [documents, labMarkers] = await Promise.all([loadDocuments(user.id), loadLabMarkers(user.id)]);
        setTestModeEnabled(false);
        setTestSnapshot(null);
        setHealthHistory(null);
        setLiveHealthData({
          labs: labMarkers.map((marker) => ({ ...marker, date: new Date(marker.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) })),
          records: documents.map((document) => ({ name: document.file_name || "Untitled upload", type: document.kind === "lab" ? "Lab result" : document.kind })),
        });
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

  const healthData = testModeEnabled ? testSnapshot?.health || null : liveHealthData;

  const screens = {
    onboarding: (
      <OnboardingScreen
        onComplete={handleOnboardingComplete}
        onStepComplete={handleStepComplete}
        onFileSelected={handleFileSelected}
        initial={resumeData}
      />
    ),
    home: <HomeScreen setActive={setActive} goToMarket={goToMarket} nutritionEnabled={nutritionEnabled} userProfile={userProfile} healthHistory={healthHistory} healthData={healthData} testModeEnabled={testModeEnabled} testModeSaving={testModeSaving} onTestModeChange={handleTestModeChange} />,
    checkin: <CheckInScreen />,
    aichat: <AIChatScreen setActive={setActive} userProfile={userProfile} healthData={healthData} testModeEnabled={testModeEnabled} />,
    records: <RecordsScreen setActive={setActive} healthData={healthData} />,
    labs: <LabsScreen setActive={setActive} goToMarket={goToMarket} healthData={healthData} testModeEnabled={testModeEnabled} />,
    market: <MarketScreen highlight={marketHighlight} setActive={setActive} />,
    discussion: <DiscussionPageScreen setActive={setActive} />,
    orderlabs: <OrderLabsScreen setActive={setActive} />,
    browsesupplements: <BrowseSupplementsScreen setActive={setActive} />,
    profile: <ProfileScreen setActive={setActive} nutritionEnabled={nutritionEnabled} setNutritionEnabled={setNutritionEnabled} />,
    body: <BodyScreen setActive={setActive} />,
    importlabs: <ImportLabsScreen setActive={setActive} />,
    geneticprofile: <GeneticProfileScreen setActive={setActive} />,
    medications: <MedicationScreen setActive={setActive} />,
    preventivecare: <PreventiveCareScreen setActive={setActive} userProfile={userProfile} />,
    healthhistory: <HealthHistoryScreen setActive={setActive} onSave={(data) => { setHealthHistory(data); }} />,
  };

  const hiddenTabBar = [
    "onboarding", "discussion", "orderlabs", "browsesupplements", "body",
    "importlabs", "geneticprofile", "medications", "preventivecare", "healthhistory",
  ];
  const showTabBar = user && !hiddenTabBar.includes(active);

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
  } else if (authLoading || profileLoading) {
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

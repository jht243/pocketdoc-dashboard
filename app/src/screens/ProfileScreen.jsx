import React, { useCallback, useEffect, useState } from "react";
import { Calendar, ChevronRight, Dna, FlaskConical, Home } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import {
  disconnectOura,
  loadOuraStatus,
  startOuraConnect,
  syncOuraNow,
} from "../lib/wearableStore";
import { useAuth } from "../lib/AuthContext";
import { COLORS, SERIF } from "../theme/tokens";

/**
 * Devices other than Oura.
 *
 * `unavailable` is not a soft version of `available` — it means the integration
 * cannot be built from a web app at all, and the row says why instead of offering a
 * Connect button that could never work:
 *   Apple Health / Apple Watch  HealthKit has no cloud API. Data lives on-device and
 *                               is only reachable from a native iOS app.
 * Google Fit is absent entirely rather than listed: its API stopped accepting new
 * developers in May 2024 and reaches end-of-service in late 2026. Health Connect
 * replaced it and is Android-native only.
 */
const OTHER_DEVICES = [
  { name: "Eight Sleep", status: "available" },
  { name: "WHOOP", status: "available" },
  { name: "Garmin", status: "available" },
  { name: "Continuous glucose monitor (CGM)", status: "available" },
  { name: "Apple Watch", status: "unavailable", note: "Needs the mobile app" },
  { name: "Apple Health", status: "unavailable", note: "Needs the mobile app" },
];

function relativeTime(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs)) return null;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const NOTICE_TEXT = {
  connected: "Oura connected. Your last 30 days are syncing.",
  cancelled: "Oura connection cancelled.",
  already_linked: "That Oura account is already connected to another profile.",
  invalid_state: "That connection link expired. Try connecting again.",
  expired_state: "That connection link expired. Try connecting again.",
};

function ProfileScreen({
  setActive, nutritionEnabled, setNutritionEnabled, userProfile, healthHistory, healthData,
  testModeEnabled, ouraNotice, onOuraNoticeSeen, onWearableChange,
}) {
  const { user } = useAuth();

  // Identity is derived from the real profile — never hardcoded. Nothing about the
  // demo user ("Adam Locker") should ever appear for a real signed-in person.
  const displayName = userProfile?.profile?.name || null;
  const memberSince = userProfile?.onboardingCompletedAt
    ? new Date(userProfile.onboardingCompletedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;
  const identityParts = [displayName, memberSince ? `Member since ${memberSince}` : null].filter(Boolean);

  // Real medications/therapies the user actually entered (or the demo snapshot in
  // test mode). No pre-filled prescriptions, no invented "On TRT" status.
  const medications = userProfile?.intake?.medications || healthHistory?.medications || [];
  const conditions = userProfile?.intake?.conditions || healthHistory?.conditions || [];

  // Genetic markers are only real once a source is imported; there is no live
  // ingestion yet, so this is populated only by the demo snapshot.
  const hasGenetics = Boolean(healthData?.genetics?.length);
  const [oura, setOura] = useState(null);      // null = still loading
  const [busy, setBusy] = useState(null);      // "connect" | "sync" | "disconnect"
  const [notice, setNotice] = useState(null);

  const refreshStatus = useCallback(async () => {
    if (!user) return setOura({ connected: false });
    setOura(await loadOuraStatus(user.id));
  }, [user]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // Surface the outcome of the OAuth round-trip, then clear it in the parent so it
  // doesn't reappear on the next visit to this screen.
  useEffect(() => {
    if (!ouraNotice) return;
    setNotice(
      NOTICE_TEXT[ouraNotice.reason] ||
      NOTICE_TEXT[ouraNotice.status] ||
      "Something went wrong connecting Oura. Try again."
    );
    if (ouraNotice.status === "connected") {
      refreshStatus();
      onWearableChange?.();
    }
    onOuraNoticeSeen?.();
  }, [ouraNotice, refreshStatus, onWearableChange, onOuraNoticeSeen]);

  const handleConnect = async () => {
    setBusy("connect");
    // Navigates away to Oura on success, so `busy` is only cleared on failure.
    const { error } = await startOuraConnect("/");
    if (error) {
      setNotice("Could not start the Oura connection. Try again.");
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    const { error } = await syncOuraNow(7);
    setNotice(error ? "Sync failed. Try again shortly." : "Synced.");
    await refreshStatus();
    await onWearableChange?.();
    setBusy(null);
  };

  const handleDisconnect = async () => {
    // Deleting biometric history is not something to infer from a Disconnect tap.
    const purge = window.confirm(
      "Disconnect Oura.\n\nOK — also delete the health data already synced from it.\nCancel — keep that data and just disconnect."
    );
    setBusy("disconnect");
    const { error } = await disconnectOura({ purge });
    setNotice(error ? "Could not disconnect. Try again." : "Oura disconnected.");
    await refreshStatus();
    await onWearableChange?.();
    setBusy(null);
  };

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Home
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Your profile</div>
      {identityParts.length > 0 && (
        <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
          {identityParts.join(" · ")}
        </div>
      )}

      <SectionLabel>Genetic profile</SectionLabel>
      <button onClick={() => setActive("geneticprofile")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.gold}50`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 10
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Dna size={18} color={COLORS.gold} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
              {hasGenetics ? "View genetic markers" : "Connect genetic data"}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
              {hasGenetics
                ? "Supplement, lifestyle & pharmacogenomic markers"
                : "Not connected — import 23andMe or a clinical panel"}
            </div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <SectionLabel>Medications</SectionLabel>
      <button onClick={() => setActive("medications")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.tealLight}40`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 18
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <FlaskConical size={18} color={COLORS.tealLight} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Medications & interactions</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
              {medications.length
                ? `${medications.length} on file · check interactions`
                : "Add your prescriptions & supplements"}
            </div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <SectionLabel>Preventive care</SectionLabel>
      <button onClick={() => setActive("preventivecare")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.tealLight}40`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 18
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Calendar size={18} color={COLORS.tealLight} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Screening schedule</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Your age-based preventive care checklist</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <SectionLabel>Score settings</SectionLabel>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Track nutrition</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
              When on, nutrition becomes part of your daily score and the other categories
              adjust their weight to make room for it. When off, your daily score is built
              from sleep, training effort, and your wake-up check-in only.
            </div>
          </div>
          <button onClick={() => setNutritionEnabled(!nutritionEnabled)} style={{
            width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
            background: nutritionEnabled ? COLORS.teal : COLORS.bgCardAlt,
            position: "relative", flexShrink: 0, transition: "background 0.2s"
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 10, background: nutritionEnabled ? COLORS.onAccent : COLORS.textMuted,
              position: "absolute", top: 3, left: nutritionEnabled ? 23 : 3, transition: "left 0.2s"
            }} />
          </button>
        </div>
      </Card>

      {conditions.length > 0 && (<>
        <SectionLabel>Conditions & therapies</SectionLabel>
        <Card>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
            {conditions.join(" · ")}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
            Used to recommend relevant panels and check supplement interactions.
          </div>
        </Card>
      </>)}

      <SectionLabel>Connected devices</SectionLabel>
      <Card>
        {notice && (
          <div style={{
            fontSize: 12, color: COLORS.textSecondary, background: COLORS.bgCardAlt,
            border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "8px 10px", marginBottom: 10
          }}>{notice}</div>
        )}

        {/* Oura — the one real integration. Everything else is still a placeholder,
            and the row states which kind it is rather than implying they're equal. */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, gap: 10
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>Oura Ring</div>
            {oura?.connected && (
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                {oura.lastSyncAt ? `Synced ${relativeTime(oura.lastSyncAt)}` : "Waiting for first sync"}
                {/* The sync job running and data actually arriving are different
                    things — a ring left on the charger makes them diverge. */}
                {oura.lastDay ? ` · data through ${oura.lastDay}` : ""}
              </div>
            )}
            {oura?.status === "revoked" && (
              <div style={{ fontSize: 11, color: COLORS.warning, marginTop: 2 }}>
                Access was revoked at Oura — reconnect to resume syncing.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {oura === null ? (
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>Checking…</span>
            ) : oura.connected ? (
              <>
                <button onClick={handleSync} disabled={Boolean(busy)} style={{
                  background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 7,
                  color: COLORS.textSecondary, fontSize: 11, padding: "4px 10px",
                  cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1
                }}>{busy === "sync" ? "Syncing…" : "Sync now"}</button>
                <button onClick={handleDisconnect} disabled={Boolean(busy)} style={{
                  background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 7,
                  color: COLORS.textMuted, fontSize: 11, padding: "4px 10px",
                  cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1
                }}>{busy === "disconnect" ? "…" : "Disconnect"}</button>
              </>
            ) : (
              <button onClick={handleConnect} disabled={Boolean(busy)} style={{
                background: "none", border: `1px solid ${COLORS.tealLight}`, borderRadius: 7,
                color: COLORS.tealLight, fontSize: 11, fontWeight: 600, padding: "4px 10px",
                cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1
              }}>{busy === "connect" ? "Opening…" : oura.status === "revoked" ? "Reconnect" : "Connect"}</button>
            )}
          </div>
        </div>

        {OTHER_DEVICES.map((device, i, arr) => (
          <div key={device.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{device.name}</span>
            {device.status === "unavailable" ? (
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>{device.note}</span>
            ) : (
              <button disabled style={{
                background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 7,
                color: COLORS.textMuted, fontSize: 11, padding: "4px 10px", cursor: "default", opacity: 0.7
              }}>Coming soon</button>
            )}
          </div>
        ))}

        {testModeEnabled && (
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            Test mode is on, so the app is showing the demo snapshot. A real Oura
            connection still syncs in the background and appears when test mode is off.
          </div>
        )}
      </Card>
    </div>
  );
}

export { ProfileScreen };

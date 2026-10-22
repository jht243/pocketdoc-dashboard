import React, { useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, Copy, FileText, Share2, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, DISPLAY } from "../theme/tokens";
import { track } from "../lib/analytics";
import { getDocumentUrl } from "../lib/profileStore";
import { violatesForbiddenOutput } from "../lib/clinicalRules";
import { runAgentReview } from "../lib/agentsClient";

// ---- DISCUSSION PAGE (for next doctor appointment) ----
// The Summary and Suggested questions are written by the care team
// (agents/lib/review.mjs, briefs/advocate-visit): every specialist with data to read
// says what the member should raise, and My Advocate writes the page in the member's
// own voice under Dr. Locker's rules and the escalation lanes. When the team can't
// answer, the page says so and offers a retry; no generic text stands in.

// Belt and braces for the visit brief: a question about the app or about why data is
// missing is dropped rather than shown.
const UNACTIONABLE = /\b(?:the app|this app|thumbprint|this platform)\b|\b(?:why|reasons?)\b[^?]*\b(?:lack|missing|absence|no recent|haven'?t|have not|don'?t have)\b/i;

function actionableQuestions(list) {
  const kept = (Array.isArray(list) ? list : [])
    .map((q) => String(q || "").trim())
    .filter((q) => q && !UNACTIONABLE.test(q))
    .slice(0, 4);
  return kept;
}

function DiscussionPageScreen({ setActive, goBack, backLabel, userProfile, healthData, healthHistory }) {
  // "copied" | "copy-failed" | null — what the copy button last did, said in words.
  const [shareStatus, setShareStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [summary, setSummary] = useState(null);
  const [questions, setQuestions] = useState([]);

  const hasRealData = Boolean(userProfile?.profile || healthData?.today || healthData?.labs?.length);

  // Device signals derived only from real vitals. No fabricated Oura/Eight Sleep
  // readings for users who have no device connected — the section simply hides.
  const today = healthData?.today;
  const deviceSignals = today
    ? [
        today.restingHR != null && {
          label: "Resting heart rate",
          detail: `${today.restingHR} bpm (baseline ${today.restingHRBaseline})`,
          source: "Device",
        },
        today.hrv != null && {
          label: "HRV",
          detail: `${today.hrv}ms (baseline ${today.hrvBaseline})`,
          source: "Device",
        },
        today.skinTempDeviation != null && {
          label: "Overnight body temp",
          detail: `${today.skinTempDeviation > 0 ? "+" : ""}${today.skinTempDeviation}°F vs. baseline`,
          source: "Device",
        },
        today.readiness != null && {
          label: "Readiness",
          detail: `${today.readiness} (typical ${today.readinessTypical})`,
          source: "Device",
        },
      ].filter(Boolean)
    : [];

  // Only the user's own recorded symptoms — never a demo list.
  const symptomPattern =
    today?.recentSymptoms?.length
      ? today.recentSymptoms.map((note) => ({ date: "Recent", note }))
      : [];

  // Files to share are the user's real uploaded records. Nothing is shown until they
  // have actually uploaded something.
  const privateLabFiles = (healthData?.records || []).map((r) => ({
    name: r.name,
    source: r.type,
    storagePath: r.storagePath || null,
  }));

  // Each file opens in a new tab through a short-lived signed link (the bucket is
  // private). The tab is opened inside the tap, before the link arrives, so a
  // pop-up blocker treats it as the member's own action.
  const openFile = async (f) => {
    if (!f.storagePath) return;
    const tab = window.open("", "_blank");
    const url = await getDocumentUrl(f.storagePath);
    if (url && tab) tab.location.href = url;
    else if (tab) tab.close();
  };

  useEffect(() => {
    if (!hasRealData) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const page = await runAgentReview({ task: "discussion", userProfile, healthData, healthHistory });
        // The service has checked every line against the record and the rules; the
        // forbidden list runs once more here because this page is handed across a desk.
        const kept = actionableQuestions(page?.questions);
        const written = [page?.summary, ...kept].filter(Boolean).join("\n");
        if (cancelled) return;
        if (!page?.summary || violatesForbiddenOutput(written)) { setFailed(true); return; }
        setSummary(String(page.summary).trim());
        setQuestions(kept);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      // A superseded run must not leave "Preparing…" pinned on: its own
      // setLoading(false) is skipped via the cancelled guard (so it can't stomp a
      // newer run's spinner), so clear it here — a newer run re-sets it itself.
      cancelled = true;
      setLoading(false);
    };
  }, [hasRealData, userProfile, healthData, attempt]);

  const ready = Boolean(summary) && !loading;

  // The text Copy and Share hand over: the summary and the suggested questions, as
  // plain text that reads correctly when pasted into an email, a text or a note.
  const shareText = () => [
    "Discussion page: for my next appointment",
    "",
    "Summary",
    summary,
    "",
    "Questions to raise",
    ...questions.map((q, i) => `${i + 1}. ${q}`),
  ].join("\n");

  // Web Share is a phone feature; most desktop browsers lack it, and there the
  // Share button simply isn't shown.
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copySummary = async () => {
    track("discussion_export");
    const text = shareText();
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // No clipboard API (older browsers, non-HTTPS) or permission refused: fall back
      // to copying from a hidden text box, which every browser still supports.
      try {
        const box = document.createElement("textarea");
        box.value = text;
        box.setAttribute("readonly", "");
        box.style.position = "fixed";
        box.style.opacity = "0";
        document.body.appendChild(box);
        box.select();
        ok = document.execCommand("copy");
        document.body.removeChild(box);
      } catch {
        ok = false;
      }
    }
    setShareStatus(ok ? "copied" : "copy-failed");
  };

  const shareSummary = async () => {
    track("discussion_export");
    try {
      await navigator.share({ title: "Discussion page", text: shareText() });
    } catch {
      // Closing the share sheet rejects too; there is nothing to report.
    }
  };

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={goBack} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> {backLabel}
      </button>

      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>Discussion page</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
        For your next appointment
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 22 }}>
        A summary of what's been reported, the pattern across it, and private labs to share.
      </div>

      <SectionLabel>Summary</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.accent}50`, background: COLORS.accentDim }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Sparkles size={18} color={COLORS.accent} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
            {loading
              ? "Your care team is preparing your summary from your latest data. This takes about a minute…"
              : failed || !summary
                ? (hasRealData ? "Your care team couldn't prepare your summary just now." : "Add your health history or a lab result, and your care team will prepare this page for your visit.")
                : summary}
            {failed && !loading && (
              <button onClick={() => setAttempt((n) => n + 1)} style={{
                display: "block", marginTop: 8, background: "none", border: "none", padding: 0,
                color: COLORS.accent, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>Try again</button>
            )}
            {/* The generated summary speaks as the member; say so, so it reads as
                theirs to use rather than as the app describing them. */}
            {ready && (
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>
                Written in your words, to read or show your clinician.
              </div>
            )}
          </div>
        </div>
      </Card>

      {symptomPattern.length > 0 && (<>
        <SectionLabel>Reported symptom pattern</SectionLabel>
        <Card>
          {symptomPattern.map((s, i) => (
            <div key={`${s.date}-${i}`} style={{
              display: "flex", gap: 12, padding: "9px 0",
              borderBottom: i < symptomPattern.length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted, width: 48, flexShrink: 0 }}>{s.date}</span>
              <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{s.note}</span>
            </div>
          ))}
        </Card>
      </>)}

      {deviceSignals.length > 0 && (<>
        <SectionLabel>Device signals</SectionLabel>
        <Card>
          {deviceSignals.map((w, i) => (
            <div key={w.label} style={{
              display: "flex", justifyContent: "space-between", padding: "9px 0",
              borderBottom: i < deviceSignals.length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <div>
                <span style={{ fontSize: 13 }}>{w.label}</span>
                <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 6 }}>({w.source})</span>
              </div>
              <span style={{ fontSize: 12, color: COLORS.warning }}>{w.detail}</span>
            </div>
          ))}
        </Card>
      </>)}

      {ready && questions.length > 0 && <SectionLabel>Suggested questions to raise</SectionLabel>}
      {ready && questions.length > 0 && <Card>
        {questions.map((q, i, arr) => (
          <div key={i} style={{
            display: "flex", gap: 8, padding: "9px 0",
            borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 13, color: COLORS.accent, flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>{q}</span>
          </div>
        ))}
      </Card>}

      {privateLabFiles.length > 0 && (<>
        <SectionLabel>Lab files to share</SectionLabel>
        <Card>
          {privateLabFiles.map((f, i) => (
            <button key={`${f.name}-${i}`} type="button" onClick={() => openFile(f)} disabled={!f.storagePath} style={{
              all: "unset", boxSizing: "border-box", width: "100%", cursor: f.storagePath ? "pointer" : "default",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < privateLabFiles.length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <FileText size={16} color={COLORS.tealLight} />
                <div>
                  <div style={{ fontSize: 13 }}>{f.name}</div>
                  {f.source && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{f.source}</div>}
                </div>
              </div>
              {f.storagePath && <span style={{ fontSize: 11, color: COLORS.tealLight, fontWeight: 600 }}>Open</span>}
            </button>
          ))}
        </Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
          Your uploaded records. Tap one to open it, then show or send it at your appointment.
        </div>
      </>)}

      {/* Copy and Share hand over the same plain text: the summary and the questions.
          There is no PDF, email or print step — the member pastes or sends it
          wherever they like. Both wait until the real summary has loaded, so the
          placeholder text can't be what gets shared. */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={copySummary} disabled={!ready} style={{
          flex: 1, background: COLORS.teal, border: "none", color: COLORS.onAccent,
          fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12,
          cursor: !ready ? "default" : "pointer", opacity: !ready ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}>
          {shareStatus === "copied" ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          {shareStatus === "copied" ? "Copied" : "Copy summary"}
        </button>
        {canShare && (
          <button onClick={shareSummary} disabled={!ready} style={{
            flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.tealLight}`, color: COLORS.tealLight,
            fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12,
            cursor: !ready ? "default" : "pointer", opacity: !ready ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}>
            <Share2 size={16} /> Share
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: shareStatus === "copy-failed" ? COLORS.danger : COLORS.textMuted, marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
        {shareStatus === "copied"
          ? "The summary and questions are on your clipboard. Paste them into a message or a note for your visit."
          : shareStatus === "copy-failed"
            ? "Couldn't copy automatically. Select the summary and questions above and copy them by hand."
            : canShare
              ? "Copies the summary and suggested questions as text, or sends them to another app on your phone."
              : "Copies the summary and suggested questions as text you can paste into a message or note."}
      </div>

      <div style={{
        marginTop: 20, padding: 12, background: COLORS.bgCardAlt, borderRadius: 10,
        fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5
      }}>
        This page summarizes patterns in your reported symptoms and data. It is not a
        diagnosis and does not replace clinical judgment. Only a licensed provider can
        diagnose or treat a medical condition.
      </div>
    </div>
  );
}

export { DiscussionPageScreen };

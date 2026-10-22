import React, { useState, useEffect, useRef, useCallback } from "react";
import { Archive, Camera, ExternalLink, Mic, Send, Trash2, X } from "lucide-react";
import { COLORS, DISPLAY } from "../theme/tokens";
import { useAuth } from "../lib/AuthContext";
import { rankCitations, sourceCaveat } from "../lib/sourceQuality";
import {
  appendMessage, archiveConversation, chatImageBase64, chatImageUrl, clearConversation, listArchived,
  loadMessages, restoreConversation, threadTitle, uploadChatImage,
} from "../lib/chatStore";
import { ArchivedChats } from "../components/ArchivedChats";
import { startingPrompts } from "../lib/chatPrompts";
import { openFollowUps } from "../lib/followUpStore";
import { runAgentTeam } from "../lib/agentsClient";
import { CareTeamCard, AdvocateByline, CARE_TEAM_CSS } from "../components/CareTeam";
import { RichReply } from "../components/RichReply";
import { takeQueuedChatQuestion } from "../lib/chatHandoff";

// Replaying the thread on every turn is what gives the conversation its memory,
// but the thread is now permanent, so an unbounded replay would grow the request
// forever and eventually push the user's own labs out of the context window.
// Images are capped harder than text: one costs far more than a message, and an
// old photo is rarely what the current question is about.
const MAX_CONTEXT_MESSAGES = 30;
const MAX_CONTEXT_IMAGES = 2;

// The web-search model writes markdown. Headings, bold, lists and tables are kept
// for RichReply to render; what is stripped is the inline citation noise
// ("([domain](url))", [1] markers), because sources are shown as chips below the
// message.
function cleanReply(text) {
  return String(text || "")
    .replace(/\s*\(\[[^\]]+\]\([^)]+\)\)/g, "")   // drop "([label](url))" citation groups
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")        // remaining [label](url) -> label
    .replace(/\s*\[\d+\](?!\()/g, "")                // orphan [1] footnote markers
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Browsers do not run smooth-scroll animations in a background tab, so a smooth
// scroll requested there never moves. Jump instead when nobody is watching.
const scrollBehavior = () => (document.visibilityState === "visible" ? "smooth" : "auto");

// ---- AI CHAT SCREEN ----
// The member's chat. Their full health profile is injected as context, so answers are
// grounded in their own data and established guidelines; no live web search.
function AIChatScreen({ setActive, userProfile, healthData, healthHistory, onMemberMessage }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);        // base64 for this session's send
  const [imageFile, setImageFile] = useState(null); // the file itself, for storage
  const [imagePreview, setImagePreview] = useState(null);
  const [listening, setListening] = useState(false);
  const [apptPrompt, setApptPrompt] = useState(null); // detected appointment info
  const [clearing, setClearing] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [showArchive, setShowArchive] = useState(false);
  // Test-mode-era messages fold away behind a note; the member can still open them.
  const [showTestMode, setShowTestMode] = useState(false);
  const testModeCount = messages.filter((m) => m.fromTestMode).length;
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Detect appointment mentions in user messages and offer to build a Discussion Page
  const detectAppointment = (text) => {
    const apptPattern = /(?:doctor|dr\.?|physician|appointment|visit|see(?:ing)? my|specialist|endocrin|cardio|oncol|neurol|dermatol)/i;
    const datePattern = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|next week|tomorrow|\d{1,2}(?:st|nd|rd|th)?)/i;
    return apptPattern.test(text) && datePattern.test(text);
  };

  const suggestions = startingPrompts(healthData, userProfile);

  // The conversation belongs to the member, not the session. Reload the stored
  // thread on mount so leaving the screen — or the app — never costs them the
  // context they were working in.
  const loadThread = async () => {
    const stored = await loadMessages(user.id);
    // Photos sit in a private bucket, so each needs a freshly signed URL to render.
    return Promise.all(stored.map(async (m) => (
      m.imagePath ? { ...m, imageUrl: await chatImageUrl(m.imagePath) } : m
    )));
  };
  const countArchived = () => user && listArchived(user.id).then((list) => setArchivedCount(list.length));
  useEffect(() => {
    let cancelled = false;
    if (!user) { setHistoryLoading(false); return; }
    (async () => {
      const hydrated = await loadThread();
      if (!cancelled) {
        setMessages(hydrated);
        setHistoryLoading(false);
      }
    })();
    countArchived();
    return () => { cancelled = true; };
    // Keyed on the id, not the user object: Supabase hands out a new object on every
    // token refresh and tab refocus, and reloading history then wiped the live
    // care-team turn mid-answer, leaving the member staring at dots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // A reply that just arrived is scrolled to its top, so the member starts reading
  // at the first line instead of landing at the end of a long answer. Everything
  // else (their own message, the live care-team card, a reloaded thread) follows
  // the bottom as before.
  const placedReply = useRef(null);
  const openedAtEnd = useRef(false);
  // True while a care-team round is still playing, so a follow-scroll queued
  // during it can tell, when it finally runs, whether it is still wanted.
  const followingLive = useRef(false);
  useEffect(() => {
    followingLive.current = messages.some(m => m.animate && (m.pending || (m.team?.length && !m.revealed)));
    // Opening the chat jumps straight to the newest message. Animating down a long
    // thread is slow, and it is cut short if anything else scrolls meanwhile.
    if (!openedAtEnd.current) {
      if (historyLoading) return;
      openedAtEnd.current = true;
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }
    const i = messages.length - 1;
    const last = messages[i];
    const arrived = last?.role === "assistant" && (last.localId || last.fresh) && !last.pending
      && !(last.team?.length && last.animate && !last.revealed);
    if (arrived) {
      const key = last.localId || `reply-${i}`;
      if (placedReply.current !== key) {
        placedReply.current = key;
        document.querySelector(`[data-msg="${i}"]`)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      }
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: scrollBehavior() });
  }, [messages, loading, historyLoading]);

  // The care-team card grows as it reveals each step without the message list
  // changing, so it asks for the scroll itself. Throttled to one frame.
  const growFrame = useRef(0);
  // A frame requested while the tab is in the background only runs when it next
  // paints, which can be after the reply has landed, so it rechecks that the round
  // is still playing rather than dragging the member past the answer's first line.
  const followTeam = useCallback(() => {
    if (growFrame.current) return;
    growFrame.current = requestAnimationFrame(() => {
      growFrame.current = 0;
      if (!followingLive.current) return;
      bottomRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "end" });
    });
  }, []);

  // A live team card holds its reply back until the last step has played, so the
  // answer lands after the safety review rather than on top of it.
  const markRevealed = useCallback((localId) => {
    setMessages(prev => prev.map(m => (m.localId === localId ? { ...m, revealed: true } : m)));
  }, []);

  const clearThread = async () => {
    if (!user || !messages.length || clearing) return;
    const ok = window.confirm(
      "Delete this conversation for good? Your health data stays — only the chat is removed. To keep it, archive it instead."
    );
    if (!ok) return;
    setClearing(true);
    await clearConversation(user.id);
    setMessages([]);
    setApptPrompt(null);
    setClearing(false);
  };

  // Archive: the thread leaves the screen and the advocate's replay, but is kept and
  // can be read or restored from Archived chats. Delete stays for removing it for good.
  const archiveThread = async ({ ask = true } = {}) => {
    if (!user || !messages.length || clearing || loading) return false;
    if (ask && !window.confirm(
      "Archive this conversation? It's kept under Archived chats, where you can read or restore it any time. Your advocate starts fresh."
    )) return false;
    setClearing(true);
    const { error } = await archiveConversation(user.id, threadTitle(messages));
    setClearing(false);
    if (error) {
      window.alert("Couldn't archive this conversation. Please try again.");
      return false;
    }
    setMessages([]);
    setApptPrompt(null);
    countArchived();
    return true;
  };

  // The open thread is archived first, so a restore never merges two conversations.
  const restoreThread = async (conversationId) => {
    if (!user || loading) return false;
    if (messages.length) {
      if (!window.confirm("Restore this conversation? Your current one will be archived so this one can take its place.")) return false;
      if (!(await archiveThread({ ask: false }))) return false;
    }
    const { error } = await restoreConversation(user.id, conversationId);
    if (error) {
      window.alert("Couldn't restore this conversation. Please try again.");
      return false;
    }
    setMessages(await loadThread());
    countArchived();
    return true;
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(",")[1];
      setImage(base64);
      setImageFile(file);
      setImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input isn't supported in this browser. Try Chrome or Safari.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // The tail of the thread, in the shape the gateway expects. Photos uploaded in
  // an earlier session are no longer in memory, so they are pulled back out of
  // storage — the whole point of storing them rather than holding base64 in state.
  const buildApiMessages = async (thread) => {
    // Test-mode-era turns quote the removed demo profile, so they never reach the team.
    const windowed = thread.filter(m => !m.fromTestMode).slice(-MAX_CONTEXT_MESSAGES).filter(m => !m.error);
    const withImages = windowed.filter(m => m.imageBase64 || m.imagePath).slice(-MAX_CONTEXT_IMAGES);
    const out = [];
    for (const m of windowed) {
      const content = [];
      if (m.role === "user" && withImages.includes(m)) {
        const data = m.imageBase64 || await chatImageBase64(m.imagePath);
        if (data) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
      }
      if (m.text) content.push({ type: "text", text: m.text });
      if (!content.length) continue;
      out.push({ role: m.role, content: content.length === 1 && content[0].type === "text" ? content[0].text : content });
    }
    return out;
  };

  const send = async (text) => {
    const userText = text || input.trim();
    if (!userText && !image) return;
    const pendingFile = imageFile;
    const userMsg = { role: "user", text: userText, imageUrl: imagePreview, imageBase64: image };
    const thread = [...messages, userMsg];
    setMessages(thread);
    setInput("");
    setImagePreview(null);
    setImageFile(null);
    // Detect appointment mentions and surface Discussion Page prompt
    if (userText && detectAppointment(userText) && !apptPrompt) {
      setApptPrompt(userText);
    }
    setLoading(true);

    const localId = `team-${Date.now()}`;
    const live = [];
    // Upsert rather than map: if anything replaces the message list mid-round,
    // the live turn is put back instead of silently going missing.
    const patchLive = (patch) => setMessages(prev => (
      prev.some(m => m.localId === localId)
        ? prev.map(m => (m.localId === localId ? { ...m, ...patch } : m))
        : [...prev, { role: "assistant", localId, pending: true, animate: true, text: "", team: [], ...patch }]
    ));
    // Up before the database write, so the card is there the moment they hit send.
    patchLive({ team: [{ type: "route_start", t: 0 }] });

    // Store the photo before the row that points at it, so a message can never
    // reference an object whose upload failed.
    let imagePath = null;
    if (pendingFile && user) {
      const { path } = await uploadChatImage(user.id, pendingFile);
      imagePath = path;
    }
    // Written now rather than after the reply lands: a member who navigates away
    // mid-answer should still find their question waiting when they come back.
    const savedQuestion = user ? await appendMessage(user.id, { role: "user", text: userText, imagePath }) : null;
    // The stored question's id goes with the round, so the safety and routing logs
    // can point the medical director at the exact message.
    const messageId = savedQuestion?.id || null;
    // What the member just said is data, not only conversation — a newly described
    // symptom should reach the insight cards on this turn rather than at the next
    // lab import. Fired once the reply is in: AI calls run one at a time, and the
    // insight refresh queued ahead of the care team held the whole round up.
    const refreshInsights = () => { if (user) onMemberMessage?.(); };

    const apiMessages = await buildApiMessages(thread);

    // Every question goes to the care team, photos included: the service describes a
    // photo first and the team answers under the same rules as any other question.
    // An older photo still in the window is dropped from the team's copy of the thread.
    const textThread = apiMessages
      .map(m => (Array.isArray(m.content)
        ? { ...m, content: m.content.filter(c => c.type === "text").map(c => c.text).join("\n") }
        : m))
      .filter(m => m.content);
    const onEvent = (e) => {
      live.push(e);
      patchLive({ team: [...live] });
    };
    try {
      // No browser fallback (Oct 21 2026): an answer the team didn't write, under
      // rules it didn't run, is not shown. A failure says so and the member retries.
      const out = await runAgentTeam({
        question: userText,
        history: textThread.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        userProfile,
        healthData,
        healthHistory,
        onEvent,
        messageId,
        image: image || null,
      });
      const reply = cleanReply(out.reply);
      const ranked = rankCitations(out.citations);
      patchLive({ pending: false, text: reply, citations: ranked, team: out.events });
      if (user) await appendMessage(user.id, { role: "assistant", text: reply, citations: ranked, team: out.events });
      // A marker the answer put in "Bring this to your provider" becomes an open
      // follow-up the morning check-in asks about at 30 and 60 days. After the
      // reply is on screen and stored, and never in its way.
      if (user && out.lanes?.length) openFollowUps(user.id, out.lanes).catch((err) => console.warn("openFollowUps", err));
    } catch (err) {
      console.error("Care team request failed", err);
      const text = `Your care team couldn't answer just now. Please try again in a moment.\n\n(${err?.message || "Unknown error"})`;
      patchLive({ pending: false, animate: false, team: [], text, error: true });
      if (user) await appendMessage(user.id, { role: "assistant", text, error: true });
    }
    setImage(null);
    setLoading(false);
    refreshInsights();
  };

  // A question another screen asked on the member's behalf (Home's "Help me reduce
  // my biological age"), sent once their thread has loaded so it follows it.
  useEffect(() => {
    if (historyLoading) return;
    const queued = takeQueuedChatQuestion();
    if (queued) send(queued);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: COLORS.bgDeep }}>
      {showArchive && user && (
        <ArchivedChats
          userId={user.id}
          onClose={() => setShowArchive(false)}
          onRestore={restoreThread}
          onChanged={countArchived}
          onNavigate={(screen) => { setShowArchive(false); setActive(screen); }}
        />
      )}
      {/* Header */}
      <div style={{
        padding: "36px 18px 14px", borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>Talk to your team</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
            My Advocate and a team of specialists, working from your data.
          </div>
          {archivedCount > 0 && (
            <button onClick={() => setShowArchive(true)} style={{
              marginTop: 6, background: "none", border: "none", padding: 0, cursor: "pointer",
              color: COLORS.tealLight, fontSize: 12, fontWeight: 600,
            }}>Archived chats ({archivedCount})</button>
          )}
        </div>
        {/* Permanent by default: archived or deleted only on request — the member owns the thread. */}
        {messages.length > 0 && (
          <button onClick={() => archiveThread()} disabled={clearing || loading} aria-label="Archive conversation" title="Archive conversation" style={{
            background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10,
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: clearing || loading ? "default" : "pointer", flexShrink: 0, opacity: clearing || loading ? 0.5 : 1,
          }}>
            <Archive size={15} color={COLORS.textSecondary} />
          </button>
        )}
        {messages.length > 0 && (
          <button onClick={clearThread} disabled={clearing} aria-label="Delete conversation" title="Delete conversation" style={{
            background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10,
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: clearing ? "default" : "pointer", flexShrink: 0, opacity: clearing ? 0.5 : 1,
          }}>
            <Trash2 size={15} color={COLORS.textSecondary} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: "16px 14px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
        {!historyLoading && messages.length === 0 && (
          <div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: "center", marginBottom: 16 }}>
              Start with a question or try one of these
            </div>
            {suggestions.map(p => (
              <button key={p} onClick={() => send(p)} style={{
                width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: "10px 14px", textAlign: "left", cursor: "pointer",
                color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, lineHeight: 1.4
              }}>{p}</button>
            ))}
          </div>
        )}

        {testModeCount > 0 && (
          <div style={{
            alignSelf: "stretch", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: "10px 12px", fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5,
          }}>
            {testModeCount} earlier message{testModeCount === 1 ? "" : "s"} came from Test mode, which showed a sample profile instead of your own records. It was removed on Oct 18, and your advocate no longer reads them.
            <button onClick={() => setShowTestMode((v) => !v)} style={{
              display: "block", marginTop: 6, background: "none", border: "none", padding: 0,
              color: COLORS.tealLight, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>{showTestMode ? "Hide them" : "Show them"}</button>
          </div>
        )}

        {messages.map((m, i) => (showTestMode || !m.fromTestMode) && (
          <div key={i} data-msg={i} style={{
            scrollMarginTop: 12,
            display: "flex", flexDirection: "column",
            alignItems: m.role === "user" ? "flex-end" : "flex-start"
          }}>
            {m.imageUrl && (
              <img src={m.imageUrl} alt="uploaded" style={{
                maxWidth: 200, borderRadius: 12, marginBottom: 6, alignSelf: "flex-end"
              }} />
            )}
            {m.role === "assistant" && m.team?.length > 0 && (
              <div style={{ width: "100%", marginBottom: 8, display: "flex" }}>
                <CareTeamCard
                  events={m.team}
                  animate={!!m.animate}
                  onGrow={m.animate ? followTeam : undefined}
                  onRevealed={m.animate ? () => markRevealed(m.localId) : undefined}
                />
              </div>
            )}
            {/* A live team reply waits for its card to finish playing. */}
            {!(m.team?.length && m.animate && (m.pending || !m.revealed)) && (<>
            {m.role === "assistant" && m.team?.length > 0 && <AdvocateByline />}
            <div style={{
              maxWidth: m.role === "assistant" ? "92%" : "84%", padding: "10px 14px", borderRadius: 16,
              borderBottomRightRadius: m.role === "user" ? 4 : 16,
              borderBottomLeftRadius: m.role === "assistant" ? 4 : 16,
              background: m.role === "user" ? COLORS.teal : COLORS.bgCard,
              color: m.role === "user" ? COLORS.onAccent : COLORS.textPrimary,
              fontSize: 13, lineHeight: 1.6,
            }}>
              {m.role === "assistant"
                ? (m.error ? <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div> : <RichReply text={m.text} onNavigate={setActive} />)
                : m.text}
            </div>
            {/* Web-research citations */}
            {m.role === "assistant" && m.citations && m.citations.length > 0 && (
              <div style={{ maxWidth: "84%", marginTop: 6 }}>
                {/* Said plainly when nothing authoritative backs the answer. A weak
                    source shown in the same chip as a guideline reads as equally
                    solid, which is exactly the impression to avoid on health claims. */}
                {sourceCaveat(m.citations) && (
                  <div style={{
                    fontSize: 10.5, lineHeight: 1.45, color: COLORS.textMuted,
                    marginBottom: 5, fontStyle: "italic",
                  }}>
                    {sourceCaveat(m.citations)}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {m.citations.slice(0, 5).map((c, ci) => {
                    const weak = (c.tier ?? 3) === 3;
                    return (
                      <a key={ci} href={c.url} target="_blank" rel="noopener noreferrer" style={{
                        display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none",
                        background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 999,
                        padding: "3px 9px", fontSize: 10.5,
                        color: weak ? COLORS.textMuted : COLORS.tealLight, maxWidth: 220,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>
                        <ExternalLink size={10} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
            </>)}
          </div>
        ))}

        {loading && !messages.some(m => m.pending) && (
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{
              background: COLORS.bgCard, borderRadius: 16, borderBottomLeftRadius: 4,
              padding: "10px 14px", display: "flex", gap: 4, alignItems: "center"
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: 3, background: COLORS.textMuted,
                  animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`
                }} />
              ))}
            </div>
          </div>
        )}
        {/* The input bar is sticky over the bottom of this list, so scrolling the
            marker flush to the edge left the newest line hidden behind it. */}
        <div ref={bottomRef} style={{ scrollMarginBottom: 96 }} />
      </div>

      {/* Appointment detection nudge */}
      {apptPrompt && (
        <div style={{
          margin: "0 14px", padding: 12, background: COLORS.accentDim,
          border: `1px solid ${COLORS.accent}50`, borderRadius: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, marginBottom: 2 }}>
              Appointment detected
            </div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
              Your Discussion Page can be prepared with a summary of current symptoms, labs, and questions to raise.
            </div>
          </div>
          <button onClick={() => setActive("discussion")} style={{
            background: COLORS.accent, border: "none", color: COLORS.onAccent,
            fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 8, cursor: "pointer", flexShrink: 0
          }}>Open</button>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div style={{ padding: "8px 14px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <img src={imagePreview} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
          <button onClick={() => { setImagePreview(null); setImage(null); setImageFile(null); }} style={{
            background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted
          }}><X size={16} /></button>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Photo attached</span>
        </div>
      )}

      {/* Input bar with voice button */}
      <div style={{
        position: "sticky", bottom: 0,
        padding: "10px 14px 20px", borderTop: `1px solid ${COLORS.border}`,
        background: COLORS.bgCard, display: "flex", gap: 8, alignItems: "center",
      }}>
        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImage} style={{ display: "none" }} />
        <button onClick={() => fileInputRef.current?.click()} style={{
          background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", flexShrink: 0
        }}>
          <Camera size={16} color={COLORS.textSecondary} />
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder={listening ? "Listening..." : "Ask anything about your health..."}
          style={{
            flex: 1, background: listening ? `${COLORS.teal}20` : COLORS.bgCardAlt,
            border: `1px solid ${listening ? COLORS.teal : COLORS.border}`,
            borderRadius: 10, padding: "9px 12px", color: COLORS.textPrimary,
            fontSize: 13, outline: "none", transition: "all 0.2s"
          }}
        />
        <button onClick={toggleVoice} style={{
          background: listening ? COLORS.teal : COLORS.bgCardAlt,
          border: listening ? "none" : `1px solid ${COLORS.border}`,
          borderRadius: 10, width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0
        }}>
          <Mic size={16} color={listening ? COLORS.onAccent : COLORS.textSecondary} />
        </button>
        <button onClick={() => send()} disabled={!input.trim() && !image} style={{
          background: (!input.trim() && !image) ? COLORS.bgCardAlt : COLORS.teal,
          border: "none", borderRadius: 10, width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: (!input.trim() && !image) ? "default" : "pointer", flexShrink: 0
        }}>
          <Send size={16} color={(!input.trim() && !image) ? COLORS.textMuted : COLORS.onAccent} />
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }${CARE_TEAM_CSS}`}</style>
    </div>
  );
}

export { AIChatScreen };

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, ExternalLink, Mic, Send, Trash2, X } from "lucide-react";
import { COLORS, DISPLAY } from "../theme/tokens";
import { callAI, firstText, firstCitations } from "../lib/api";
import { buildHealthContext } from "../lib/healthContext";
import { useAuth } from "../lib/AuthContext";
import { rankCitations, sourceCaveat } from "../lib/sourceQuality";
import {
  appendMessage, chatImageBase64, chatImageUrl, clearConversation, loadMessages, uploadChatImage,
} from "../lib/chatStore";
import { runCareTeam } from "../lib/careTeam";
import { CareTeamCard, AdvocateByline, CARE_TEAM_CSS } from "../components/CareTeam";
import { RichReply } from "../components/RichReply";

// Live research now comes from the hosted web-search tool in the gateway, not from
// a special model id: the old `gpt-4o-search-preview` chat models were deprecated by
// OpenAI and started returning 404, which broke every text message in this screen.
// The vision model handles image messages (a photo can't be answered by a search).
const CHAT_MODEL = import.meta.env.VITE_AI_CHAT_MODEL || "gpt-4.1";
const VISION_MODEL = import.meta.env.VITE_AI_VISION_MODEL || "gpt-4o";

// Replaying the thread on every turn is what gives the conversation its memory,
// but the thread is now permanent, so an unbounded replay would grow the request
// forever and eventually push the user's own labs out of the context window.
// Images are capped harder than text: one costs far more than a message, and an
// old photo is rarely what the current question is about.
const MAX_CONTEXT_MESSAGES = 30;
const MAX_CONTEXT_IMAGES = 2;

// The persona: a functional-medicine expert who does live research and gives
// specific, useful, data-grounded guidance — not a hedging "ask your doctor" bot.
const PERSONA = `You are Thumbprint Health — the member's own personal Healthcare Advocate (they know you as "My Advocate"), a knowledgeable functional-medicine health companion who works for them and coordinates a team of specialist advocates on their behalf. Speak as their advocate: on their side, in the first person. You think like a functional-medicine practitioner: you look for root causes and connect labs, symptoms, lifestyle, medications, and genetics into a clear picture, then give specific, research-backed, actionable guidance tailored to THIS person's data.

How you answer:
- Be genuinely useful and direct. Give concrete recommendations — specific supplements and typical dosage ranges, lifestyle and nutrition changes, which labs to run next, and how to interpret a result — grounded in current research and the user's own data. Do NOT deflect with a vague "ask your doctor"; give the substance.
- Do live research. When a question benefits from current evidence, guidelines, recent studies, or specific products, search the web and cite your sources. Prefer recent, reputable sources (peer-reviewed research, major clinical guidelines, .gov/.edu and established medical organizations). Don't rely on stale training knowledge for anything time-sensitive.
- Name a source in the sentence itself ("the 2024 USPSTF guideline", "a 2023 meta-analysis in JAMA"). Never write bare footnote markers like [1] or [2] — the app shows real sources as links below your reply, so a bracketed number with nothing behind it just looks like an invented citation.
- Source hierarchy, in order. Work down it and stop at the first level that actually answers the question:
  1. Peer-reviewed research and clinical guidelines — PubMed, Cochrane, NEJM/JAMA/Lancet/BMJ, USPSTF, and government or university sources (.gov, .edu, WHO, NICE, FDA labelling).
  2. Established medical organizations and professionally edited references — Mayo Clinic, Cleveland Clinic, the relevant specialty society, Merck Manuals, Drugs.com.
  3. Anything else, and only if 1 and 2 genuinely have nothing.
- The fallback rule: if no level-1 or level-2 source exists for the question, say so in the answer itself — "there's no guideline-level evidence on this; what's available is X" — and give your best read of the weaker material. Never dress a blog, a supplement retailer, or an SEO content site up as authority, and never let a thin evidence base go unmentioned.
- Always ground answers in the user's actual data below (labs and their trends, medications, conditions, genetics, goals). Generic advice that ignores their profile is a failure.
- Be concise and structured: lead with the answer, then the reasoning, then next steps.
- Formatting: the reply is shown on a phone. Use short "## " headings, **bold** for key values, and "- " bullet lists. Use a markdown table only for genuinely tabular data (e.g. tests, how often, why), with at most 4 columns and short cells. Never wrap the reply in a code block.

Safety — keep it light and never let it stop you from being useful:
- This is educational information personalized to the user's data, not a formal diagnosis or a prescription.
- For anything urgent or severe (chest pain, stroke signs, severe symptoms, suicidal thoughts, etc.), tell them to seek in-person or emergency care.
- Before starting/stopping a prescription or making a major dose change, tell them to confirm with their prescriber — but still give them the substantive information and the specific questions to bring.`;

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
// Functional-medicine chat. The user's full health profile is injected as context and
// the web-search model does live research (with citations) so answers are current and
// grounded in the user's actual data — not generic, stale wellness advice.
function AIChatScreen({ setActive, userProfile, healthData, healthHistory, testModeEnabled, onMemberMessage }) {
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
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Detect appointment mentions in user messages and offer to build a Discussion Page
  const detectAppointment = (text) => {
    const apptPattern = /(?:doctor|dr\.?|physician|appointment|visit|see(?:ing)? my|specialist|endocrin|cardio|oncol|neurol|dermatol)/i;
    const datePattern = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|next week|tomorrow|\d{1,2}(?:st|nd|rd|th)?)/i;
    return apptPattern.test(text) && datePattern.test(text);
  };

  // Every input the app holds — intake answers, labs and their trends, all synced
  // wearable metrics, genetics, preventive-care schedule, records — is assembled in
  // one place so a newly collected field can never reach a screen but miss the chat.
  const healthContext = buildHealthContext({ userProfile, healthData, healthHistory, testModeEnabled });
  const healthProfile = [
    PERSONA,
    // Before onboarding there is nothing to ground an answer in, so say so rather
    // than handing the model a page of "(none recorded)" and hoping it notices.
    userProfile?.profile
      ? null
      : "The user hasn't completed their health profile yet. Ask a couple of concise questions to get their goals and current situation, and still answer what they ask usefully with current research.",
    healthContext,
  ].filter(Boolean).join("\n\n");

  const startingPrompts = healthData ? [
    "My readiness is low today — should I still train?",
    "What should I discuss with my doctor about my thyroid trend?",
    "How does my vitamin D result fit my overall profile?",
    "I have a doctor appointment next Tuesday",
  ] : [
    "What information should I upload first?",
    "How can I prepare for my next doctor visit?",
    "What does a preventive-care checklist include?",
  ];

  // The conversation belongs to the member, not the session. Reload the stored
  // thread on mount so leaving the screen — or the app — never costs them the
  // context they were working in.
  useEffect(() => {
    let cancelled = false;
    if (!user) { setHistoryLoading(false); return; }
    (async () => {
      const stored = await loadMessages(user.id);
      // Photos sit in a private bucket, so each needs a freshly signed URL to render.
      const hydrated = await Promise.all(stored.map(async (m) => (
        m.imagePath ? { ...m, imageUrl: await chatImageUrl(m.imagePath) } : m
      )));
      if (!cancelled) {
        setMessages(hydrated);
        setHistoryLoading(false);
      }
    })();
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
      "Delete this conversation? Your health data stays — only the chat is removed."
    );
    if (!ok) return;
    setClearing(true);
    await clearConversation(user.id);
    setMessages([]);
    setApptPrompt(null);
    setClearing(false);
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
    const windowed = thread.slice(-MAX_CONTEXT_MESSAGES).filter(m => !m.error);
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

    // Text questions go through the care team: the Advocate consults specialist
    // advocates, they compare notes, and a safety review runs before the reply.
    // Decided by THIS message only. Checking the whole window meant one photo sent
    // weeks ago routed every later question down the photo path, so the team never ran.
    const teamTurn = !image;
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
    if (teamTurn) patchLive({ team: [{ type: "route_start", t: 0 }] });

    // Store the photo before the row that points at it, so a message can never
    // reference an object whose upload failed.
    let imagePath = null;
    if (pendingFile && user) {
      const { path } = await uploadChatImage(user.id, pendingFile);
      imagePath = path;
    }
    // Written now rather than after the reply lands: a member who navigates away
    // mid-answer should still find their question waiting when they come back.
    if (user) await appendMessage(user.id, { role: "user", text: userText, imagePath });
    // What the member just said is data, not only conversation — a newly described
    // symptom should reach the insight cards on this turn rather than at the next
    // lab import. Fired once the reply is in: AI calls run one at a time, and the
    // insight refresh queued ahead of the care team held the whole round up.
    const refreshInsights = () => { if (user) onMemberMessage?.(); };

    const apiMessages = await buildApiMessages(thread);

    // The web-search model can't read images, so route image conversations to the
    // vision model; everything else uses the search model for live research + citations.
    const hasImage = apiMessages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === "image"));

    // Photo questions skip the team, since the vision model answers from the image.
    if (teamTurn) {
      // An older photo still in the window is dropped from the team's copy of the
      // thread: the question being asked is text, and the research model reads text.
      const textThread = apiMessages
        .map(m => (Array.isArray(m.content)
          ? { ...m, content: m.content.filter(c => c.type === "text").map(c => c.text).join("\n") }
          : m))
        .filter(m => m.content);
      try {
        const { reply, citations, events } = await runCareTeam({
          question: userText,
          apiMessages: textThread,
          systemPrompt: healthProfile,
          healthContext,
          userProfile,
          healthData,
          chatModel: CHAT_MODEL,
          cleanReply,
          onEvent: (e) => {
            live.push(e);
            patchLive({ team: [...live] });
          },
        });
        const ranked = rankCitations(citations);
        patchLive({ pending: false, text: reply, citations: ranked, team: events });
        if (user) await appendMessage(user.id, { role: "assistant", text: reply, citations: ranked, team: events });
      } catch (err) {
        console.error("Care team request failed", err);
        const text = `Something went wrong. Please try again.\n\n(${err?.message || "Unknown error"})`;
        patchLive({ pending: false, animate: false, team: [], text, error: true });
        if (user) await appendMessage(user.id, { role: "assistant", text, error: true });
      }
      setImage(null);
      setLoading(false);
      refreshInsights();
      return;
    }

    try {
      const data = await callAI({
        system: healthProfile,
        messages: apiMessages,
        model: hasImage ? VISION_MODEL : CHAT_MODEL,
        maxTokens: 1200,
        // Live research + citations on text questions; the vision path answers
        // from the attached image instead.
        webSearch: !hasImage,
      });
      const reply = cleanReply(firstText(data, "I couldn't generate a response."));
      // Ranked before it is rendered or stored, so the member sees the best source
      // first and a stored reply keeps the same ordering when the thread reloads.
      const citations = rankCitations(firstCitations(data));
      setMessages(prev => [...prev, { role: "assistant", text: reply, citations, fresh: true }]);
      if (user) await appendMessage(user.id, { role: "assistant", text: reply, citations });
    } catch (err) {
      // Show what actually failed. A bare "something went wrong" is how a
      // deprecated model id went unnoticed while every message silently 404'd.
      console.error("AI chat request failed", err);
      const text = `Something went wrong. Please try again.\n\n(${err?.message || "Unknown error"})`;
      setMessages(prev => [...prev, { role: "assistant", text, error: true }]);
      // Stored so the transcript stays honest about what the member saw, and
      // flagged so it is never replayed to the model as something the AI said.
      if (user) await appendMessage(user.id, { role: "assistant", text, error: true });
    }
    setImage(null);
    setLoading(false);
    refreshInsights();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: COLORS.bgDeep }}>
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
        </div>
        {/* Permanent by default, deleted only on request — the member owns the thread. */}
        {messages.length > 0 && (
          <button onClick={clearThread} disabled={clearing} aria-label="Delete conversation" style={{
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
            {startingPrompts.map(p => (
              <button key={p} onClick={() => send(p)} style={{
                width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: "10px 14px", textAlign: "left", cursor: "pointer",
                color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, lineHeight: 1.4
              }}>{p}</button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
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
                ? (m.error ? <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div> : <RichReply text={m.text} />)
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

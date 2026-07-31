import React, { useState, useEffect, useRef } from "react";
import { Camera, Home, Mic, Send, X } from "lucide-react";
import { COLORS, SERIF } from "../theme/tokens";
import { callAI, firstText } from "../lib/api";

// Single source of truth for scoring. Both the gauge (Home) and the breakdown modal
// call this so the two never silently drift out of sync, as they did when each kept
// its own hardcoded copy of the numbers.
// Daily recommendation engine. Evaluates every known trigger pattern across wearables,
// bloodwork, nutrition, and goals, scores each by confidence/severity, and returns only
// the single highest-priority match. Lower-priority patterns simply don't show on Home;
// they're still visible in Body/Labs/Records for anyone who goes looking. The goal is one
// genuinely useful nudge a day, not a notification for every minor fluctuation.
// ---- AI CHAT SCREEN ----
// Powers real AI responses via the Anthropic API, with the user's health profile injected
// into every request so answers are contextual to their actual data, not generic wellness advice.
function AIChatScreen({ setActive }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [listening, setListening] = useState(false);
  const [apptPrompt, setApptPrompt] = useState(null); // detected appointment info
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Detect appointment mentions in user messages and offer to build a Discussion Page
  const detectAppointment = (text) => {
    const apptPattern = /(?:doctor|dr\.?|physician|appointment|visit|see(?:ing)? my|specialist|endocrin|cardio|oncol|neurol|dermatol)/i;
    const datePattern = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|next week|tomorrow|\d{1,2}(?:st|nd|rd|th)?)/i;
    return apptPattern.test(text) && datePattern.test(text);
  };

  // User's health profile injected as context into every AI request.
  const healthProfile = `
You are a personal health advocate AI embedded inside a health platform. You have access to this user's health profile:

NAME: Adam Locker, 52 years old, male
CURRENT THERAPIES: Testosterone Replacement Therapy (TRT), monitored monthly
CONNECTED DEVICES: Oura Ring, Eight Sleep

RECENT BLOODWORK (Jan 2026):
- Vitamin D: 28 ng/mL (LOW, range 30-50)
- TSH: 2.1 mIU/L (normal)
- TPO antibodies: 118 IU/mL (trending up over 3 panels)
- Total testosterone: within therapy range
- Ferritin: 62 ng/mL (normal)
- Vitamin D3 + K2 supplement ordered

TODAY'S DEVICE DATA:
- Readiness: 68 (below typical of 78)
- HRV: 42ms (below baseline of 50ms)
- Resting heart rate: 64 bpm (baseline 52 bpm)
- Overnight skin temp deviation: +0.4°F
- Sleep: 7h 12m (Deep 78m, REM 104m, Light 220m, Awake 30m)
- Zone 2+ training: 34 min today
- VO2 max: 46.2 ml/kg/min (up 0.8 over 8 weeks)

BODY COMPOSITION:
- Current weight: 202 lb (goal: 195 lb)
- Current body fat: 17.5% (goal: 14%)

GENETIC MARKERS — SUPPLEMENT & LIFESTYLE:
- MTHFR C677T heterozygous: Reduced folate processing (~65% efficiency). Must use methylfolate not folic acid. Methylcobalamin preferred over cyanocobalamin. Homocysteine should be checked annually.
- VDR Taq1 TT: Reduced vitamin D receptor efficiency. Target serum level 50-70 ng/mL not standard 30-50. Current 28 ng/mL is more concerning than it would be for standard genotype.
- COMT Val158Met heterozygous: Slower dopamine and estrogen clearance. More sensitive to stress and slower to recover. Late caffeine worsens sleep more than average. Magnesium and B6 support COMT function.
- ACTN3 RR: Power-oriented muscle fiber genetics. Creatine monohydrate has stronger evidence base for this genotype. High-intensity training is naturally well-suited.
- FUT2 non-secretor: Standard probiotic strains less effective. Saccharomyces boulardii and prebiotic fiber (pectin, resistant starch) are better starting points than Lactobacillus products.
- HLA-DQ2.5 heterozygous: Elevated autoimmune susceptibility. Directly relevant to rising TPO antibody trend. Celiac screening and gluten-autoimmune connection worth discussing at next endocrinology appointment.

GENETIC MARKERS — PHARMACOGENOMIC:
- CYP2D6 intermediate metabolizer: Processes antidepressants (SSRIs), opioids, tamoxifen, atomoxetine, and beta-blockers more slowly than average. Standard doses may accumulate. Always flag this before any new psychiatric, pain, or cardiac prescription.
- CYP2C19 normal metabolizer: No concerns for clopidogrel, PPIs, or related drugs.
- CYP1A2 slow metabolizer: Caffeine clears slowly. Afternoon caffeine is a meaningful contributor to below-baseline HRV and sleep disruption. Clinically significant if clozapine or theophylline ever prescribed.
- SLCO1B1 rs4149056 heterozygous: Elevated statin myopathy risk. If statins ever needed, rosuvastatin or pravastatin are safer than simvastatin or high-dose atorvastatin. Must inform any prescriber.
- CYP2C9 normal metabolizer: No concerns for warfarin or NSAIDs.

IMPORTANT RULES:
- You are a health advocate, not a clinician. You never diagnose or prescribe.
- When answering supplement questions, always check the genetic markers first. Generic supplement advice that ignores MTHFR, VDR, FUT2 status is incomplete for this user.
- When trending health claims appear ("everyone should take X"), evaluate them against this user's actual bloodwork and genetic profile before responding.
- Pharmacogenomic findings must always be framed as "discuss with your prescriber" — never tell the user what medication to take or avoid unilaterally.
- When reading food labels or nutrition photos, contextualize against body composition goals, training load, and COMT/CYP1A2 status where relevant.
- When someone mentions a doctor appointment, flag that their Discussion Page can be prepared.
- Be direct, specific, and grounded in their data. Generic advice that ignores their profile is unhelpful.
- Keep responses concise and action-oriented.
`.trim();

  const startingPrompts = [
    "Should I be taking magnesium?",
    "I saw a TikTok saying everyone needs berberine — is that true for me?",
    "My readiness is low today — should I still train?",
    "I have a doctor appointment next Tuesday",
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(",")[1];
      setImage(base64);
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

  const send = async (text) => {
    const userText = text || input.trim();
    if (!userText && !image) return;
    const userMsg = { role: "user", text: userText, image: imagePreview };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setImagePreview(null);
    // Detect appointment mentions and surface Discussion Page prompt
    if (userText && detectAppointment(userText) && !apptPrompt) {
      setApptPrompt(userText);
    }
    setLoading(true);

    const apiMessages = [...messages, userMsg].map(m => {
      const content = [];
      if (m.image && m.role === "user") {
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image || m.image.split(",")[1] } });
      }
      if (m.text) content.push({ type: "text", text: m.text });
      return { role: m.role, content: content.length === 1 && content[0].type === "text" ? content[0].text : content };
    });

    try {
      const data = await callAI({ system: healthProfile, messages: apiMessages });
      const reply = firstText(data, "I couldn't generate a response.");
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Something went wrong. Please try again." }]);
    }
    setImage(null);
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: COLORS.bgDeep }}>
      {/* Header */}
      <div style={{ padding: "36px 18px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em" }}>Ask your health advocate</div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
          Answers reference your bloodwork, device data, and goals.
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: "16px 14px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
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
          <div key={i} style={{
            display: "flex", flexDirection: "column",
            alignItems: m.role === "user" ? "flex-end" : "flex-start"
          }}>
            {m.image && (
              <img src={m.image} alt="uploaded" style={{
                maxWidth: 200, borderRadius: 12, marginBottom: 6, alignSelf: "flex-end"
              }} />
            )}
            <div style={{
              maxWidth: "84%", padding: "10px 14px", borderRadius: 16,
              borderBottomRightRadius: m.role === "user" ? 4 : 16,
              borderBottomLeftRadius: m.role === "assistant" ? 4 : 16,
              background: m.role === "user" ? COLORS.teal : COLORS.bgCard,
              color: m.role === "user" ? COLORS.onAccent : COLORS.textPrimary,
              fontSize: 13, lineHeight: 1.6,
            }}>
              {m.role === "assistant"
                ? <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                : m.text}
            </div>
          </div>
        ))}

        {loading && (
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
        <div ref={bottomRef} />
      </div>

      {/* Appointment detection nudge */}
      {apptPrompt && (
        <div style={{
          margin: "0 14px", padding: 12, background: COLORS.warnDim,
          border: `1px solid ${COLORS.gold}50`, borderRadius: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.gold, marginBottom: 2 }}>
              Appointment detected
            </div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
              Your Discussion Page can be prepared with a summary of current symptoms, labs, and questions to raise.
            </div>
          </div>
          <button onClick={() => setActive("discussion")} style={{
            background: COLORS.gold, border: "none", color: COLORS.onAccent,
            fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 8, cursor: "pointer", flexShrink: 0
          }}>Open</button>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div style={{ padding: "8px 14px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <img src={imagePreview} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
          <button onClick={() => { setImagePreview(null); setImage(null); }} style={{
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

      <style>{`@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
    </div>
  );
}

export { AIChatScreen };

import React, { useState, useEffect, useRef } from "react";
import {
  Home, Activity, FlaskConical, ShoppingBag, Crown, Mic, Upload,
  TrendingUp, AlertTriangle, CheckCircle2, FileText, ChevronRight,
  Sparkles, Sun, Moon, Plus, X, ShieldCheck, Calendar, AlertCircle,
  MapPin, Star, Search, MessageCircle, Camera, Send, Dna, Wifi, Stethoscope
} from "lucide-react";

// ---- Design tokens (matches established Ronay palette) ----
const COLORS = {
  bgDeep: "#0A1614",
  bgCard: "#0F211D",
  bgCardAlt: "#142B26",
  teal: "#1D9E75",
  tealLight: "#5DCAA5",
  tealPale: "#9FE1CB",
  gold: "#C9A24B",
  goldLight: "#E0C175",
  platinum: "#D8DCD9",
  textPrimary: "#F2F5F3",
  textSecondary: "#9BAFA8",
  textMuted: "#5C7068",
  border: "#1E3530",
  danger: "#D85A30",
  warning: "#C9A24B",
};

function PhoneFrame({ children, tabBar }) {
  return (
    <div style={{
      width: 390, height: 800, background: COLORS.bgDeep,
      borderRadius: 40, border: `8px solid #050B09`,
      boxShadow: "0 0 0 1px #000",
      overflow: "hidden", position: "relative", margin: "0 auto",
      fontFamily: "'Inter', -apple-system, sans-serif", color: COLORS.textPrimary,
      display: "flex", flexDirection: "column"
    }}>
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 120, height: 26, background: "#050B09", borderRadius: "0 0 16px 16px", zIndex: 50
      }} />
      <div id="phone-scroll-area" style={{ flex: 1, overflowY: "auto", position: "relative", minHeight: 0 }}>
        {children}
      </div>
      {tabBar}
    </div>
  );
}

function TabBar({ active, setActive }) {
  const tabs = [
    { id: "home", icon: Home, label: "Today" },
    { id: "aichat", icon: MessageCircle, label: "Ask" },
    { id: "records", icon: FileText, label: "Records" },
    { id: "labs", icon: FlaskConical, label: "Labs" },
    { id: "profile", icon: Crown, label: "Care" },
  ];
  return (
    <div style={{
      flexShrink: 0, height: 86,
      background: COLORS.bgCard, borderTop: `1px solid ${COLORS.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-around",
      paddingBottom: 18
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            background: "none", border: "none", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 4, cursor: "pointer", padding: "4px 8px"
          }}>
            <t.icon size={20} color={isActive ? COLORS.tealLight : COLORS.textMuted} strokeWidth={1.75} />
            <span style={{
              fontSize: 10, color: isActive ? COLORS.tealLight : COLORS.textMuted,
              fontWeight: isActive ? 600 : 400
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ScoreGauge({ basePts = 28, baseMax = 50, dailyPts = 23, dailyMax = 50, onTap }) {
  const total = basePts + dailyPts;
  const outerR = 70, innerR = 56, stroke = 10;
  const outerCirc = 2 * Math.PI * outerR;
  const innerCirc = 2 * Math.PI * innerR;
  const basePct = basePts / baseMax;
  const dailyPct = dailyPts / dailyMax;

  const Bar = ({ label, value, max, color }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{label}</span>
        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{value} / {max}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: COLORS.border, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );

  return (
    <button onClick={onTap} style={{
      background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", width: "100%"
    }}>
      <div style={{ position: "relative", width: 170, height: 170, margin: "0 auto" }}>
        <svg width="170" height="170" style={{ transform: "rotate(-90deg)" }}>
          {/* outer ring: base / preventive care */}
          <circle cx="85" cy="85" r={outerR} fill="none" stroke={COLORS.border} strokeWidth={stroke} />
          <circle cx="85" cy="85" r={outerR} fill="none" stroke={COLORS.gold}
            strokeWidth={stroke} strokeDasharray={`${outerCirc * basePct} ${outerCirc}`} strokeLinecap="round" />
          {/* inner ring: daily / weekly */}
          <circle cx="85" cy="85" r={innerR} fill="none" stroke={COLORS.border} strokeWidth={stroke} />
          <circle cx="85" cy="85" r={innerR} fill="none" stroke={COLORS.tealLight}
            strokeWidth={stroke} strokeDasharray={`${innerCirc * dailyPct} ${innerCirc}`} strokeLinecap="round" />
        </svg>
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
        }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: COLORS.textPrimary }}>{total}</span>
          <span style={{ fontSize: 10, color: COLORS.textSecondary, letterSpacing: 1 }}>HEALTH SCORE</span>
          <span style={{ fontSize: 10, color: COLORS.tealLight, marginTop: 4 }}>Tap for breakdown</span>
        </div>
      </div>
      <div style={{ marginTop: 18, padding: "0 8px", textAlign: "left" }}>
        <Bar label="Base · preventive care" value={basePts} max={baseMax} color={COLORS.gold} />
        <Bar label="Daily / weekly" value={dailyPts} max={dailyMax} color={COLORS.tealLight} />
      </div>
    </button>
  );
}

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
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: healthProfile,
          messages: apiMessages,
        }),
      });
      const data = await response.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "I couldn't generate a response.";
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
        <div style={{ fontSize: 18, fontWeight: 700 }}>Ask your health advocate</div>
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
              color: m.role === "user" ? "#06140F" : COLORS.textPrimary,
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
          margin: "0 14px", padding: 12, background: "#1A1610",
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
            background: COLORS.gold, border: "none", color: "#06140F",
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
          <Mic size={16} color={listening ? "#06140F" : COLORS.textSecondary} />
        </button>
        <button onClick={() => send()} disabled={!input.trim() && !image} style={{
          background: (!input.trim() && !image) ? COLORS.bgCardAlt : COLORS.teal,
          border: "none", borderRadius: 10, width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: (!input.trim() && !image) ? "default" : "pointer", flexShrink: 0
        }}>
          <Send size={16} color={(!input.trim() && !image) ? COLORS.textMuted : "#06140F"} />
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
    </div>
  );
}

// ---- HEALTH HISTORY SCREEN ----
// Post-onboarding questionnaire. Collected after the user has seen value, not before.
// Feeds the AI chat, the Discussion Page, and the preventive care schedule.
function HealthHistoryScreen({ setActive, onSave }) {
  const [conditions, setConditions] = useState([]);
  const [conditionInput, setConditionInput] = useState("");
  const [medications, setMedications] = useState([]);
  const [medInput, setMedInput] = useState("");
  const [pastEvents, setPastEvents] = useState("");
  const [familyHistory, setFamilyHistory] = useState([]);
  const [lifestyle, setLifestyle] = useState({ exercise: "", sleep: "", alcohol: "" });
  const [goals, setGoals] = useState([]);
  const [saved, setSaved] = useState(false);

  const commonConditions = ["Hypertension", "Type 2 diabetes", "Thyroid condition", "Autoimmune condition", "Cardiac condition", "High cholesterol", "Anxiety / depression", "Sleep apnea", "Asthma / COPD"];
  const familyConditions = ["Heart disease", "Type 2 diabetes", "Cancer", "Alzheimer's / dementia", "Autoimmune condition", "Stroke", "Mental health condition"];
  const goalOptions = ["Understand my bloodwork better", "Catch health issues early", "Optimize energy and performance", "Manage a chronic condition", "Prepare for doctor appointments", "Track medications and supplements"];
  const exerciseOptions = ["Rarely or never", "1-2 times per week", "3-4 times per week", "5+ times per week"];
  const sleepOptions = ["Poor — often tired", "Fair — sometimes rested", "Good — usually rested", "Excellent — consistently rested"];
  const alcoholOptions = ["Never", "Occasionally (1-2 per week)", "Moderate (3-7 per week)", "Regular (more than 7 per week)"];

  const toggleChip = (list, setList, val) => setList(l => l.includes(val) ? l.filter(x => x !== val) : [...l, val]);

  const addItem = (val, setList, setInput) => {
    if (!val.trim()) return;
    setList(l => [...l, val.trim()]);
    setInput("");
  };

  const handleSave = () => {
    const healthHistory = { conditions, medications, pastEvents, familyHistory, lifestyle, goals };
    onSave(healthHistory);
    setSaved(true);
    setTimeout(() => setActive("home"), 1200);
  };

  if (saved) {
    return (
      <div style={{ padding: "24px 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <CheckCircle2 size={48} color={COLORS.tealLight} style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Health history saved</div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: "center" }}>
          Your advocate now has more context to give you specific, relevant guidance.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Your health history</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
        This stays private and makes every recommendation more specific to you. Takes about 3 minutes. Nothing here is required.
      </div>

      {/* Current conditions */}
      <SectionLabel>Current conditions</SectionLabel>
      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {commonConditions.map(c => (
            <button key={c} onClick={() => toggleChip(conditions, setConditions, c)} style={{
              padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              background: conditions.includes(c) ? COLORS.teal : COLORS.bgCardAlt,
              color: conditions.includes(c) ? "#06140F" : COLORS.textSecondary,
              border: `1px solid ${conditions.includes(c) ? COLORS.teal : COLORS.border}`,
              fontWeight: conditions.includes(c) ? 600 : 400
            }}>{c}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={conditionInput} onChange={e => setConditionInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem(conditionInput, setConditions, setConditionInput)}
            placeholder="Add another condition..."
            style={{ flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
          <button onClick={() => addItem(conditionInput, setConditions, setConditionInput)} style={{
            background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: "8px 12px", color: COLORS.tealLight, fontSize: 12, cursor: "pointer"
          }}>Add</button>
        </div>
        {conditions.filter(c => !commonConditions.includes(c)).map(c => (
          <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, padding: "4px 0" }}>
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{c}</span>
            <button onClick={() => setConditions(l => l.filter(x => x !== c))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={14} /></button>
          </div>
        ))}
      </Card>

      {/* Current medications */}
      <SectionLabel>Current medications</SectionLabel>
      <Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>
          Include prescriptions and supplements. You can manage these in more detail from your medication screen.
        </div>
        {medications.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{m}</span>
            <button onClick={() => setMedications(l => l.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={14} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: medications.length > 0 ? 10 : 0 }}>
          <input value={medInput} onChange={e => setMedInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem(medInput, setMedications, setMedInput)}
            placeholder="e.g. Lisinopril 10mg, Vitamin D3..."
            style={{ flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
          <button onClick={() => addItem(medInput, setMedications, setMedInput)} style={{
            background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: "8px 12px", color: COLORS.tealLight, fontSize: 12, cursor: "pointer"
          }}>Add</button>
        </div>
      </Card>

      {/* Past health events */}
      <SectionLabel>Past significant health events</SectionLabel>
      <Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>
          Surgeries, hospitalizations, major diagnoses that are now resolved. Helps your advocate understand your full picture.
        </div>
        <textarea value={pastEvents} onChange={e => setPastEvents(e.target.value)}
          placeholder="e.g. Appendectomy 2018, kidney stone 2022, COVID with long symptoms 2023..."
          rows={3} style={{
            width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: "10px", color: COLORS.textPrimary, fontSize: 12,
            outline: "none", resize: "none", lineHeight: 1.5
          }} />
      </Card>

      {/* Family history */}
      <SectionLabel>Family history</SectionLabel>
      <Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>
          First-degree relatives (parents, siblings, children). Adjusts your preventive care recommendations.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {familyConditions.map(c => (
            <button key={c} onClick={() => toggleChip(familyHistory, setFamilyHistory, c)} style={{
              padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              background: familyHistory.includes(c) ? `${COLORS.warning}30` : COLORS.bgCardAlt,
              color: familyHistory.includes(c) ? COLORS.warning : COLORS.textSecondary,
              border: `1px solid ${familyHistory.includes(c) ? COLORS.warning : COLORS.border}`,
              fontWeight: familyHistory.includes(c) ? 600 : 400
            }}>{c}</button>
          ))}
        </div>
      </Card>

      {/* Lifestyle */}
      <SectionLabel>Lifestyle (optional)</SectionLabel>
      <Card>
        {[
          { key: "exercise", label: "Exercise frequency", options: exerciseOptions },
          { key: "sleep", label: "Sleep quality", options: sleepOptions },
          { key: "alcohol", label: "Alcohol use", options: alcoholOptions },
        ].map(field => (
          <div key={field.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{field.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {field.options.map(opt => (
                <button key={opt} onClick={() => setLifestyle(l => ({ ...l, [field.key]: opt }))} style={{
                  padding: "9px 12px", borderRadius: 9, fontSize: 12, cursor: "pointer", textAlign: "left",
                  background: lifestyle[field.key] === opt ? `${COLORS.teal}20` : COLORS.bgCardAlt,
                  color: lifestyle[field.key] === opt ? COLORS.tealLight : COLORS.textSecondary,
                  border: `1px solid ${lifestyle[field.key] === opt ? COLORS.tealLight : COLORS.border}`,
                  fontWeight: lifestyle[field.key] === opt ? 600 : 400
                }}>{opt}</button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {/* Goals */}
      <SectionLabel>What do you most want your advocate to help with?</SectionLabel>
      <Card>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>Choose up to three.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {goalOptions.map(g => {
            const selected = goals.includes(g);
            const maxed = goals.length >= 3 && !selected;
            return (
              <button key={g} onClick={() => !maxed && toggleChip(goals, setGoals, g)} style={{
                padding: "10px 14px", borderRadius: 10, fontSize: 13, cursor: maxed ? "default" : "pointer",
                textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                background: selected ? `${COLORS.teal}20` : COLORS.bgCardAlt,
                border: `1px solid ${selected ? COLORS.tealLight : COLORS.border}`,
                opacity: maxed ? 0.4 : 1
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 9, flexShrink: 0,
                  background: selected ? COLORS.teal : "none",
                  border: `2px solid ${selected ? COLORS.teal : COLORS.textMuted}`,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {selected && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#06140F" }} />}
                </div>
                <span style={{ color: selected ? COLORS.tealLight : COLORS.textSecondary, fontWeight: selected ? 600 : 400 }}>{g}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <button onClick={handleSave} style={{
        width: "100%", background: COLORS.teal, border: "none", color: "#06140F",
        fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer",
        marginTop: 8, marginBottom: 10
      }}>
        Save my health history
      </button>
      <button onClick={() => setActive("home")} style={{
        width: "100%", background: "none", border: "none", color: COLORS.textMuted,
        fontSize: 12, padding: "8px", cursor: "pointer"
      }}>
        Skip for now
      </button>
    </div>
  );
}


function PreventiveCareScreen({ setActive, userProfile }) {
  const [completedItems, setCompletedItems] = useState(userProfile?.completedItems || {});
  const schedule = userProfile?.schedule || [];
  const urgencyColor = { overdue: COLORS.danger, due_soon: COLORS.warning, upcoming: COLORS.tealLight };
  const urgencyLabel = { overdue: "Overdue", due_soon: "Due soon", upcoming: "Upcoming" };
  const categories = [...new Set(schedule.map(i => i.category))];

  if (!userProfile || schedule.length === 0) {
    return (
      <div style={{ padding: "24px 18px" }}>
        <button onClick={() => setActive("profile")} style={{
          background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
          color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
        }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Preventive care</div>
        <Card style={{ textAlign: "center", padding: "30px 20px" }}>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
            Complete onboarding to generate your personal preventive care schedule.
          </div>
        </Card>
      </div>
    );
  }

  const overdue = schedule.filter(i => i.urgency === "overdue" && !completedItems[i.id]).length;
  const dueSoon = schedule.filter(i => i.urgency === "due_soon" && !completedItems[i.id]).length;

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("profile")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
      </button>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Preventive care</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>
        {overdue > 0 && <span style={{ color: COLORS.danger }}>{overdue} overdue</span>}
        {overdue > 0 && dueSoon > 0 && <span style={{ color: COLORS.textMuted }}> · </span>}
        {dueSoon > 0 && <span style={{ color: COLORS.warning }}>{dueSoon} due soon</span>}
      </div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 20 }}>
        Tap any item to mark it complete. Your health score updates automatically.
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <SectionLabel>{cat}</SectionLabel>
          <Card>
            {schedule.filter(i => i.category === cat).map((item, idx, arr) => {
              const done = completedItems[item.id];
              return (
                <div key={item.id} style={{
                  padding: "11px 0",
                  borderBottom: idx < arr.filter(i => i.category === cat).length - 1 ? `1px solid ${COLORS.border}` : "none",
                  opacity: done ? 0.55 : 1
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, textDecoration: done ? "line-through" : "none" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 3 }}>{item.frequency}</div>
                      <div style={{ fontSize: 10, color: COLORS.textMuted, fontStyle: "italic", lineHeight: 1.4 }}>{item.note}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                      {!done && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                          color: urgencyColor[item.urgency], background: `${urgencyColor[item.urgency]}20`
                        }}>{urgencyLabel[item.urgency]}</span>
                      )}
                      <button onClick={() => setCompletedItems(p => ({ ...p, [item.id]: !p[item.id] }))} style={{
                        background: done ? COLORS.tealLight : "none",
                        border: `1.5px solid ${done ? COLORS.tealLight : COLORS.border}`,
                        borderRadius: 14, width: 28, height: 28, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {done && <CheckCircle2 size={14} color="#06140F" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
      <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, padding: "10px 12px", background: COLORS.bgCardAlt, borderRadius: 10 }}>
        Based on USPSTF guidelines, ACS, and American Thyroid Association recommendations. Discuss any flagged items with your physician.
      </div>
    </div>
  );
}

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

// ---- PREVENTIVE CARE ENGINE ----
// Builds a personalized screening schedule from age, sex, and a small set of
// risk factors. Source: USPSTF guidelines, ACS recommendations, ATA, and ACR.
// This runs entirely from onboarding inputs with no external API or wearable needed,
// which is why it belongs in the MVP rather than the place-marked section.
function buildPreventiveCareSchedule(profile) {
  const { age, sex, smoker, familyEarlyHeartDisease, familyOrPersonalCancer, diabetesOrPrediabetes } = profile;
  const items = [];

  // COLORECTAL — family or personal cancer history moves screening start to 40
  const colonAge = familyOrPersonalCancer ? 40 : 45;
  if (age >= colonAge) {
    items.push({
      id: "colonoscopy", category: "Cancer screening",
      name: "Colonoscopy",
      frequency: "Every 10 years (or FIT test annually)",
      startAge: colonAge,
      note: familyOrPersonalCancer ? "Earlier start due to personal or family cancer history" : "Average risk",
      urgency: age >= colonAge + 2 ? "overdue" : "due_soon",
    });
  }

  // BREAST
  if (sex === "female" && age >= 40) {
    items.push({
      id: "mammogram", category: "Cancer screening",
      name: "Mammogram",
      frequency: "Annually from 40",
      startAge: 40,
      note: familyOrPersonalCancer ? "Given personal or family cancer history, discuss earlier or more frequent screening with your physician" : "Average risk",
      urgency: "due_soon",
    });
  }

  // CERVICAL
  if (sex === "female" && age >= 21 && age <= 65) {
    items.push({
      id: "pap", category: "Cancer screening",
      name: "Pap smear / cervical screening",
      frequency: "Every 3 years (or every 5 years with HPV co-test from age 30)",
      startAge: 21,
      note: "Stops at 65 with adequate prior screening history",
      urgency: "due_soon",
    });
  }

  // LUNG
  if (age >= 50 && age <= 80 && smoker) {
    items.push({
      id: "lung_ct", category: "Cancer screening",
      name: "Annual low-dose lung CT scan",
      frequency: "Annually",
      startAge: 50,
      note: "For current or former smokers with 20+ pack-year history",
      urgency: "due_soon",
    });
  }

  // PROSTATE
  if (sex === "male" && age >= 40) {
    const psa_age = familyOrPersonalCancer ? 40 : 50;
    items.push({
      id: "psa", category: "Cancer screening",
      name: "PSA / prostate discussion",
      frequency: "Shared decision with your physician",
      startAge: psa_age,
      note: familyOrPersonalCancer ? "Given your cancer history, discuss PSA testing earlier with your physician" : "Not automatic — discuss with your doctor whether testing is right for you",
      urgency: (familyOrPersonalCancer && age >= 40) || age >= 55 ? "due_soon" : "upcoming",
    });
  }

  // SKIN
  if (age >= 35) {
    items.push({
      id: "derm", category: "Cancer screening",
      name: "Annual skin cancer / dermatology exam",
      frequency: "Annually",
      startAge: 35,
      note: "Full-body skin check by a dermatologist",
      urgency: "due_soon",
    });
  }

  // CARDIOVASCULAR
  items.push({
    id: "bp", category: "Cardiovascular",
    name: "Blood pressure check",
    frequency: "Annually",
    startAge: 18,
    note: "Home monitoring counts if done consistently",
    urgency: "due_soon",
  });

  if (age >= 20) {
    items.push({
      id: "lipids", category: "Cardiovascular",
      name: "Full lipid panel (including ApoB and Lp(a))",
      frequency: familyEarlyHeartDisease ? "Annually given family history" : "Every 5 years if normal, more often with risk factors",
      startAge: 20,
      note: familyEarlyHeartDisease ? "Family history of early heart disease significantly elevates your risk — ApoB and Lp(a) are especially important to track" : "ApoB and Lp(a) are often skipped at routine physicals but are among the strongest predictors of cardiovascular risk",
      urgency: familyEarlyHeartDisease || age >= 30 ? "due_soon" : "upcoming",
    });
  }

  if (sex === "male" && age >= 65) {
    items.push({
      id: "aaa", category: "Cardiovascular",
      name: "Abdominal aortic aneurysm ultrasound",
      frequency: "One-time screening",
      startAge: 65,
      note: "Recommended once for men 65-75 who have ever smoked",
      urgency: smoker ? "due_soon" : "upcoming",
    });
  }

  // METABOLIC
  const glucoseStart = diabetesOrPrediabetes ? 18 : 35;
  if (age >= glucoseStart) {
    items.push({
      id: "glucose", category: "Metabolic",
      name: "Fasting glucose / HbA1c",
      frequency: diabetesOrPrediabetes ? "Annually" : "Every 3 years from 35, more often with risk factors",
      startAge: glucoseStart,
      note: diabetesOrPrediabetes ? "Given your personal or family history of diabetes, annual monitoring is important" : "Earlier with family history of diabetes or excess weight",
      urgency: diabetesOrPrediabetes ? "overdue" : "due_soon",
    });
  }

  // BONE
  const dexaAge = sex === "female" ? 65 : 70;
  if (age >= dexaAge - 5) {
    items.push({
      id: "dexa", category: "Bone health",
      name: "DEXA bone density scan",
      frequency: "Every 2 years or as directed",
      startAge: dexaAge,
      note: sex === "male" ? "Earlier if on long-term steroids or testosterone therapy" : "Standard recommendation for women at 65",
      urgency: age >= dexaAge ? "due_soon" : "upcoming",
    });
  }

  // VISION
  if (age >= 40) {
    items.push({
      id: "eye", category: "Vision",
      name: "Comprehensive eye exam",
      frequency: "Every 1-2 years from 40, annually from 60",
      startAge: 40,
      note: "Includes glaucoma screening — risk increases with age",
      urgency: age >= 60 ? "due_soon" : "upcoming",
    });
  }

  // HEARING
  if (age >= 50) {
    items.push({
      id: "hearing", category: "Hearing",
      name: "Baseline audiogram / hearing test",
      frequency: "Baseline at 50, every 3 years if normal, annually if loss detected",
      startAge: 50,
      note: "Untreated hearing loss is one of the most modifiable risk factors for cognitive decline",
      urgency: age >= 55 ? "due_soon" : "upcoming",
    });
  }

  // DENTAL
  items.push({
    id: "dental", category: "Dental",
    name: "Dental cleaning and exam",
    frequency: "Twice per year",
    startAge: 0,
    note: "Oral health connects directly to cardiovascular and metabolic outcomes",
    urgency: "due_soon",
  });

  // MENTAL HEALTH
  items.push({
    id: "mental", category: "Mental health",
    name: "Depression and anxiety screening",
    frequency: "Annually",
    startAge: 18,
    note: "USPSTF grade B recommendation — often skipped at routine visits",
    urgency: "upcoming",
  });

  // THYROID
  if (age >= 35) {
    items.push({
      id: "thyroid", category: "Thyroid",
      name: "TSH thyroid screening",
      frequency: "Every 5 years from 35 (American Thyroid Association)",
      startAge: 35,
      note: "Not universally ordered at annual physicals — worth requesting specifically",
      urgency: age >= 40 ? "due_soon" : "upcoming",
    });
  }

  // IMMUNIZATIONS
  items.push({ id: "flu", category: "Immunizations", name: "Annual flu vaccine", frequency: "Annually, every fall", startAge: 0, note: "Best protection when given before flu season peaks", urgency: "due_soon" });
  if (age >= 50) items.push({ id: "shingrix", category: "Immunizations", name: "Shingles vaccine (Shingrix)", frequency: "Two-dose series, then done", startAge: 50, note: "Two doses 2-6 months apart — highly effective", urgency: "due_soon" });
  if (age >= 60) items.push({ id: "rsv", category: "Immunizations", name: "RSV vaccine", frequency: "Single dose", startAge: 60, note: "Newer recommendation — often not yet on standard checklists", urgency: "due_soon" });
  items.push({ id: "tdap", category: "Immunizations", name: "Tdap booster", frequency: "Every 10 years", startAge: 18, note: "Covers tetanus, diphtheria, and pertussis", urgency: "upcoming" });

  return items;
}

// ---- ONBOARDING SCREEN ----
// Three steps: profile inputs → instant preventive care schedule → first AI insight.
// Delivers value before the user has uploaded anything or connected any device.
function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(1); // 1-fast facts | 2-preventive care | 3-health intake | 4-bloodwork | 5-AI insight
  const [profile, setProfile] = useState({
    name: "", dob: "", sex: "male", smoker: false,
    familyEarlyHeartDisease: false, familyOrPersonalCancer: false, diabetesOrPrediabetes: false,
  });
  const [intake, setIntake] = useState({
    conditions: [], conditionInput: "",
    medications: [], medInput: "",
    pastEvents: "",
    familyHistory: [],
    primaryConcern: "",
    exercise: "", sleep: "",
  });
  const [schedule, setSchedule] = useState([]);
  const [completedItems, setCompletedItems] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [insight, setInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(false);
  const fileRef = useRef(null);

  const urgencyColor = { overdue: COLORS.danger, due_soon: COLORS.warning, upcoming: COLORS.tealLight };
  const urgencyLabel = { overdue: "Overdue", due_soon: "Due soon", upcoming: "Upcoming" };

  const commonConditions = ["Hypertension", "Type 2 diabetes", "Thyroid condition", "Autoimmune", "High cholesterol", "Anxiety / depression", "Sleep apnea", "Asthma / COPD", "Cardiac condition"];
  const familyConditions = ["Heart disease", "Cancer", "Type 2 diabetes", "Alzheimer's", "Autoimmune", "Stroke"];
  const toggleChip = (list, key, val) => setIntake(p => ({ ...p, [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val] }));

  const goToStep2 = () => {
    if (!profile.dob || !profile.name) return;
    const birthDate = new Date(profile.dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear() - (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
    const sched = buildPreventiveCareSchedule({ ...profile, age });
    setSchedule(sched);
    setStep(2);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedFile({ base64: ev.target.result.split(",")[1], mediaType: file.type || "application/pdf" });
    reader.readAsDataURL(file);
  };

  const generateInsight = async () => {
    setStep(5);
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

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-beta": "pdfs-2024-09-25" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000,
          system: "You are a personal health advocate. Be warm, direct, and specific. Write in 3 short conversational paragraphs. Never use bullet points. Never diagnose. Never prescribe. Always frame recommendations as advocacy — helping someone have better conversations with their doctors.",
          messages }),
      });
      const data = await response.json();
      setInsight(data.content?.find(b => b.type === "text")?.text || "");
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
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Let's get started</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
            A few quick facts and we'll show you exactly what preventive care you should be getting at your age — before you do anything else.
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 5 }}>First name</div>
            <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your first name" style={{ width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "11px 14px", color: COLORS.textPrimary, fontSize: 14, outline: "none" }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 5 }}>Date of birth</div>
            <input type="date" value={profile.dob} onChange={e => setProfile(p => ({ ...p, dob: e.target.value }))}
              max={new Date().toISOString().split("T")[0]}
              style={{ width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "11px 14px", color: COLORS.textPrimary, fontSize: 14, outline: "none" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>Biological sex</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["male", "female"].map(s => (
                <button key={s} onClick={() => setProfile(p => ({ ...p, sex: s }))} style={{ flex: 1, padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: profile.sex === s ? COLORS.teal : COLORS.bgCardAlt, color: profile.sex === s ? "#06140F" : COLORS.textSecondary, border: "none", textTransform: "capitalize" }}>{s}</button>
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
              <button key={item.key} onClick={() => setProfile(p => ({ ...p, [item.key]: !p[item.key] }))} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: profile[item.key] ? `${COLORS.teal}20` : COLORS.bgCardAlt, border: `1px solid ${profile[item.key] ? COLORS.teal : COLORS.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", marginBottom: 8, textAlign: "left" }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, background: profile[item.key] ? COLORS.teal : "none", border: `2px solid ${profile[item.key] ? COLORS.teal : COLORS.textMuted}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {profile[item.key] && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#06140F" }} />}
                </div>
                <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{item.label}</span>
              </button>
            ))}
          </div>

          <button onClick={goToStep2} disabled={!profile.name || !profile.dob} style={{ width: "100%", background: !profile.name || !profile.dob ? COLORS.bgCardAlt : COLORS.teal, border: "none", color: !profile.name || !profile.dob ? COLORS.textMuted : "#06140F", fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: !profile.name || !profile.dob ? "default" : "pointer" }}>
            See my screening schedule →
          </button>
        </div>
      )}

      {/* STEP 2: Preventive care schedule — immediate value */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Your screening schedule</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 18 }}>
            Based on your age and profile, {profile.name}. This is what evidence-based medicine says you should be getting.
          </div>

          {[...new Set(schedule.map(i => i.category))].slice(0, 4).map(cat => (
            <div key={cat}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6, marginTop: 14 }}>{cat.toUpperCase()}</div>
              {schedule.filter(i => i.category === cat).slice(0, 3).map((item) => {
                const done = completedItems[item.id];
                return (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: done ? 400 : 600, textDecoration: done ? "line-through" : "none", opacity: done ? 0.5 : 1 }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{item.frequency}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {!done && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, color: urgencyColor[item.urgency], background: `${urgencyColor[item.urgency]}20` }}>{urgencyLabel[item.urgency]}</span>}
                      <button onClick={() => setCompletedItems(p => ({ ...p, [item.id]: !p[item.id] }))} style={{ background: done ? COLORS.tealLight : "none", border: `1.5px solid ${done ? COLORS.tealLight : COLORS.border}`, borderRadius: 12, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {done && <CheckCircle2 size={12} color="#06140F" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 10, marginBottom: 20 }}>
            {schedule.filter(i => i.urgency === "overdue").length} overdue · {schedule.filter(i => i.urgency === "due_soon").length} due soon — full list saved to your profile
          </div>

          <button onClick={() => setStep(3)} style={{ width: "100%", background: COLORS.teal, border: "none", color: "#06140F", fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer" }}>
            Tell me about your health →
          </button>
        </div>
      )}

      {/* STEP 3: Health intake — purposeful questionnaire, no hiding behind chat */}
      {step === 3 && (
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Your health picture</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
            The more you share now, the more specific your advocate can be. Every field is optional — but each one changes the quality of what you get back.
          </div>

          {/* Primary concern */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>What's the one health thing you most want help with?</div>
            <textarea value={intake.primaryConcern} onChange={e => setIntake(p => ({ ...p, primaryConcern: e.target.value }))}
              placeholder="e.g. I've been feeling tired all the time and can't figure out why, or I want to understand my cholesterol results better..."
              rows={3} style={{ width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", resize: "none", lineHeight: 1.5 }} />
          </div>

          {/* Current conditions */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Current conditions — tap all that apply</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {commonConditions.map(c => (
                <button key={c} onClick={() => toggleChip(intake.conditions, "conditions", c)} style={{ padding: "6px 11px", borderRadius: 18, fontSize: 12, cursor: "pointer", background: intake.conditions.includes(c) ? COLORS.teal : COLORS.bgCardAlt, color: intake.conditions.includes(c) ? "#06140F" : COLORS.textSecondary, border: `1px solid ${intake.conditions.includes(c) ? COLORS.teal : COLORS.border}`, fontWeight: intake.conditions.includes(c) ? 600 : 400 }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Medications */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Current medications or supplements</div>
            {intake.medications.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{m}</span>
                <button onClick={() => setIntake(p => ({ ...p, medications: p.medications.filter((_, j) => j !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={13} /></button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={intake.medInput} onChange={e => setIntake(p => ({ ...p, medInput: e.target.value }))} onKeyDown={e => { if (e.key === "Enter" && intake.medInput.trim()) { setIntake(p => ({ ...p, medications: [...p.medications, p.medInput.trim()], medInput: "" })); } }} placeholder="Type a medication or supplement, press Enter" style={{ flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
              <button onClick={() => { if (intake.medInput.trim()) setIntake(p => ({ ...p, medications: [...p.medications, p.medInput.trim()], medInput: "" })); }} style={{ background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.tealLight, fontSize: 12, cursor: "pointer" }}>Add</button>
            </div>
          </div>

          {/* Family history */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Family history — first-degree relatives</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {familyConditions.map(c => (
                <button key={c} onClick={() => toggleChip(intake.familyHistory, "familyHistory", c)} style={{ padding: "6px 11px", borderRadius: 18, fontSize: 12, cursor: "pointer", background: intake.familyHistory.includes(c) ? `${COLORS.warning}30` : COLORS.bgCardAlt, color: intake.familyHistory.includes(c) ? COLORS.warning : COLORS.textSecondary, border: `1px solid ${intake.familyHistory.includes(c) ? COLORS.warning : COLORS.border}`, fontWeight: intake.familyHistory.includes(c) ? 600 : 400 }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Sleep and exercise */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Exercise frequency</div>
              {["Rarely", "1-2x/week", "3-4x/week", "5+/week"].map(opt => (
                <button key={opt} onClick={() => setIntake(p => ({ ...p, exercise: opt }))} style={{ display: "block", width: "100%", padding: "7px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", textAlign: "left", marginBottom: 5, background: intake.exercise === opt ? `${COLORS.teal}20` : COLORS.bgCardAlt, color: intake.exercise === opt ? COLORS.tealLight : COLORS.textSecondary, border: `1px solid ${intake.exercise === opt ? COLORS.tealLight : COLORS.border}` }}>{opt}</button>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Sleep quality</div>
              {["Poor", "Fair", "Good", "Excellent"].map(opt => (
                <button key={opt} onClick={() => setIntake(p => ({ ...p, sleep: opt }))} style={{ display: "block", width: "100%", padding: "7px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", textAlign: "left", marginBottom: 5, background: intake.sleep === opt ? `${COLORS.teal}20` : COLORS.bgCardAlt, color: intake.sleep === opt ? COLORS.tealLight : COLORS.textSecondary, border: `1px solid ${intake.sleep === opt ? COLORS.tealLight : COLORS.border}` }}>{opt}</button>
              ))}
            </div>
          </div>

          <button onClick={() => setStep(4)} style={{ width: "100%", background: COLORS.teal, border: "none", color: "#06140F", fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer" }}>
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
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Upload your bloodwork</div>
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
            <Card style={{ border: `1px solid ${COLORS.tealLight}40`, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 size={20} color={COLORS.tealLight} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{uploadedFileName}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>Ready to analyze</div>
                </div>
                <button onClick={() => { setUploadedFile(null); setUploadedFileName(null); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted }}><X size={16} /></button>
              </div>
            </Card>
          )}

          {/* Genetic testing offer — shown here because user now understands the platform */}
          <Card style={{ border: `1px solid ${COLORS.gold}40`, background: "#1A1610", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Dna size={18} color={COLORS.gold} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Want deeper personalization? Order a genetic panel.</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
                  A genetic panel tells your advocate how you process medications, which supplements actually work for your biology, and your hereditary risk factors. It changes the specificity of everything.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ background: COLORS.gold, border: "none", color: "#06140F", fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>Order panel — $299</button>
                  <button style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: 11, padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>I already have 23andMe data →</button>
                </div>
              </div>
            </div>
          </Card>

          <button onClick={generateInsight} style={{ width: "100%", background: COLORS.teal, border: "none", color: "#06140F", fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer" }}>
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
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Hi {profile.name}</div>
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
              <button onClick={() => onComplete({ profile, intake, schedule, completedItems })} style={{ width: "100%", background: COLORS.teal, border: "none", color: "#06140F", fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer" }}>
                Go to my health record
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function useScoreModel(nutritionEnabled) {
  const baseItems = [
    { name: "Annual physical", status: "current", detail: "Completed Mar 2026", pts: 8, max: 8 },
    { name: "Comprehensive bloodwork", status: "current", detail: "Completed Jan 2026", pts: 8, max: 8 },
    { name: "Monthly bloodwork (TRT panel)", status: "due_soon", detail: "Due in 6 days, tracks hormone levels while on therapy", pts: 2, max: 8, action: "Complete this month's TRT panel" },
    { name: "Colonoscopy", status: "overdue", detail: "Due at 45, last completed at 42", pts: 0, max: 10, action: "Schedule your colonoscopy" },
    { name: "Prostate exam (PSA)", status: "due_soon", detail: "Due within 3 months", pts: 4, max: 8, action: "Book your PSA screening" },
    { name: "EEG / baseline neuro screen", status: "current", detail: "Completed Aug 2025", pts: 8, max: 8 },
    { name: "Skin cancer screening", status: "overdue", detail: "Over 18 months since last visit", pts: 0, max: 8, action: "Schedule a skin check" },
  ];

  // Daily training effort, scored from Zone 2+ minutes reported by the wearable.
  // Tiers: under 20 min = below threshold, 20-29 = partial credit scaling up,
  // 30-44 = full points (the target), 45+ = capped bonus, no reward past the cap.
  const zone2Minutes = 34;
  const scoreEffort = (min, max) => {
    if (min < 20) return Math.round((min / 20) * (max * 0.4));
    if (min < 30) return Math.round((max * 0.4) + ((min - 20) / 10) * (max * 0.6));
    return max;
  };

  // Nutrition is opt-in, set on the Profile page. When off, the daily score is built from
  // sleep, training effort, and the wake-up check-in at their full weights, out of 50. When
  // on, nutrition becomes a real fourth component and the other three shrink proportionally
  // to make room, so the daily ring always reads as "100% of what you've chosen to track,"
  // rather than nutrition being extra credit stacked on top of an already-full scale.
  const baseWeights = { sleep: 15, effort: 15, wakeup: 20 };
  const nutritionWeight = 10;
  let weights;
  if (nutritionEnabled) {
    const remaining = 50 - nutritionWeight;
    const sumBase = baseWeights.sleep + baseWeights.effort + baseWeights.wakeup;
    weights = {
      sleep: Math.round((baseWeights.sleep / sumBase) * remaining),
      effort: Math.round((baseWeights.effort / sumBase) * remaining),
      wakeup: Math.round((baseWeights.wakeup / sumBase) * remaining),
      nutrition: nutritionWeight,
    };
  } else {
    weights = { ...baseWeights, nutrition: 0 };
  }

  const effortPts = scoreEffort(zone2Minutes, weights.effort);
  const nutritionLogged = false; // today's logging state; toggled per day, separate from the opt-in setting
  const nutritionPts = nutritionEnabled && nutritionLogged ? Math.round(weights.nutrition * 0.8) : 0;

  const dailyItems = [
    { name: "Sleep score (Oura)", value: "82", note: "Good night last night", pts: weights.sleep, max: weights.sleep },
    { name: "Training effort (Zone 2+)", value: `${zone2Minutes} min`, note: "Target: 30 min Zone 2 or higher", pts: effortPts, max: weights.effort },
    { name: "Wake-up check-in", value: "Logged", note: "Felt rested", pts: weights.wakeup, max: weights.wakeup },
  ];
  if (nutritionEnabled) {
    dailyItems.push({
      name: "Nutrition", value: nutritionLogged ? "Logged" : "Not logged today",
      note: "Opted in on your profile", pts: nutritionPts, max: weights.nutrition,
      action: nutritionLogged ? undefined : "Log today's meals",
    });
  }

  const baseTotal = baseItems.reduce((s, i) => s + i.pts, 0);
  const baseMax = baseItems.reduce((s, i) => s + i.max, 0);
  const dailyTotal = dailyItems.reduce((s, i) => s + i.pts, 0);
  const dailyMax = dailyItems.reduce((s, i) => s + i.max, 0);

  // The gauge displays everything on a consistent 0-50 scale per ring regardless of how
  // many raw points the underlying item list sums to, since baseMax in particular isn't
  // a round number.
  const baseDisplay = Math.round((baseTotal / baseMax) * 50);
  const dailyDisplay = Math.round((dailyTotal / dailyMax) * 50);

  return {
    baseItems, dailyItems, nutritionEnabled, nutritionLogged,
    baseTotal, baseMax, dailyTotal, dailyMax, baseDisplay, dailyDisplay,
  };
}

function ScoreBreakdownModal({ onClose, nutritionEnabled }) {
  const {
    baseItems, dailyItems,
    baseTotal, baseMax, dailyTotal, dailyMax,
  } = useScoreModel(nutritionEnabled);

  const statusMeta = {
    current: { color: COLORS.tealLight, label: "Current", icon: ShieldCheck },
    due_soon: { color: COLORS.warning, label: "Due soon", icon: Calendar },
    overdue: { color: COLORS.danger, label: "Overdue", icon: AlertCircle },
  };

  const ItemRow = ({ item, statusBadge, last }) => {
    const gap = item.max - item.pts;
    return (
      <div style={{ padding: "10px 0", borderBottom: last ? "none" : `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {statusBadge}
            <div>
              <div style={{ fontSize: 13 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>{item.detail || item.note}</div>
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: gap === 0 ? COLORS.tealLight : COLORS.textSecondary, whiteSpace: "nowrap" }}>
            {item.pts}/{item.max} pts
          </span>
        </div>
        {item.action && (
          <div style={{
            marginTop: 8, marginLeft: 26, display: "flex", justifyContent: "space-between",
            alignItems: "center", background: COLORS.bgCardAlt, borderRadius: 8, padding: "7px 10px"
          }}>
            <span style={{ fontSize: 12, color: COLORS.textPrimary }}>{item.action}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.tealLight }}>+{gap} pts</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%", zIndex: 100,
      background: "#050B09", display: "flex", flexDirection: "column",
      padding: "20px 18px 100px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Score breakdown</div>
        <button onClick={onClose} style={{
          background: COLORS.bgCardAlt, border: "none", borderRadius: 16, width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
        }}><X size={16} color={COLORS.textSecondary} /></button>
      </div>

      <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 18 }}>
        Your score has two parts. The base reflects whether you're current on the screenings
        and bloodwork that matter for your age. The daily score reflects how you're tracking
        right now, sleep, activity, and check-ins. Each item below shows what it's worth and
        what to do to earn the rest.
      </div>

      <SectionLabel>Base score &middot; {baseTotal} of {baseMax} pts &middot; long-term preventive care</SectionLabel>
      <Card>
        {baseItems.map((item, i) => (
          <ItemRow key={item.name} item={item}
            statusBadge={(() => { const m = statusMeta[item.status]; return <m.icon size={16} color={m.color} style={{ marginTop: 1 }} />; })()}
            last={i === baseItems.length - 1} />
        ))}
      </Card>

      <div style={{
        background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
        color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 18
      }}>
        Completing your colonoscopy, skin check, and this month's TRT panel would add
        {" "}{baseMax - baseTotal} pts to your base score on their own, no daily changes needed.
      </div>

      <SectionLabel>Daily score &middot; {dailyTotal} of {dailyMax} pts &middot; sleep, training, monitoring</SectionLabel>
      <Card>
        {dailyItems.map((item, i) => (
          <ItemRow key={item.name} item={item}
            statusBadge={<div style={{ width: 16 }} />}
            last={i === dailyItems.length - 1} />
        ))}
      </Card>

      {!nutritionEnabled && (
        <Card style={{ border: `1px dashed ${COLORS.textMuted}50` }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Want nutrition in your daily score?</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
            Turn it on from your profile. It becomes a real part of your daily score, and
            the other categories adjust their weight to make room for it.
          </div>
        </Card>
      )}

      <div style={{
        background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
        color: COLORS.textSecondary, lineHeight: 1.5
      }}>
        Completing this month's TRT panel would add {baseItems.find(i => i.name.includes("Monthly bloodwork"))?.max - baseItems.find(i => i.name.includes("Monthly bloodwork"))?.pts} pts
        to your base score, no daily changes needed.
      </div>
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: COLORS.bgCard, borderRadius: 16, border: `1px solid ${COLORS.border}`,
      padding: 16, marginBottom: 14, ...style
    }}>{children}</div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: 1.2, color: COLORS.gold,
      textTransform: "uppercase", marginBottom: 10
    }}>{children}</div>
  );
}

function ScoreTrendChart() {
  // last 14 days: base and daily points (each out of 50)
  const rawData = [
    { base: 30, daily: 20 }, { base: 30, daily: 24 }, { base: 30, daily: 18 },
    { base: 30, daily: 27 }, { base: 32, daily: 22 }, { base: 32, daily: 19 },
    { base: 32, daily: 25 }, { base: 32, daily: 30 }, { base: 32, daily: 21 },
    { base: 32, daily: 17 }, { base: 28, daily: 20 }, { base: 28, daily: 26 },
    { base: 28, daily: 19 }, { base: 26, daily: 50 },
  ];
  const todayDate = new Date(2026, 5, 29); // June 29, 2026
  const data = rawData.map((d, i) => {
    const date = new Date(todayDate);
    date.setDate(date.getDate() - (rawData.length - 1 - i));
    return { ...d, date };
  });

  const [hoverIdx, setHoverIdx] = useState(null);
  const w = 320, h = 110, padTop = 8, padBottom = 18, max = 100;
  const innerH = h - padTop - padBottom;
  const stepX = w / (data.length - 1);

  const baseLine = data.map((d, i) => [i * stepX, padTop + innerH * (1 - d.base / max)]);
  const totalLine = data.map((d, i) => [i * stepX, padTop + innerH * (1 - (d.base + d.daily) / max)]);

  const path = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const baseAreaPath = `${path(baseLine)} L${(data.length - 1) * stepX},${padTop + innerH} L0,${padTop + innerH} Z`;
  const totalAreaPath = `${path(totalLine)} L${(data.length - 1) * stepX},${padTop + innerH} L0,${padTop + innerH} Z`;

  const todayTotal = data[data.length - 1].base + data[data.length - 1].daily;
  const weekAgoTotal = data[data.length - 7].base + data[data.length - 7].daily;
  const delta = todayTotal - weekAgoTotal;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round(x / stepX);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  const hoveredTotal = hovered ? hovered.base + hovered.daily : null;
  const hoveredX = hoverIdx !== null ? hoverIdx * stepX : null;
  const hoveredY = hoverIdx !== null ? totalLine[hoverIdx][1] : null;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <SectionLabel>14-day trend</SectionLabel>
        <span style={{ fontSize: 12, color: delta >= 0 ? COLORS.tealLight : COLORS.danger, fontWeight: 600 }}>
          {delta >= 0 ? "+" : ""}{delta} pts vs last week
        </span>
      </div>
      <div style={{ position: "relative" }}>
        {hoverIdx !== null && (
          <div style={{
            position: "absolute", pointerEvents: "none", zIndex: 5,
            left: `${(hoveredX / w) * 100}%`, top: 0,
            transform: hoveredX / w > 0.6 ? "translateX(-100%)" : "translateX(0%)",
            background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: "6px 9px", whiteSpace: "nowrap"
          }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{fmtDate(hovered.date)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{hoveredTotal} pts</div>
          </div>
        )}
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
          onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}
          style={{ touchAction: "none" }}>
          <path d={totalAreaPath} fill={COLORS.tealLight} opacity="0.22" />
          <path d={path(totalLine)} fill="none" stroke={COLORS.tealLight} strokeWidth="2" />
          <path d={baseAreaPath} fill={COLORS.gold} opacity="0.30" />
          <path d={path(baseLine)} fill="none" stroke={COLORS.gold} strokeWidth="2" />
          {hoverIdx !== null && (
            <g>
              <line x1={hoveredX} y1={padTop} x2={hoveredX} y2={padTop + innerH}
                stroke={COLORS.textMuted} strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={hoveredX} cy={hoveredY} r="4" fill={COLORS.tealLight} stroke={COLORS.bgDeep} strokeWidth="1.5" />
            </g>
          )}
        </svg>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: COLORS.textMuted }}>{fmtDate(data[0].date)}</span>
        <span style={{ fontSize: 10, color: COLORS.textMuted }}>Today</span>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.gold }} />
          <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Base</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.tealLight }} />
          <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Total (base + daily)</span>
        </div>
      </div>
    </Card>
  );
}

// ---- HOME SCREEN ----
// ---- PROFILE SCREEN ----
// ---- GENETIC PROFILE SCREEN ----
// Shows known genetic markers split into two distinct sections:
// 1. Supplement & lifestyle markers (lower stakes, actionable at user level)
// 2. Pharmacogenomic markers (medication metabolism, higher stakes, physician-discussion framing)
// Each marker shows what it means for this specific user, not a generic description.
function GeneticProfileScreen({ setActive }) {
  const [activeSection, setActiveSection] = useState("lifestyle"); // lifestyle | pharma

  // Supplement & lifestyle markers. These are from the user's imported 23andMe data
  // and the clinical genetic panel. In production, populated from the actual import.
  const lifestyleMarkers = [
    {
      gene: "MTHFR",
      variant: "C677T heterozygous",
      status: "variant",
      impact: "Moderate",
      title: "Folate processing — reduced efficiency",
      what: "Your MTHFR enzyme runs at roughly 65% efficiency, reducing your ability to convert folic acid into its active form (methylfolate). This affects B vitamin metabolism, homocysteine regulation, and methylation broadly.",
      forYou: [
        "Take methylfolate (L-5-MTHF) rather than folic acid — standard folic acid may not convert properly for you.",
        "Methylcobalamin (active B12) is preferable to cyanocobalamin for the same reason.",
        "Your homocysteine should be checked annually — elevated homocysteine is a cardiovascular risk factor your standard panel may not include.",
        "When you see TikTok content recommending B-complex supplements, the form matters for you specifically. Most cheap B-complexes use folic acid, not methylfolate.",
      ],
      aiContext: "MTHFR C677T heterozygous: supplement recommendations should specify methylated B vitamins. Flag any folic acid recommendations as potentially suboptimal.",
    },
    {
      gene: "VDR",
      variant: "Taq1 TT",
      status: "variant",
      impact: "Moderate",
      title: "Vitamin D receptor — reduced absorption efficiency",
      what: "Your vitamin D receptor variant reduces how efficiently your cells respond to vitamin D, meaning you may need higher serum levels than standard reference ranges to achieve the same cellular effect.",
      forYou: [
        "Your current level of 28 ng/mL is low for anyone, but especially so given this variant. Target serum level is likely 50-70 ng/mL for you rather than the standard 30-50 ng/mL floor.",
        "Vitamin D3 with K2 (already ordered) is the right form. Consider a higher dose than standard — worth discussing with your physician.",
        "Magnesium is required to activate vitamin D — deficiency in one limits the other.",
        "Retest in 8-10 weeks after supplementing, not the standard 12 weeks, given absorption efficiency.",
      ],
      aiContext: "VDR Taq1 TT: Vitamin D needs are elevated above standard reference ranges. Current level of 28 ng/mL is more concerning than it would be for a standard genotype.",
    },
    {
      gene: "COMT",
      variant: "Val158Met heterozygous",
      status: "variant",
      impact: "Moderate",
      title: "Dopamine & estrogen metabolism — slower breakdown",
      what: "COMT breaks down dopamine, adrenaline, and estrogens. Your variant reduces this enzyme's activity somewhat, meaning these compounds clear more slowly. This affects stress response, mood regulation, and estrogen balance.",
      forYou: [
        "You may be more sensitive to high-stress periods and slower to return to baseline after them — relevant to your CrossFit competition load.",
        "Caffeine timing matters more for you: late-day caffeine will affect sleep more than it would a fast COMT metabolizer.",
        "Magnesium and B6 support COMT function and are particularly relevant given this variant.",
        "When you see content about 'estrogen detox' supplements — DIM, calcium d-glucarate — there is a legitimate basis for this given your COMT status, worth discussing rather than dismissing.",
      ],
      aiContext: "COMT Val158Met heterozygous: slower dopamine and estrogen clearance. Relevant to stress recovery, caffeine sensitivity, and estrogen metabolism recommendations.",
    },
    {
      gene: "ACTN3",
      variant: "RR genotype",
      status: "favorable",
      impact: "Informative",
      title: "Muscle fiber composition — power-oriented",
      what: "ACTN3 R577X determines whether you produce alpha-actinin-3, a protein found only in fast-twitch muscle fibers. Your RR genotype means you produce it fully, strongly associated with power and sprint performance.",
      forYou: [
        "Your genetics support the power/strength profile consistent with competitive CrossFit — this isn't just training, it's partly your biology.",
        "Zone 2 cardio will still improve your aerobic base and is important for longevity, but your natural adaptation leans toward high-intensity work.",
        "Recovery from high-intensity sessions may require more deliberate attention than it would for a slower-twitch dominant athlete.",
        "Creatine monohydrate has stronger evidence for RR genotypes than for XX genotypes — worth including in your supplement stack.",
      ],
      aiContext: "ACTN3 RR: power-oriented muscle fiber genetics. Creatine has stronger evidence base. High-intensity training is naturally well-suited.",
    },
    {
      gene: "FUT2",
      variant: "Non-secretor (AA)",
      status: "variant",
      impact: "Moderate",
      title: "Gut microbiome & probiotic response",
      what: "FUT2 secretor status determines which carbohydrate structures you express on your gut lining, directly affecting which bacteria can colonize there. Non-secretors like you have a different microbiome composition and respond differently to probiotic strains.",
      forYou: [
        "Lactobacillus and many Bifidobacterium strains have weaker evidence for non-secretors. Standard probiotic products marketed broadly may give you little benefit.",
        "Saccharomyces boulardii is effective regardless of secretor status and is a better starting point.",
        "Non-secretors have elevated susceptibility to certain gut infections (H. pylori, norovirus) — relevant to your health record.",
        "Prebiotic fiber (specifically pectin and resistant starch) is more reliably beneficial for you than probiotic supplements.",
      ],
      aiContext: "FUT2 non-secretor: standard probiotic recommendations are less applicable. Saccharomyces boulardii and prebiotic fiber are better starting points.",
    },
    {
      gene: "HLA-DQ",
      variant: "DQ2.5 heterozygous",
      status: "watch",
      impact: "Watch",
      title: "Autoimmune & gluten sensitivity risk",
      what: "HLA-DQ2.5 is present in over 95% of people with celiac disease, though most DQ2.5 carriers never develop celiac. It also confers elevated risk for certain other autoimmune conditions. Given your rising TPO antibodies, this is worth tracking.",
      forYou: [
        "You don't necessarily have celiac disease, but you carry the genetic prerequisite. Given your TPO antibody trend, an anti-gliadin antibody test and anti-tTG antibody test at your next panel would be informative.",
        "If your TPO antibodies continue rising, a gluten-free trial for 8-12 weeks has evidence for reducing thyroid antibodies in HLA-DQ2.5 carriers with autoimmune thyroid involvement.",
        "This marker is directly relevant to your existing lab pattern and worth raising explicitly at your endocrinology appointment.",
      ],
      aiContext: "HLA-DQ2.5 heterozygous: elevated autoimmune susceptibility, directly relevant to rising TPO antibody trend. Celiac screening and gluten-autoimmune connection should be considered.",
    },
  ];

  // Pharmacogenomic markers. These govern drug metabolism and carry different framing:
  // always described as "discuss with your prescriber" not "here's what to do."
  const pharmaMarkers = [
    {
      gene: "CYP2D6",
      variant: "Intermediate metabolizer",
      status: "watch",
      impact: "Clinical",
      title: "Antidepressants, opioids, ADHD medications",
      what: "CYP2D6 metabolizes roughly 25% of commonly prescribed drugs. Intermediate metabolizers process these drugs more slowly than average, meaning standard doses may produce higher-than-expected blood levels.",
      medications: [
        { name: "SSRIs (fluoxetine, paroxetine, sertraline)", note: "May accumulate; start low, monitor closely" },
        { name: "Codeine", note: "Reduced conversion to morphine; less effective for pain" },
        { name: "Tamoxifen", note: "Reduced activation; discuss alternative breast cancer treatments if relevant" },
        { name: "Atomoxetine (Strattera)", note: "Significantly elevated plasma levels; dose adjustment needed" },
        { name: "Beta-blockers (metoprolol)", note: "Enhanced and prolonged effect; lower doses may be appropriate" },
      ],
      discuss: "Before starting any new psychiatric, pain, or cardiac medication, let your prescriber know you are a CYP2D6 intermediate metabolizer. Ask whether a pharmacogenomic dose adjustment is appropriate.",
      aiContext: "CYP2D6 intermediate metabolizer: SSRIs, codeine, tamoxifen, atomoxetine, and beta-blockers all require prescriber discussion. Standard doses may accumulate.",
    },
    {
      gene: "CYP2C19",
      variant: "Normal metabolizer",
      status: "normal",
      impact: "Informative",
      title: "Blood thinners, PPIs, antidepressants",
      what: "CYP2C19 metabolizes clopidogrel (Plavix), proton pump inhibitors (omeprazole), and several antidepressants. Your normal metabolizer status means standard doses of these medications are appropriate.",
      medications: [
        { name: "Clopidogrel (Plavix)", note: "Normal conversion to active form — standard dosing appropriate" },
        { name: "Omeprazole / pantoprazole", note: "Standard metabolism — normal dosing appropriate" },
      ],
      discuss: "No dose adjustments needed for CYP2C19-metabolized drugs based on this result.",
      aiContext: "CYP2C19 normal metabolizer: no pharmacogenomic concerns for this pathway.",
    },
    {
      gene: "CYP1A2",
      variant: "Slow metabolizer",
      status: "variant",
      impact: "Clinical",
      title: "Caffeine, certain antidepressants, clozapine",
      what: "CYP1A2 metabolizes caffeine, theophylline, and several psychiatric medications. Slow metabolizers clear these compounds significantly more slowly than average.",
      medications: [
        { name: "Caffeine", note: "Clears slowly — elevated cardiovascular risk from heavy caffeine intake; afternoon coffee is more disruptive to sleep than average" },
        { name: "Clozapine", note: "Significant accumulation risk; psychiatrist must be informed" },
        { name: "Theophylline", note: "Narrow therapeutic window; dose adjustment required" },
      ],
      discuss: "Your slow caffeine metabolism is clinically relevant. Limit intake to before noon. If ever prescribed clozapine or theophylline, your prescriber must know your CYP1A2 status.",
      aiContext: "CYP1A2 slow metabolizer: caffeine clears slowly — directly relevant to sleep quality and HRV. Afternoon caffeine is a meaningful contributing factor to below-baseline device readings.",
    },
    {
      gene: "SLCO1B1",
      variant: "rs4149056 heterozygous",
      status: "watch",
      impact: "Clinical",
      title: "Statin-induced muscle damage risk",
      what: "SLCO1B1 affects how statins are transported into the liver. Your variant is associated with a significantly elevated risk of statin-induced myopathy (muscle breakdown) at standard doses.",
      medications: [
        { name: "Simvastatin", note: "High myopathy risk — avoid or use very low dose" },
        { name: "Atorvastatin", note: "Moderate risk — if prescribed, start at lowest dose and monitor CK levels" },
        { name: "Rosuvastatin / pravastatin", note: "Lower SLCO1B1 dependence — safer options if a statin is needed" },
      ],
      discuss: "If a statin is ever recommended for cardiovascular risk, inform your prescriber of this result. Rosuvastatin or pravastatin are safer options for your genotype than simvastatin or high-dose atorvastatin.",
      aiContext: "SLCO1B1 variant: elevated statin myopathy risk. If statin therapy is ever discussed, rosuvastatin or pravastatin are preferable genotype-appropriate options.",
    },
    {
      gene: "CYP2C9",
      variant: "Normal metabolizer",
      status: "normal",
      impact: "Informative",
      title: "Warfarin, NSAIDs, diabetes medications",
      what: "CYP2C9 metabolizes warfarin, ibuprofen, celecoxib, and some diabetes drugs. Normal metabolizer status means standard dosing is appropriate.",
      medications: [
        { name: "Warfarin", note: "Standard dosing appropriate — no dose adjustment needed" },
        { name: "NSAIDs (ibuprofen, celecoxib)", note: "Normal metabolism" },
      ],
      discuss: "No dose adjustments needed for CYP2C9-metabolized drugs.",
      aiContext: "CYP2C9 normal metabolizer: no pharmacogenomic concerns for warfarin or NSAIDs.",
    },
  ];

  const statusColors = {
    normal: COLORS.tealLight,
    favorable: COLORS.tealLight,
    variant: COLORS.warning,
    watch: COLORS.danger,
  };

  const impactBg = {
    "Informative": COLORS.bgCardAlt,
    "Moderate": "#1A1610",
    "Clinical": "#1A1212",
    "Watch": "#1A1212",
  };

  const LifestyleMarkerCard = ({ m }) => {
    const [open, setOpen] = useState(false);
    return (
      <Card style={{ border: `1px solid ${statusColors[m.status]}30`, background: impactBg[m.impact] }}>
        <button onClick={() => setOpen(!open)} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{m.gene}</span>
                <span style={{
                  fontSize: 10, color: statusColors[m.status], background: `${statusColors[m.status]}20`,
                  padding: "2px 7px", borderRadius: 5, fontWeight: 600
                }}>{m.variant}</span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{m.title}</div>
            </div>
            <ChevronRight size={16} color={COLORS.textMuted} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginTop: 2 }} />
          </div>
        </button>
        {open && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
              {m.what}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.gold, marginBottom: 8, letterSpacing: 0.5 }}>
              WHAT THIS MEANS FOR YOU
            </div>
            {m.forYou.map((point, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                <span style={{ color: COLORS.tealLight, flexShrink: 0, marginTop: 1 }}>·</span>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>{point}</span>
              </div>
            ))}
            <div style={{
              marginTop: 12, padding: "8px 10px", background: COLORS.bgCard,
              borderRadius: 8, display: "flex", gap: 6, alignItems: "flex-start"
            }}>
              <Sparkles size={12} color={COLORS.tealLight} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                Your AI advocate uses this when you ask about supplements, nutrition, or lifestyle recommendations.
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  const PharmaMarkerCard = ({ m }) => {
    const [open, setOpen] = useState(false);
    return (
      <Card style={{ border: `1px solid ${statusColors[m.status]}30`, background: impactBg[m.impact] }}>
        <button onClick={() => setOpen(!open)} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{m.gene}</span>
                <span style={{
                  fontSize: 10, color: statusColors[m.status], background: `${statusColors[m.status]}20`,
                  padding: "2px 7px", borderRadius: 5, fontWeight: 600
                }}>{m.variant}</span>
                <span style={{
                  fontSize: 10, color: m.impact === "Clinical" ? COLORS.danger : COLORS.textMuted,
                  background: COLORS.bgCardAlt, padding: "2px 7px", borderRadius: 5
                }}>{m.impact}</span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{m.title}</div>
            </div>
            <ChevronRight size={16} color={COLORS.textMuted} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginTop: 2 }} />
          </div>
        </button>
        {open && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
              {m.what}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.warning, marginBottom: 8, letterSpacing: 0.5 }}>
              AFFECTED MEDICATIONS
            </div>
            {m.medications.map((med, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", padding: "7px 0",
                borderBottom: i < m.medications.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <span style={{ fontSize: 12, flex: 1 }}>{med.name}</span>
                <span style={{ fontSize: 11, color: COLORS.textMuted, maxWidth: 160, textAlign: "right" }}>{med.note}</span>
              </div>
            ))}
            <div style={{
              marginTop: 12, padding: "10px 12px",
              background: m.status === "normal" ? COLORS.bgCard : "#1A1212",
              border: `1px solid ${m.status === "normal" ? COLORS.border : COLORS.danger + "40"}`,
              borderRadius: 10
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: m.status === "normal" ? COLORS.tealLight : COLORS.warning, marginBottom: 4 }}>
                DISCUSS WITH YOUR PRESCRIBER
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>{m.discuss}</div>
            </div>
            <div style={{
              marginTop: 10, padding: "8px 10px", background: COLORS.bgCard,
              borderRadius: 8, display: "flex", gap: 6, alignItems: "flex-start"
            }}>
              <Sparkles size={12} color={COLORS.tealLight} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                Your AI advocate flags this when you ask about medications. It never tells you what to take — it ensures you ask the right questions of the right person.
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("profile")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Profile
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Genetic profile</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>
        Based on your imported 23andMe data and clinical panel.
      </div>
      <div style={{
        fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 22,
        padding: "10px 12px", background: COLORS.bgCardAlt, borderRadius: 10
      }}>
        These markers inform your AI advocate's recommendations. They are not diagnoses.
        Pharmacogenomic findings should always be discussed with a licensed prescriber before
        any medication change.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setActiveSection("lifestyle")} style={{
          flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: activeSection === "lifestyle" ? COLORS.teal : COLORS.bgCardAlt,
          color: activeSection === "lifestyle" ? "#06140F" : COLORS.textSecondary, border: "none"
        }}>Supplements & lifestyle</button>
        <button onClick={() => setActiveSection("pharma")} style={{
          flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: activeSection === "pharma" ? COLORS.teal : COLORS.bgCardAlt,
          color: activeSection === "pharma" ? "#06140F" : COLORS.textSecondary, border: "none"
        }}>Pharmacogenomics</button>
      </div>

      {activeSection === "lifestyle" && (
        <>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
            Tap any marker to see what it means for your supplement and lifestyle decisions specifically.
          </div>
          {lifestyleMarkers.map(m => <LifestyleMarkerCard key={m.gene} m={m} />)}
          <button onClick={() => setActive("importlabs")} style={{
            width: "100%", background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.gold}50`,
            borderRadius: 14, padding: "14px", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, color: COLORS.gold, fontSize: 13,
            fontWeight: 600, cursor: "pointer", marginTop: 6
          }}>
            <Dna size={16} /> Import additional genetic data
          </button>
        </>
      )}

      {activeSection === "pharma" && (
        <>
          <div style={{
            padding: "10px 12px", background: "#1A1212", border: `1px solid ${COLORS.danger}30`,
            borderRadius: 10, fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 14
          }}>
            Pharmacogenomic findings show how your genes affect drug metabolism. This information
            is for discussion with your prescriber only. Never adjust or stop a medication based
            on this screen alone.
          </div>
          {pharmaMarkers.map(m => <PharmaMarkerCard key={m.gene} m={m} />)}
        </>
      )}
    </div>
  );
}

function ProfileScreen({ setActive, nutritionEnabled, setNutritionEnabled }) {
  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Home
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Your profile</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Adam Locker &middot; On TRT &middot; Member since Jun 2026
      </div>

      <SectionLabel>Genetic profile</SectionLabel>
      <button onClick={() => setActive("geneticprofile")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.gold}50`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 10
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Dna size={18} color={COLORS.gold} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>View genetic markers</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>6 lifestyle markers · 5 pharmacogenomic markers</div>
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
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>2 prescriptions · 2 supplements · no flags</div>
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
              width: 20, height: 20, borderRadius: 10, background: nutritionEnabled ? "#06140F" : COLORS.textMuted,
              position: "absolute", top: 3, left: nutritionEnabled ? 23 : 3, transition: "left 0.2s"
            }} />
          </button>
        </div>
      </Card>

      <SectionLabel>Current therapies</SectionLabel>
      <Card>
        <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
          Testosterone Replacement Therapy (TRT), monitored monthly
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
          Used to recommend monthly panels and check supplement interactions.
        </div>
      </Card>

      <SectionLabel>Connected devices</SectionLabel>
      <Card>
        {[
          { name: "Oura Ring", status: "connected", sync: "4m ago" },
          { name: "Eight Sleep", status: "connected", sync: "12m ago" },
          { name: "Apple Watch", status: "available" },
          { name: "WHOOP", status: "available" },
          { name: "Garmin", status: "available" },
          { name: "Continuous glucose monitor (CGM)", status: "available" },
          { name: "Apple Health", status: "available" },
          { name: "Google Fit", status: "available" },
        ].map((device, i, arr) => (
          <div key={device.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{device.name}</span>
            {device.status === "connected"
              ? <span style={{ fontSize: 12, color: COLORS.tealLight }}>Synced {device.sync}</span>
              : <button style={{
                background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 7,
                color: COLORS.textMuted, fontSize: 11, padding: "4px 10px", cursor: "pointer"
              }}>Connect</button>
            }
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---- BODY SCREEN (vitals, sleep detail, weight & composition) ----
// ---- WEIGHT / BODY FAT HISTORY (tap-in trend view) ----
function BodyMetricHistory({ metric, onClose }) {
  const isWeight = metric === "weight";
  const unit = isWeight ? "lb" : "%";
  const label = isWeight ? "Weight" : "Body fat";
  const color = isWeight ? COLORS.tealLight : COLORS.gold;

  // 12 weeks of data, weekly cadence rather than daily, since daily weight/body fat
  // readings are noisy (water, sodium, glycogen) and a daily trend would visually
  // overstate normal fluctuation as if it were meaningful progress or regression.
  const weightData = [211, 210, 209, 208.5, 207, 206, 205.5, 204, 203.5, 203, 202.5, 202];
  const bodyFatData = [19.8, 19.5, 19.1, 18.8, 18.5, 18.2, 17.9, 17.8, 17.7, 17.6, 17.5, 17.5];
  const data = isWeight ? weightData : bodyFatData;
  const goal = isWeight ? 195 : 14;

  const [hoverIdx, setHoverIdx] = useState(null);
  const w = 320, h = 140, padTop = 16, padBottom = 24;
  const innerH = h - padTop - padBottom;
  const stepX = w / (data.length - 1);
  const allVals = [...data, goal];
  const maxV = Math.max(...allVals) + 1;
  const minV = Math.min(...allVals) - 1;
  const toY = (v) => padTop + innerH * (1 - (v - minV) / (maxV - minV));

  const points = data.map((v, i) => [i * stepX, toY(v)]);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const goalY = toY(goal);

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round(x / stepX);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const weekLabel = (i) => {
    const weeksAgo = data.length - 1 - i;
    return weeksAgo === 0 ? "This week" : `${weeksAgo}wk ago`;
  };

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%", zIndex: 100,
      background: "#050B09", display: "flex", flexDirection: "column",
      padding: "20px 18px 100px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{label} history</div>
        <button onClick={onClose} style={{
          background: COLORS.bgCardAlt, border: "none", borderRadius: 16, width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
        }}><X size={16} color={COLORS.textSecondary} /></button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>Start</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{data[0]} {unit}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>Current</div>
          <div style={{ fontSize: 16, fontWeight: 700, color }}>{data[data.length - 1]} {unit}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>Goal</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold }}>{goal} {unit}</div>
        </div>
      </div>

      <Card>
        <div style={{ position: "relative" }}>
          {hoverIdx !== null && (
            <div style={{
              position: "absolute", pointerEvents: "none", zIndex: 5,
              left: `${(hoverIdx * stepX / w) * 100}%`, top: 0,
              transform: (hoverIdx * stepX) / w > 0.6 ? "translateX(-100%)" : "translateX(0%)",
              background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
              padding: "6px 9px", whiteSpace: "nowrap"
            }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>{weekLabel(hoverIdx)}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{data[hoverIdx]} {unit}</div>
            </div>
          )}
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
            onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
            <line x1={0} y1={goalY} x2={w} y2={goalY} stroke={COLORS.gold} strokeWidth="1.5" strokeDasharray="4 4" />
            <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
            {hoverIdx !== null && (
              <circle cx={hoverIdx * stepX} cy={toY(data[hoverIdx])} r="4" fill={color} stroke={COLORS.bgDeep} strokeWidth="1.5" />
            )}
          </svg>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: COLORS.textMuted }}>{weekLabel(0)}</span>
          <span style={{ fontSize: 10, color: COLORS.textMuted }}>Today</span>
        </div>
      </Card>

      <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 4 }}>
        Shown weekly rather than daily. Day-to-day {label.toLowerCase()} naturally fluctuates
        with water, sodium, and glycogen, a single day's number isn't a meaningful read on
        progress.
      </div>
    </div>
  );
}

// ---- BODY SCREEN (vitals, sleep detail, weight & composition) ----
function BodyScreen({ setActive }) {
  const [editingGoals, setEditingGoals] = useState(false);
  const [weightGoal, setWeightGoal] = useState(195);
  const [bodyFatGoal, setBodyFatGoal] = useState(14);
  const [historyMetric, setHistoryMetric] = useState(null); // null | "weight" | "bodyfat"

  const currentWeight = 202;
  const currentBodyFat = 17.5;

  const sleepStages = [
    { label: "Deep", pct: 18, minutes: 78, color: "#1D9E75" },
    { label: "REM", pct: 24, minutes: 104, color: COLORS.tealLight },
    { label: "Light", pct: 51, minutes: 220, color: COLORS.gold },
    { label: "Awake", pct: 7, minutes: 30, color: COLORS.textMuted },
  ];

  const StatCard = ({ label, value, unit, sub, subColor }) => (
    <Card style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value} <span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textMuted }}>{unit}</span></div>
      {sub && <div style={{ fontSize: 11, color: subColor || COLORS.textSecondary, marginTop: 2 }}>{sub}</div>}
    </Card>
  );

  return (
    <div style={{ padding: "24px 18px", position: "relative" }}>
      {historyMetric && <BodyMetricHistory metric={historyMetric} onClose={() => setHistoryMetric(null)} />}

      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Home
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Body</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Today's vitals, sleep detail, and body composition trends.
      </div>

      <SectionLabel>Readiness</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.warning}40` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>68</div>
            <div style={{ fontSize: 11, color: COLORS.warning }}>Pay attention &middot; below your typical range</div>
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "right", maxWidth: 160 }}>
            Combines HRV, resting heart rate, sleep, and temperature into one score from your
            device.
          </div>
        </div>
      </Card>

      <SectionLabel>Vitals</SectionLabel>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <StatCard label="HRV" value="42" unit="ms" sub="Below baseline" subColor={COLORS.warning} />
        <StatCard label="Resting heart rate" value="58" unit="bpm" sub="+6 vs 3wk avg" subColor={COLORS.warning} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <StatCard label="Breathing rate" value="15.2" unit="br/min" sub="Normal range" subColor={COLORS.tealLight} />
        <StatCard label="Skin temp deviation" value="+0.4" unit="&deg;F" sub="Elevated 2 of last 4 nights" subColor={COLORS.warning} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <StatCard label="Body temp" value="98.9" unit="&deg;F" sub="Elevated" subColor={COLORS.warning} />
        <Card style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>VO2 max</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>46.2 <span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textMuted }}>ml/kg/min</span></div>
          <div style={{ fontSize: 11, color: COLORS.tealLight, marginTop: 2 }}>+0.8 over 8 weeks</div>
        </Card>
      </div>

      <SectionLabel>Sleep last night &middot; 7h 12m</SectionLabel>
      <Card>
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 10 }}>
          {sleepStages.map(s => (
            <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {sleepStages.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: s.color }} />
              <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{s.label} {s.minutes}m ({s.pct}%)</span>
            </div>
          ))}
        </div>
      </Card>

      <SectionLabel>Body composition</SectionLabel>
      <Card>
        <button onClick={() => setHistoryMetric("weight")} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
          textAlign: "left"
        }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
              Weight <ChevronRight size={11} color={COLORS.textMuted} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{currentWeight} <span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textMuted }}>lb</span></div>
          </div>
          <div style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Goal</div>
            {editingGoals ? (
              <input type="number" value={weightGoal} onChange={e => setWeightGoal(Number(e.target.value))} style={{
                width: 60, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                color: COLORS.textPrimary, fontSize: 14, padding: "4px 6px", textAlign: "right"
              }} />
            ) : (
              <div style={{ fontSize: 14, color: COLORS.tealLight }}>{weightGoal} lb</div>
            )}
          </div>
        </button>

        <button onClick={() => setHistoryMetric("bodyfat")} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
          textAlign: "left"
        }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
              Body fat <ChevronRight size={11} color={COLORS.textMuted} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{currentBodyFat}<span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textMuted }}>%</span></div>
          </div>
          <div style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Goal</div>
            {editingGoals ? (
              <input type="number" value={bodyFatGoal} onChange={e => setBodyFatGoal(Number(e.target.value))} style={{
                width: 60, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                color: COLORS.textPrimary, fontSize: 14, padding: "4px 6px", textAlign: "right"
              }} />
            ) : (
              <div style={{ fontSize: 14, color: COLORS.tealLight }}>{bodyFatGoal}%</div>
            )}
          </div>
        </button>

        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 14 }}>
          Tap weight or body fat to see your trend over time.
        </div>

        <button onClick={() => setEditingGoals(!editingGoals)} style={{
          width: "100%", background: editingGoals ? COLORS.teal : "none",
          border: editingGoals ? "none" : `1px solid ${COLORS.border}`,
          color: editingGoals ? "#06140F" : COLORS.tealLight,
          fontSize: 12, fontWeight: 600, padding: "9px", borderRadius: 8, cursor: "pointer"
        }}>
          {editingGoals ? "Save goals" : "Edit goals"}
        </button>
      </Card>
    </div>
  );
}

function HomeScreen({ setActive, goToMarket, nutritionEnabled, userProfile, healthHistory }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { baseDisplay, dailyDisplay } = useScoreModel(nutritionEnabled);
  const rec = getDailyRecommendation();
  const userName = userProfile?.profile?.name || "there";
  const initials = userName !== "there" ? userName[0].toUpperCase() : "?";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Two vitals chips from wearables — shown only when data exists
  const vitals = [
    { label: "HRV", value: "42ms", sub: "Below baseline", color: COLORS.warning },
    { label: "RHR", value: "64bpm", sub: "+12 vs baseline", color: COLORS.warning },
  ];

  // One contextual action button — the single most time-sensitive thing
  const contextualAction = (() => {
    if (!userProfile) return null;
    const overdue = userProfile.schedule?.filter(i => i.urgency === "overdue").length || 0;
    if (overdue > 0) return { label: `${overdue} overdue screening${overdue > 1 ? "s" : ""}`, target: "preventivecare", color: COLORS.danger };
    if (!healthHistory) return { label: "Complete your health history", target: "healthhistory", color: COLORS.tealLight };
    return null;
  })();

  return (
    <div style={{ padding: "24px 18px", position: "relative" }}>
      {showBreakdown && <ScoreBreakdownModal onClose={() => setShowBreakdown(false)} nutritionEnabled={nutritionEnabled} />}

      {/* Header — minimal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>{greeting}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{userName}</div>
        </div>
        <button onClick={() => setActive("profile")} style={{ width: 38, height: 38, borderRadius: 19, background: COLORS.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${COLORS.gold}`, cursor: "pointer", padding: 0 }}>
          <span style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13 }}>{initials}</span>
        </button>
      </div>

      {/* Element 1: Health score — one number, one sentence */}
      <button onClick={() => setShowBreakdown(true)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", marginBottom: 14 }}>
        <Card style={{ marginBottom: 0, textAlign: "center", paddingTop: 20, paddingBottom: 20 }}>
          <ScoreGauge basePts={baseDisplay} baseMax={50} dailyPts={dailyDisplay} dailyMax={50} onTap={() => setShowBreakdown(true)} />
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 10 }}>Tap to see what's driving your score today</div>
        </Card>
      </button>

      {/* Element 2: One action card — the single highest-priority signal */}
      {rec && (() => {
        const iconMap = { alert: AlertTriangle, moon: Moon, activity: Activity, sparkles: Sparkles };
        const Icon = iconMap[rec.icon] || Sparkles;
        const isUrgent = rec.priority >= 90;
        const color = isUrgent ? COLORS.warning : COLORS.tealLight;
        return (
          <Card style={{ border: `1px solid ${color}40`, background: isUrgent ? "#1A1812" : "#0F211D", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Icon size={18} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{rec.title}</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>{rec.body}</div>
                {rec.action && (
                  <button style={{ marginTop: 10, background: "none", border: `1px solid ${color}`, color, fontSize: 11, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: "pointer" }}
                    onClick={() => { if (rec.action.target === "discussion" || rec.action.target === "bodyfat_history") setActive(rec.action.target === "bodyfat_history" ? "body" : "discussion"); else goToMarket(rec.action.target); }}>
                    {rec.action.label} <ChevronRight size={11} style={{ display: "inline", verticalAlign: -1 }} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Element 3: Two vitals chips from wearables */}
      <button onClick={() => setActive("body")} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", marginBottom: 14 }}>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", gap: 0 }}>
            {vitals.map((v, i) => (
              <div key={v.label} style={{ flex: 1, textAlign: "center", padding: "4px 0", borderRight: i < vitals.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>{v.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{v.value}</div>
                <div style={{ fontSize: 10, color: v.color }}>{v.sub}</div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", paddingLeft: 12 }}>
              <ChevronRight size={14} color={COLORS.textMuted} />
            </div>
          </div>
        </Card>
      </button>

      {/* Element 4: One contextual action — the most time-sensitive item */}
      {contextualAction && (
        <button onClick={() => setActive(contextualAction.target)} style={{ width: "100%", background: "none", border: `1px solid ${contextualAction.color}40`, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ fontSize: 13, color: contextualAction.color, fontWeight: 600 }}>{contextualAction.label}</span>
          <ChevronRight size={14} color={contextualAction.color} />
        </button>
      )}
    </div>
  );
}

function CheckInScreen() {
  const [recording, setRecording] = useState(false);
  const [resultType, setResultType] = useState(null); // null | "routine" | "emergency"
  const [transcript, setTranscript] = useState("");

  // Simulated transcripts to demonstrate the triage split. In production this would be
  // real speech-to-text run through an urgency classifier before anything else happens.
  const sampleTranscripts = [
    { text: "Feeling a little run down, some chills, slept okay but woke up sore.", urgent: false },
    { text: "Crushing chest pain radiating down my left arm, having trouble breathing.", urgent: true },
  ];

  const recentNotes = [
    { time: "Today, 7:14 AM", note: "Wake-up: felt rested, slept well." },
    { time: "Yesterday, 4:52 PM", note: "Mild fatigue, cold sensitivity after the gym." },
    { time: "Yesterday, 9:10 AM", note: "Wake-up: a little sluggish, slept okay." },
    { time: "2 days ago, 6:30 PM", note: "Feeling normal, good energy all day." },
  ];

  // Keyword-based urgency check, a stand-in for a real clinical triage model. Any production
  // version of this needs validated clinical logic, not a keyword list, but the UI behavior
  // it drives, hard-stopping into an emergency state rather than filing into a pattern
  // review, should not change.
  const URGENT_KEYWORDS = [
    "chest pain", "can't breathe", "trouble breathing", "radiating", "stroke",
    "can't move", "numb on one side", "severe bleeding", "suicidal", "overdose"
  ];
  const checkUrgency = (text) => URGENT_KEYWORDS.some(k => text.toLowerCase().includes(k));

  const finishRecording = () => {
    const sample = sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)];
    setTranscript(sample.text);
    setResultType(checkUrgency(sample.text) ? "emergency" : "routine");
  };

  return (
    <div style={{ padding: "24px 18px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Personal Health Note</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 26 }}>
        Tell your advocate how you're feeling, whenever something's worth noting. Speak
        naturally, just like you would to a nurse checking in on you.
      </div>

      {resultType === null ? (
        <Card style={{ textAlign: "center", padding: "36px 20px" }}>
          <button onClick={() => { setRecording(!recording); if (recording) finishRecording(); }} style={{
            width: 84, height: 84, borderRadius: 42, border: "none", cursor: "pointer",
            background: recording ? COLORS.danger : COLORS.teal,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", transition: "background 0.2s"
          }}>
            <Mic size={32} color="#06140F" />
          </button>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
            {recording ? "Listening... tap to finish" : "Tap to speak, anytime"}
          </div>
          {recording && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 10 }}>
              (Demo: tap finish twice to see both a routine and an urgent example)
            </div>
          )}
        </Card>
      ) : resultType === "emergency" ? (
        <Card style={{ border: `1.5px solid ${COLORS.danger}`, background: "#1F1212" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <AlertCircle size={18} color={COLORS.danger} />
            <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.danger }}>This may be an emergency</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", marginBottom: 12 }}>
            "{transcript}"
          </div>
          <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.6, marginBottom: 14 }}>
            What you've described could be a medical emergency. This app cannot evaluate
            that for you. Please call 911 or go to the nearest emergency room now.
          </div>
          <button style={{
            width: "100%", background: COLORS.danger, border: "none", color: "#fff",
            fontSize: 14, fontWeight: 700, padding: "13px", borderRadius: 10, cursor: "pointer",
            marginBottom: 10
          }}>
            Call 911
          </button>
          <button onClick={() => { setResultType(null); setRecording(false); }} style={{
            width: "100%", background: "none", border: `1px solid ${COLORS.border}`,
            color: COLORS.textSecondary, fontSize: 12, padding: "8px", borderRadius: 8, cursor: "pointer"
          }}>
            This wasn't an emergency, redo my note
          </button>
        </Card>
      ) : (
        <Card>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <Sparkles size={16} color={COLORS.gold} />
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.gold }}>Noted</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", marginBottom: 10 }}>
            "{transcript}"
          </div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
            Logged and added to today's pattern review. This lines up with this morning's
            device signal.
          </div>
          <div style={{
            background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
            color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 12
          }}>
            Nothing here requires urgent attention. Worth mentioning at your next visit if it
            persists past 48 hours.
          </div>
          <button onClick={() => { setResultType(null); setRecording(false); }} style={{
            background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.tealLight,
            fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            width: "100%"
          }}>
            Add another note
          </button>
        </Card>
      )}

      <SectionLabel>Recent notes</SectionLabel>
      <Card>
        {recentNotes.map((n, i) => (
          <div key={i} style={{
            padding: "10px 0", borderBottom: i < recentNotes.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 3 }}>{n.time}</div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{n.note}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---- RECORDS SCREEN ----
// ---- IMPORT LABS SCREEN ----
// Full pipeline: upload PDF or capture photo → AI extracts markers → user confirms → catalogued.
// The review step before saving is intentional: silently storing a misread value into a
// health record is worse than not storing it at all.
function ImportLabsScreen({ setActive }) {
  const [stage, setStage] = useState("idle"); // idle | extracting | review | saved
  const [importType, setImportType] = useState("labs"); // labs | genetic
  const [copied, setCopied] = useState(false);
  const intakeEmail = "adam.locker.3f7a@records.hello-app.health"; // user-unique intake address

  const copyEmail = () => {
    navigator.clipboard?.writeText(intakeEmail).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // Fallback for environments without clipboard API
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [extractedMarkers, setExtractedMarkers] = useState([]);
  const [extractionError, setExtractionError] = useState(null);
  const [labDate, setLabDate] = useState("");
  const [labSource, setLabSource] = useState("");
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const handleFile = async (e, isCamera) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name || "Photo capture");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      setImageData({ base64, mediaType });
      if (file.type?.startsWith("image")) setImagePreview(dataUrl);
      else setImagePreview(null);
      await extractMarkers(base64, mediaType);
    };
    reader.readAsDataURL(file);
  };

  const extractMarkers = async (base64, mediaType) => {
    setStage("extracting");
    setExtractionError(null);
    try {
      // Harden mediaType detection: file.type can be empty or wrong depending on browser/OS.
      // Treat anything that isn't clearly an image as a PDF document.
      const cleanType = (mediaType || "").toLowerCase();
      const isImage = cleanType.startsWith("image/") && !cleanType.includes("pdf");

      const contentBlock = isImage
        ? { type: "image", source: { type: "base64", media_type: cleanType, data: base64 } }
        : { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };

      // PDF processing requires the pdfs-2024-09-25 beta. Without it the document block
      // is silently ignored and the model receives no content, which is why PDFs failed.
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-beta": "pdfs-2024-09-25",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `You are extracting structured lab data from a medical document or image.
Extract every lab marker you can find and return ONLY a JSON array with no other text, no markdown, no backticks.
Each item must have exactly these fields:
{ "name": "marker name", "value": "numeric value", "unit": "unit of measurement", "range": "reference range or null", "status": "normal|low|high|unknown" }
Determine status by comparing value to range: below range = "low", above range = "high", within range = "normal", no range = "unknown".
If you cannot find lab data in the document, return an empty array [].`,
          messages: [
            {
              role: "user",
              content: [
                contentBlock,
                { type: "text", text: "Extract all lab markers from this document as a JSON array." }
              ]
            }
          ]
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const raw = data.content?.find(b => b.type === "text")?.text || "[]";
      const clean = raw.replace(/```json|```/g, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch {
        throw new Error("Response wasn't valid JSON: " + raw.slice(0, 100));
      }
      setExtractedMarkers(Array.isArray(parsed) ? parsed : []);
      setStage("review");
    } catch (err) {
      console.error("Extraction error:", err);
      setExtractionError(`Extraction failed: ${err.message}. You can add markers manually below, or try a clearer scan.`);
      setExtractedMarkers([]);
      setStage("review");
    }
  };

  const statusColor = { normal: COLORS.tealLight, low: COLORS.danger, high: COLORS.warning, unknown: COLORS.textMuted };

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => { setActive("records"); }} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Records
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Import lab results</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Upload a PDF, photograph a paper report, or enter results manually. Saved records
        feed your pattern review, your AI conversations, and your Discussion Page.
      </div>

      {stage === "idle" && (
        <>
          <input type="file" ref={fileRef} accept=".pdf,image/*" onChange={handleFile} style={{ display: "none" }} />
          <input type="file" ref={cameraRef} accept="image/*" capture="environment" onChange={(e) => handleFile(e, true)} style={{ display: "none" }} />

          <button onClick={() => fileRef.current?.click()} style={{
            width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
            borderRadius: 14, padding: "18px 16px", display: "flex", alignItems: "center",
            gap: 14, cursor: "pointer", marginBottom: 12, textAlign: "left"
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Upload size={18} color={COLORS.tealLight} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>Upload PDF or image</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>From Quest, LabCorp, or any lab report</div>
            </div>
          </button>

          <button onClick={() => cameraRef.current?.click()} style={{
            width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
            borderRadius: 14, padding: "18px 16px", display: "flex", alignItems: "center",
            gap: 14, cursor: "pointer", marginBottom: 12, textAlign: "left"
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Camera size={18} color={COLORS.gold} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>Photograph a paper report</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Point your camera at a printed lab result</div>
            </div>
          </button>

          <button onClick={() => { setExtractedMarkers([{ name: "", value: "", unit: "", range: "", status: "unknown" }]); setStage("review"); }} style={{
            width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
            borderRadius: 14, padding: "18px 16px", display: "flex", alignItems: "center",
            gap: 14, cursor: "pointer", marginBottom: 12, textAlign: "left"
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Plus size={18} color={COLORS.textSecondary} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>Enter manually</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Type in specific markers you want to track</div>
            </div>
          </button>

          <button onClick={() => { setImportType("genetic"); setFileRef; fileRef.current?.click(); }} style={{
            width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.gold}50`,
            borderRadius: 14, padding: "18px 16px", display: "flex", alignItems: "center",
            gap: 14, cursor: "pointer", marginBottom: 18, textAlign: "left"
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Dna size={18} color={COLORS.gold} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>Import genetic data</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Upload your 23andMe or AncestryDNA raw data file (.txt)</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>Consumer genotyping, not equivalent to whole genome sequencing</div>
            </div>
          </button>

          <SectionLabel>Order new testing</SectionLabel>
          <Card style={{ border: `1px solid ${COLORS.tealLight}30` }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Genetic health panel</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
              A clinical-grade consumer genetic test (whole genome sequencing or expanded SNP panel)
              ordered through our lab partner. Results import directly into your health profile and
              inform AI recommendations around supplements, medication metabolism, and hereditary risk.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.tealLight }}>$299</span>
              <button style={{
                background: COLORS.teal, border: "none", color: "#06140F",
                fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 8, cursor: "pointer"
              }}>Order kit</button>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Advanced diagnostics</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
              Self-ordered imaging and comprehensive testing that can become part of your
              permanent health record and be shared with any physician.
            </div>
            {[
              { name: "Full-body MRI", note: "Whole-body scan, no radiation", price: "$2,500" },
              { name: "DEXA scan", note: "Bone density + precise body composition", price: "$150" },
              { name: "Multi-cancer early detection", note: "Screens 50+ cancer types from a blood draw", price: "$649" },
              { name: "Comprehensive baseline panel", note: "150+ biomarkers including hormones, metabolic, thyroid", price: "$399" },
            ].map((item, i, arr) => (
              <div key={item.name} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <div>
                  <div style={{ fontSize: 13 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>{item.note}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>{item.price}</div>
                  <span style={{
                    fontSize: 10, color: COLORS.textMuted, background: COLORS.bgCardAlt,
                    padding: "2px 7px", borderRadius: 5
                  }}>Coming soon</span>
                </div>
              </div>
            ))}
          </Card>

          <SectionLabel>Email your results in</SectionLabel>
          <Card>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>
              Your personal intake address. Any lab results sent here are automatically
              processed and added to your health record.
            </div>
            <div style={{
              background: COLORS.bgDeep, borderRadius: 8, padding: "10px 12px",
              fontFamily: "monospace", fontSize: 12, color: COLORS.tealLight,
              marginBottom: 12, wordBreak: "break-all"
            }}>
              {intakeEmail}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={copyEmail} style={{
                flex: 1, background: copied ? COLORS.bgCardAlt : COLORS.teal,
                border: copied ? `1px solid ${COLORS.tealLight}` : "none",
                color: copied ? COLORS.tealLight : "#06140F",
                fontSize: 12, fontWeight: 700, padding: "10px", borderRadius: 8, cursor: "pointer"
              }}>
                {copied ? "Copied!" : "Copy address"}
              </button>
              <a href={`mailto:?to=${encodeURIComponent(intakeEmail)}&subject=${encodeURIComponent("Lab results")}&body=${encodeURIComponent("Attaching my lab results for import.")}`}
                style={{
                  flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
                  color: COLORS.textSecondary, fontSize: 12, fontWeight: 700, padding: "10px",
                  borderRadius: 8, cursor: "pointer", textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                Open in email
              </a>
            </div>

            <div style={{ height: 1, background: COLORS.border, marginBottom: 14 }} />

            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 8 }}>
              Set up automatic delivery from your lab
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
              Many labs let you add an email address to your account so future results are
              sent automatically. Copy your intake address and paste it into your lab account settings.
            </div>
            {[
              { name: "Quest Diagnostics", steps: "MyQuest account → Profile → Notification settings → Add email" },
              { name: "LabCorp", steps: "Patient portal → Account settings → Result notifications → Add email" },
            ].map((lab, i) => (
              <div key={lab.name} style={{
                padding: "9px 0", borderTop: `1px solid ${COLORS.border}`
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{lab.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{lab.steps}</div>
              </div>
            ))}
          </Card>
        </>
      )}

      {stage === "extracting" && (
        <Card style={{ textAlign: "center", padding: "40px 20px" }}>
          {imagePreview && (
            <img src={imagePreview} alt="preview" style={{ width: "100%", borderRadius: 10, marginBottom: 16, maxHeight: 180, objectFit: "cover" }} />
          )}
          <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 10 }}>
            Reading your lab report...
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            The AI is extracting marker names, values, and reference ranges
          </div>
        </Card>
      )}

      {stage === "review" && (
        <>
          {imagePreview && (
            <img src={imagePreview} alt="preview" style={{ width: "100%", borderRadius: 10, marginBottom: 14, maxHeight: 120, objectFit: "cover" }} />
          )}
          {extractionError && (
            <div style={{
              padding: 12, background: "#1A1212", border: `1px solid ${COLORS.danger}40`,
              borderRadius: 10, fontSize: 12, color: COLORS.textSecondary, marginBottom: 14
            }}>{extractionError}</div>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>Lab date</div>
              <input value={labDate} onChange={e => setLabDate(e.target.value)} placeholder="e.g. Jun 21, 2026" style={{
                width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none"
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>Lab source</div>
              <input value={labSource} onChange={e => setLabSource(e.target.value)} placeholder="e.g. Quest Diagnostics" style={{
                width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none"
              }} />
            </div>
          </div>

          <SectionLabel>
            {extractedMarkers.length > 0 && !extractionError
              ? `${extractedMarkers.length} markers extracted — review before saving`
              : "Add markers manually"}
          </SectionLabel>

          <Card>
            {extractedMarkers.map((m, i) => (
              <div key={i} style={{
                padding: "10px 0", borderBottom: i < extractedMarkers.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input value={m.name} onChange={e => setExtractedMarkers(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    placeholder="Marker name" style={{ flex: 2, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 9px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                  <input value={m.value} onChange={e => setExtractedMarkers(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    placeholder="Value" style={{ flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 9px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                  <input value={m.unit} onChange={e => setExtractedMarkers(prev => prev.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}
                    placeholder="Unit" style={{ flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 9px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                  <button onClick={() => setExtractedMarkers(prev => prev.filter((_, j) => j !== i))} style={{
                    background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted, flexShrink: 0
                  }}><X size={14} /></button>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: statusColor[m.status] || COLORS.textMuted, background: COLORS.bgCardAlt, padding: "2px 8px", borderRadius: 6 }}>{m.status}</span>
                  {m.range && <span style={{ fontSize: 10, color: COLORS.textMuted }}>Range: {m.range}</span>}
                </div>
              </div>
            ))}
            <button onClick={() => setExtractedMarkers(prev => [...prev, { name: "", value: "", unit: "", range: "", status: "unknown" }])} style={{
              width: "100%", background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8,
              padding: "8px", color: COLORS.textMuted, fontSize: 12, cursor: "pointer", marginTop: 10
            }}>
              + Add a marker
            </button>
          </Card>

          <button onClick={() => setStage("saved")} style={{
            width: "100%", background: COLORS.teal, border: "none", color: "#06140F",
            fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer", marginTop: 14
          }}>
            Save to health record
          </button>
          <button onClick={() => { setStage("idle"); setExtractedMarkers([]); setImagePreview(null); }} style={{
            width: "100%", background: "none", border: "none", color: COLORS.textMuted,
            fontSize: 12, padding: "10px", cursor: "pointer"
          }}>
            Start over
          </button>
        </>
      )}

      {stage === "saved" && (
        <Card style={{ textAlign: "center", padding: "32px 20px" }}>
          <CheckCircle2 size={40} color={COLORS.tealLight} style={{ marginBottom: 14 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Saved to your health record</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
            {extractedMarkers.filter(m => m.name).length} markers added from {labSource || "this lab report"}.
            These are now part of your longitudinal record and will inform your AI conversations,
            pattern review, and Discussion Page.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setActive("aichat")} style={{
              flex: 1, background: COLORS.teal, border: "none", color: "#06140F",
              fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 10, cursor: "pointer"
            }}>Ask AI about results</button>
            <button onClick={() => { setStage("idle"); setExtractedMarkers([]); setImagePreview(null); setLabDate(""); setLabSource(""); }} style={{
              flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary,
              fontSize: 13, padding: "11px", borderRadius: 10, cursor: "pointer"
            }}>Import another</button>
          </div>
        </Card>
      )}
    </div>
  );
}

function RecordsScreen({ setActive }) {
  return (
    <div style={{ padding: "24px 18px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Your records</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Test results and appointment notes, reviewed for patterns your doctors may not have
        had the full picture to see.
      </div>

      <button onClick={() => setActive("discussion")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.gold}60`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 14
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <FileText size={18} color={COLORS.gold} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Next appointment discussion page</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Ready to share with your doctor</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <button onClick={() => setActive("importlabs")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.tealLight}60`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 18
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Upload size={18} color={COLORS.tealLight} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Import lab results</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Upload, photograph, or enter manually</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <SectionLabel>AI insight</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.gold}50`, background: "#1A1610" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Sparkles size={18} color={COLORS.gold} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              Worth a closer look: thyroid pattern
            </div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
              Across your last 3 panels, TSH has stayed in normal range but TPO antibodies have
              risen steadily alongside fatigue and cold sensitivity you logged in check-ins.
              Individually, none of this stood out. Together, it's a pattern worth raising.
            </div>
            <div style={{
              background: COLORS.bgCardAlt, borderRadius: 10, padding: 12, fontSize: 12,
              color: COLORS.textSecondary, lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}>Two paths forward</div>
              <div style={{ marginBottom: 6 }}>
                <strong style={{ color: COLORS.tealLight }}>Bring to your doctor:</strong> ask about a
                full thyroid antibody panel and ultrasound referral.
              </div>
              <div>
                <strong style={{ color: COLORS.tealLight }}>Or self-pay:</strong> a thyroid antibody
                panel runs roughly $89–$140 at most independent labs without a doctor's order.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <SectionLabel>Uploaded</SectionLabel>
      <Card>
        {[
          { name: "Comprehensive panel, Jan 2026", type: "Lab result" },
          { name: "Endocrinology visit notes", type: "Appointment note" },
          { name: "Thyroid panel, Oct 2025", type: "Lab result" },
        ].map((item, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: i < 2 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <FileText size={16} color={COLORS.textMuted} />
              <div>
                <div style={{ fontSize: 13 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{item.type}</div>
              </div>
            </div>
            <ChevronRight size={14} color={COLORS.textMuted} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---- LABS SCREEN ----
// ---- MEDICATION SCREEN ----
// Central medication list with real-time interaction checking, pharmacogenomic
// alerts, and a cross-physician reconciliation report for Discussion Page use.
function MedicationScreen({ setActive }) {
  const [medications, setMedications] = useState([
    { id: 1, name: "Testosterone Cypionate", dose: "150mg", frequency: "Weekly injection", prescriber: "Dr. Martinez (Endocrinology)", refillDate: "Jul 20, 2026", type: "rx" },
    { id: 2, name: "Anastrozole", dose: "0.25mg", frequency: "Twice weekly", prescriber: "Dr. Martinez (Endocrinology)", refillDate: "Jul 20, 2026", type: "rx" },
    { id: 3, name: "Vitamin D3 + K2", dose: "5,000 IU / 100mcg", frequency: "Daily with food", prescriber: "Self-ordered", refillDate: null, type: "supplement" },
    { id: 4, name: "Magnesium Glycinate", dose: "400mg", frequency: "Nightly", prescriber: "Self-ordered", refillDate: null, type: "supplement" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", dose: "", frequency: "", prescriber: "", type: "rx" });
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Severity color mapping
  const severityColor = {
    "Contraindicated": COLORS.danger,
    "Monitor": COLORS.warning,
    "Dose adjustment": COLORS.warning,
    "Theoretical": COLORS.textMuted,
    "No issues found": COLORS.tealLight,
  };

  // Simulated interaction check using known patterns from the user's genetic profile.
  // In production this calls the DrugBank API and overlays the pharmacogenomic markers.
  const runInteractionCheck = async (newMedName) => {
    setChecking(true);
    await new Promise(r => setTimeout(r, 1200));
    const knownInteractions = {
      "clarithromycin": [{ severity: "Monitor", drugs: "Clarithromycin + Testosterone", note: "CYP3A4 inhibitor may increase testosterone plasma levels. Monitor for signs of androgen excess.", route: "pharmacist" }],
      "ibuprofen": [{ severity: "Monitor", drugs: "Ibuprofen + Anastrozole", note: "NSAIDs may slightly reduce anastrozole effectiveness. Occasional use is generally acceptable; chronic use warrants discussion.", route: "prescriber" }],
      "st. john's wort": [{ severity: "Contraindicated", drugs: "St. John's Wort + Anastrozole", note: "Strong CYP3A4 inducer. May significantly reduce anastrozole plasma levels and effectiveness. Do not combine.", route: "prescriber" }],
      "simvastatin": [{ severity: "Monitor", drugs: "Simvastatin + SLCO1B1 variant", note: "Your SLCO1B1 variant significantly elevates myopathy risk with simvastatin. Rosuvastatin or pravastatin are safer alternatives. Discuss with prescriber before filling.", route: "prescriber" }],
    };
    const name = newMedName.toLowerCase();
    const found = Object.entries(knownInteractions).find(([key]) => name.includes(key));
    setCheckResult(found ? { interactions: found[1], checked: newMedName } : { interactions: [], checked: newMedName });
    setChecking(false);
  };

  const addMedication = () => {
    if (!newMed.name.trim()) return;
    setMedications(prev => [...prev, { ...newMed, id: Date.now(), refillDate: null }]);
    setShowAdd(false);
    setNewMed({ name: "", dose: "", frequency: "", prescriber: "", type: "rx" });
    setCheckResult(null);
  };

  const rxMeds = medications.filter(m => m.type === "rx");
  const supplements = medications.filter(m => m.type === "supplement");

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Medications</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
            Every medication and supplement in one place, checked against each other.
          </div>
        </div>
        <button onClick={() => setShowReport(!showReport)} style={{
          background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: "8px 12px", fontSize: 11, fontWeight: 600,
          color: COLORS.textSecondary, cursor: "pointer"
        }}>
          Reconciliation report
        </button>
      </div>

      {/* Cross-physician reconciliation report */}
      {showReport && (
        <Card style={{ border: `1px solid ${COLORS.gold}50`, background: "#1A1610", marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <Sparkles size={16} color={COLORS.gold} />
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.gold }}>Cross-physician reconciliation report</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
            Share this with any new prescribing physician before they write a new prescription.
            It gives them a complete picture of what every other physician has prescribed.
          </div>
          <div style={{ background: COLORS.bgDeep, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 8 }}>COMPLETE MEDICATION LIST — Adam Locker — July 6, 2026</div>
            {medications.map((m, i) => (
              <div key={m.id} style={{
                display: "flex", justifyContent: "space-between", padding: "6px 0",
                borderBottom: i < medications.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}> — {m.dose}, {m.frequency}</span>
                </div>
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>{m.prescriber}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 10, fontStyle: "italic" }}>
              Pharmacogenomic flags on file: CYP2D6 intermediate metabolizer, CYP1A2 slow metabolizer, SLCO1B1 variant (statin myopathy risk elevated). Please review before prescribing affected drug classes.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setActive("discussion")} style={{
              flex: 1, background: COLORS.teal, border: "none", color: "#06140F",
              fontSize: 12, fontWeight: 700, padding: "9px", borderRadius: 8, cursor: "pointer"
            }}>Add to Discussion Page</button>
            <button style={{
              flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
              color: COLORS.textSecondary, fontSize: 12, padding: "9px", borderRadius: 8, cursor: "pointer"
            }}>Export PDF</button>
          </div>
        </Card>
      )}

      <SectionLabel>Prescriptions</SectionLabel>
      <Card>
        {rxMeds.map((m, i) => (
          <div key={m.id} style={{
            padding: "10px 0", borderBottom: i < rxMeds.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.dose} · {m.frequency}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.prescriber}</div>
              </div>
              {m.refillDate && (
                <span style={{ fontSize: 11, color: COLORS.warning }}>Refill {m.refillDate}</span>
              )}
            </div>
          </div>
        ))}
      </Card>

      <SectionLabel>Supplements</SectionLabel>
      <Card>
        {supplements.map((m, i) => (
          <div key={m.id} style={{
            padding: "10px 0", borderBottom: i < supplements.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.dose} · {m.frequency} · {m.prescriber}</div>
          </div>
        ))}
      </Card>

      {/* Add medication flow with inline interaction check */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} style={{
          width: "100%", background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.tealLight}60`,
          borderRadius: 14, padding: "14px", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8, color: COLORS.tealLight, fontSize: 13,
          fontWeight: 600, cursor: "pointer", marginTop: 4
        }}>
          <Plus size={16} /> Add medication or supplement
        </button>
      ) : (
        <Card style={{ border: `1px solid ${COLORS.tealLight}40` }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Add new</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {["rx", "supplement"].map(t => (
              <button key={t} onClick={() => setNewMed(p => ({ ...p, type: t }))} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: newMed.type === t ? COLORS.teal : COLORS.bgCardAlt,
                color: newMed.type === t ? "#06140F" : COLORS.textSecondary, border: "none"
              }}>{t === "rx" ? "Prescription" : "Supplement"}</button>
            ))}
          </div>
          {[
            { key: "name", label: "Medication name", placeholder: "e.g. Atorvastatin" },
            { key: "dose", label: "Dose", placeholder: "e.g. 20mg" },
            { key: "frequency", label: "Frequency", placeholder: "e.g. Once daily at bedtime" },
            { key: "prescriber", label: newMed.type === "rx" ? "Prescribing physician" : "Source", placeholder: newMed.type === "rx" ? "e.g. Dr. Smith (Cardiology)" : "e.g. Self-ordered" },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{field.label}</div>
              <input value={newMed[field.key]} onChange={e => setNewMed(p => ({ ...p, [field.key]: e.target.value }))}
                placeholder={field.placeholder} style={{
                  width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
                  borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none"
                }} />
            </div>
          ))}

          {/* Interaction check result */}
          {checking && (
            <div style={{ padding: "10px 0", fontSize: 12, color: COLORS.textSecondary, display: "flex", gap: 8, alignItems: "center" }}>
              <Search size={13} /> Checking against your full medication list and genetic profile...
            </div>
          )}
          {checkResult && !checking && (
            <div style={{ marginBottom: 12 }}>
              {checkResult.interactions.length === 0 ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: "#0F211D", borderRadius: 10 }}>
                  <CheckCircle2 size={14} color={COLORS.tealLight} />
                  <span style={{ fontSize: 12, color: COLORS.tealLight }}>No known interactions found with your current medications or your genetic profile.</span>
                </div>
              ) : (
                checkResult.interactions.map((intx, i) => (
                  <div key={i} style={{
                    padding: "10px 12px", background: intx.severity === "Contraindicated" ? "#1A1212" : "#1A1812",
                    border: `1px solid ${severityColor[intx.severity]}40`, borderRadius: 10, marginBottom: 8
                  }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <AlertCircle size={14} color={severityColor[intx.severity]} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: severityColor[intx.severity] }}>{intx.severity}</span>
                      <span style={{ fontSize: 11, color: COLORS.textMuted }}>— {intx.drugs}</span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>{intx.note}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" }}>
                      Recommended: discuss with your {intx.route === "pharmacist" ? "pharmacist" : "prescribing physician"} before taking.
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => { runInteractionCheck(newMed.name); }} disabled={!newMed.name.trim()} style={{
              flex: 1, background: !newMed.name.trim() ? COLORS.bgCardAlt : COLORS.bgCardAlt,
              border: `1px solid ${COLORS.border}`, color: COLORS.tealLight,
              fontSize: 12, fontWeight: 600, padding: "9px", borderRadius: 8, cursor: newMed.name.trim() ? "pointer" : "default"
            }}>Check interactions</button>
            <button onClick={addMedication} disabled={!newMed.name.trim()} style={{
              flex: 1, background: !newMed.name.trim() ? COLORS.bgCardAlt : COLORS.teal,
              border: "none", color: !newMed.name.trim() ? COLORS.textMuted : "#06140F",
              fontSize: 12, fontWeight: 700, padding: "9px", borderRadius: 8, cursor: newMed.name.trim() ? "pointer" : "default"
            }}>Save</button>
          </div>
          <button onClick={() => { setShowAdd(false); setCheckResult(null); }} style={{
            width: "100%", background: "none", border: "none", color: COLORS.textMuted,
            fontSize: 12, padding: "8px", cursor: "pointer", marginTop: 4
          }}>Cancel</button>

          <div style={{ fontSize: 10, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 10 }}>
            Interaction check uses your full medication list and genetic pharmacogenomic markers.
            Results reflect only what has been entered. Always verify with your pharmacist or physician.
          </div>
        </Card>
      )}
    </div>
  );
}

function LabsScreen({ setActive, goToMarket }) {
  const markers = [
    { name: "TSH", value: "2.1 mIU/L", status: "normal" },
    { name: "TPO antibodies", value: "118 IU/mL", status: "watch" },
    { name: "Vitamin D", value: "28 ng/mL", status: "low" },
    { name: "Ferritin", value: "62 ng/mL", status: "normal" },
  ];
  const statusColor = { normal: COLORS.tealLight, watch: COLORS.warning, low: COLORS.danger };
  return (
    <div style={{ padding: "24px 18px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Labs</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Tracked across every panel, not just your most recent one.
      </div>

      <button onClick={() => setActive("orderlabs")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.tealLight}60`,
        borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer", marginBottom: 18
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Plus size={18} color={COLORS.tealLight} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Order bloodwork</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>At-home collection via Tasso</div>
          </div>
        </div>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </button>

      <Card>
        {markers.map((m, i) => (
          <div key={m.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "11px 0", borderBottom: i < markers.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 13 }}>{m.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{m.value}</span>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: statusColor[m.status] }} />
            </div>
          </div>
        ))}
      </Card>

      <Card style={{ border: `1px solid ${COLORS.danger}40`, background: "#1A1212" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertCircle size={18} color={COLORS.danger} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Vitamin D is low</div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
              28 ng/mL is below the recommended range of 30–50 ng/mL. Low vitamin D is common
              and usually addressed with daily supplementation, typically 2,000–5,000 IU of
              D3, ideally taken with a meal containing fat for better absorption. Worth
              re-checking in 8–12 weeks to confirm levels are responding before assuming a
              dose adjustment is needed.
            </div>
            <button onClick={() => goToMarket("vitd3")} style={{
              background: "none", border: `1px solid ${COLORS.tealLight}`, color: COLORS.tealLight,
              fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer"
            }}>
              Shop Vitamin D3 in Marketplace <ChevronRight size={12} style={{ display: "inline", verticalAlign: -2 }} />
            </button>
          </div>
        </div>
      </Card>

      <SectionLabel>Trend</SectionLabel>
      <Card>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <TrendingUp size={16} color={COLORS.warning} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>TPO antibodies rising</span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
          Apr 2025: 64 IU/mL &rarr; Oct 2025: 91 IU/mL &rarr; Jan 2026: 118 IU/mL.
          Each result alone was within range. The trend across all three is what matters.
        </div>
      </Card>
    </div>
  );
}

// ---- ORDER LABS SCREEN (Tasso at-home collection) ----
function OrderLabsScreen({ setActive }) {
  const [cart, setCart] = useState([]);

  const recommended = [
    {
      id: "trt",
      name: "TRT monitoring panel",
      why: "Recommended monthly while on testosterone therapy",
      markers: "Total testosterone, free testosterone, SHBG, estradiol, hematocrit, PSA",
      price: "$89",
      turnaround: "2–3 days",
    },
    {
      id: "peptide",
      name: "Peptide therapy panel",
      why: "Recommended every 8–12 weeks while cycling peptides",
      markers: "IGF-1, fasting glucose, ALT, AST, creatinine, eGFR",
      price: "$79",
      turnaround: "2–3 days",
    },
  ];

  const browseAll = [
    {
      id: "hormone",
      name: "Hormone panel",
      markers: "Total & free testosterone, DHEA-S, FSH, LH, progesterone, SHBG, TSH",
      price: "$95",
      turnaround: "2–3 days",
    },
    {
      id: "liverkidney",
      name: "Liver & kidney function",
      markers: "ALT, AST, total bilirubin, albumin, creatinine, eGFR, cystatin C",
      price: "$69",
      turnaround: "2–3 days",
    },
    {
      id: "metabolic",
      name: "Metabolic panel",
      markers: "Glucose, HbA1c, cholesterol, HDL, LDL, triglycerides, ApoB, Lp(a)",
      price: "$85",
      turnaround: "2–3 days",
    },
    {
      id: "inflammation",
      name: "Inflammation & cardiovascular",
      markers: "hsCRP, ApoB, Lp(a), cholesterol panel",
      price: "$75",
      turnaround: "2–3 days",
    },
    {
      id: "thyroid",
      name: "Thyroid antibody panel",
      markers: "TSH, TPO antibodies, thyroglobulin antibodies",
      price: "$99",
      turnaround: "3–4 days",
    },
  ];

  const toggleCart = (id) => {
    setCart(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  };

  const allPanels = [...recommended, ...browseAll];
  const cartTotal = cart.reduce((sum, id) => {
    const p = allPanels.find(p => p.id === id);
    return sum + (p ? parseInt(p.price.replace("$", "")) : 0);
  }, 0);

  const PanelCard = ({ p, highlight }) => {
    const inCart = cart.includes(p.id);
    return (
      <Card style={highlight ? { border: `1px solid ${COLORS.gold}50`, background: "#1A1610" } : {}}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.tealLight }}>{p.price}</span>
        </div>
        {p.why && (
          <div style={{ fontSize: 11, color: COLORS.gold, marginBottom: 6 }}>{p.why}</div>
        )}
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
          {p.markers}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>Results in {p.turnaround}</span>
          <button onClick={() => toggleCart(p.id)} style={{
            background: inCart ? COLORS.bgCardAlt : COLORS.teal,
            border: inCart ? `1px solid ${COLORS.tealLight}` : "none",
            color: inCart ? COLORS.tealLight : "#06140F",
            fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, cursor: "pointer"
          }}>
            {inCart ? "Added" : "Add to order"}
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px 18px", paddingBottom: cart.length ? 100 : 24 }}>
      <button onClick={() => setActive("labs")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Labs
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Order bloodwork</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
        Collected at home with a Tasso device, no needle, no clinic visit.
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 22 }}>
        A kit ships to you, you collect a small sample from your upper arm, and mail it back
        with the included prepaid label. Results sync automatically to your Labs and feed
        your pattern review.
      </div>

      <SectionLabel>Recommended for your therapies</SectionLabel>
      {recommended.map(p => <PanelCard key={p.id} p={p} highlight />)}

      <SectionLabel>Browse all panels</SectionLabel>
      {browseAll.map(p => <PanelCard key={p.id} p={p} />)}

      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8, lineHeight: 1.5 }}>
        Panel availability and exact markers may vary slightly based on current Tasso lab
        partner offerings. Some markers may require a traditional venous draw if not
        compatible with capillary collection.
      </div>

      {cart.length > 0 && (
        <div style={{
          position: "sticky", bottom: 0, left: 0, right: 0, marginTop: 18,
          background: COLORS.bgCard, borderTop: `1px solid ${COLORS.border}`,
          padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center",
          marginLeft: -18, marginRight: -18, marginBottom: -24
        }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{cart.length} panel{cart.length > 1 ? "s" : ""} selected</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>${cartTotal}</div>
          </div>
          <button style={{
            background: COLORS.teal, border: "none", color: "#06140F",
            fontSize: 13, fontWeight: 700, padding: "12px 22px", borderRadius: 10, cursor: "pointer"
          }}>
            Ship my kit
          </button>
        </div>
      )}
    </div>
  );
}


// ---- MARKET SCREEN (positioning only, no transactions yet) ----
function IVTherapyCard({ highlighted }) {
  const [mode, setMode] = useState("inhome"); // inhome | inoffice
  const [searching, setSearching] = useState(true);

  // Simulated AI local search results, ranked by rating/reviews like a Google Maps style search.
  // In production this would query local providers in real time.
  useEffect(() => {
    setSearching(true);
    const t = setTimeout(() => setSearching(false), 900);
    return () => clearTimeout(t);
  }, [mode]);

  const results = {
    inhome: [
      { name: "Revive IV Mobile Wellness", rating: 4.9, reviews: 312, price: "$179", note: "Same-day, arrives in ~45 min" },
      { name: "DripDoc Concierge", rating: 4.7, reviews: 188, price: "$199", note: "Next available: today, 6:00 PM" },
    ],
    inoffice: [
      { name: "Vitality IV Lounge", rating: 4.8, reviews: 540, price: "$129", note: "2.3 mi away" },
      { name: "Pure Drip Bar", rating: 4.6, reviews: 276, price: "$149", note: "3.1 mi away" },
      { name: "Restore IV & Wellness", rating: 4.6, reviews: 201, price: "$135", note: "4.4 mi away" },
    ],
  };

  return (
    <Card style={{ border: highlighted ? `1.5px solid ${COLORS.tealLight}` : `1px solid ${COLORS.warning}40` }}>
      {highlighted && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8,
          background: `${COLORS.tealLight}20`, color: COLORS.tealLight, fontSize: 10,
          fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.5
        }}>
          <Sparkles size={10} /> SUGGESTED FOR YOU
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: COLORS.bgCardAlt,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}><Plus size={18} color={COLORS.warning} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>IV immune support</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
            Glutathione, zinc, vitamin C, and electrolytes, suggested based on this morning's
            early illness signal from your Oura ring.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setMode("inhome")} style={{
          flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
          background: mode === "inhome" ? COLORS.teal : COLORS.bgCardAlt,
          color: mode === "inhome" ? "#06140F" : COLORS.textSecondary,
          border: "none"
        }}>In-home / in-office visit</button>
        <button onClick={() => setMode("inoffice")} style={{
          flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
          background: mode === "inoffice" ? COLORS.teal : COLORS.bgCardAlt,
          color: mode === "inoffice" ? "#06140F" : COLORS.textSecondary,
          border: "none"
        }}>Go to a location</button>
      </div>

      {searching ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "14px 0",
          color: COLORS.textSecondary, fontSize: 12
        }}>
          <Search size={14} />
          Searching providers near you, ranked by rating and reviews...
        </div>
      ) : (
        <div>
          {results[mode].map((r, i) => (
            <div key={r.name} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < results[mode].length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Star size={11} color={COLORS.gold} fill={COLORS.gold} />
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{r.rating} ({r.reviews})</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>&middot; {r.note}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.tealLight }}>{r.price}</div>
                <button style={{
                  marginTop: 4, background: "none", border: `1px solid ${COLORS.border}`,
                  color: COLORS.textSecondary, fontSize: 10, padding: "3px 8px", borderRadius: 6, cursor: "pointer"
                }}>View</button>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            Ranked using public ratings and reviews. Booking opens once a paid partner is
            available in your area; for now, contact providers directly.
          </div>
        </div>
      )}
    </Card>
  );
}

// ---- BROWSE SUPPLEMENTS (general partner catalog) ----
function BrowseSupplementsScreen({ setActive }) {
  const [cart, setCart] = useState([]);
  const [filter, setFilter] = useState("all");

  const catalog = [
    { id: "ashwagandha", name: "Ashwagandha", brand: "Thorne", category: "Stress & recovery", price: "$26" },
    { id: "creatine", name: "Creatine Monohydrate", brand: "Thorne", category: "Performance", price: "$30" },
    { id: "probiotic", name: "Daily Probiotic", brand: "PurePharmaceuticals", category: "Gut health", price: "$34" },
    { id: "zincc", name: "Zinc + Vitamin C", brand: "PurePharmaceuticals", category: "Immune support", price: "$19" },
    { id: "collagen", name: "Collagen Peptides", brand: "Thorne", category: "Recovery", price: "$38" },
    { id: "b complex", name: "B-Complex", brand: "PurePharmaceuticals", category: "Energy", price: "$21" },
  ];
  const brands = ["all", "Thorne", "PurePharmaceuticals"];
  const visible = filter === "all" ? catalog : catalog.filter(c => c.brand === filter);

  const toggleCart = (id) => setCart(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const cartTotal = cart.reduce((sum, id) => {
    const p = catalog.find(p => p.id === id);
    return sum + (p ? parseInt(p.price.replace("$", "")) : 0);
  }, 0);

  return (
    <div style={{ padding: "24px 18px", paddingBottom: cart.length ? 100 : 24, position: "relative" }}>
      <button onClick={() => setActive("market")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Marketplace
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Supplement partners</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 18 }}>
        Browse the full catalog from our connected supplement partners.
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {brands.map(b => (
          <button key={b} onClick={() => setFilter(b)} style={{
            padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: filter === b ? COLORS.teal : COLORS.bgCardAlt,
            color: filter === b ? "#06140F" : COLORS.textSecondary, border: "none"
          }}>{b === "all" ? "All brands" : b}</button>
        ))}
      </div>

      <Card>
        {visible.map((p, i) => {
          const inCart = cart.includes(p.id);
          return (
            <div key={p.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "11px 0", borderBottom: i < visible.length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{p.brand} &middot; {p.category}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: COLORS.tealLight, fontWeight: 600 }}>{p.price}</span>
                <button onClick={() => toggleCart(p.id)} style={{
                  background: inCart ? COLORS.bgCardAlt : COLORS.teal,
                  border: inCart ? `1px solid ${COLORS.tealLight}` : "none",
                  color: inCart ? COLORS.tealLight : "#06140F",
                  fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 7, cursor: "pointer"
                }}>{inCart ? "Added" : "Add"}</button>
              </div>
            </div>
          );
        })}
      </Card>

      {cart.length > 0 && (
        <>
          <div style={{
            marginTop: 14, padding: 12, background: "#1A1610", border: `1px solid ${COLORS.warning}50`,
            borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start"
          }}>
            <AlertCircle size={14} color={COLORS.warning} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5 }}>
              <span style={{ color: COLORS.warning, fontWeight: 600 }}>Before you order: </span>
              supplements can interact with prescription medications and current therapies.
              This isn't a substitute for review by your prescribing physician or pharmacist.
            </div>
          </div>
          <div style={{
            position: "sticky", bottom: 0, left: 0, right: 0, marginTop: 14,
            background: COLORS.bgCard, borderTop: `1px solid ${COLORS.border}`,
            padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center",
            marginLeft: -18, marginRight: -18, marginBottom: -24
          }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{cart.length} item{cart.length > 1 ? "s" : ""}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>${cartTotal}</div>
            </div>
            <button style={{
              background: COLORS.teal, border: "none", color: "#06140F",
              fontSize: 13, fontWeight: 700, padding: "12px 22px", borderRadius: 10, cursor: "pointer"
            }}>
              Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MarketScreen({ highlight, setActive }) {
  const [cart, setCart] = useState([]);

  // Tier 1: necessary based on actual bloodwork results
  const urgentProducts = [
    {
      id: "vitd3",
      name: "Vitamin D3 + K2",
      brand: "Thorne",
      why: "Necessary: your Vitamin D result is low (28 ng/mL)",
      detail: "5,000 IU D3 with 100mcg K2, 90 day supply. Take daily with a meal containing fat.",
      price: "$24",
    },
  ];

  // Tier 2: general daily recommendations based on profile (age, sex, goals, therapies)
  const recommendedProducts = [
    {
      id: "multi",
      name: "Daily Multivitamin",
      brand: "Thorne",
      why: "Recommended as a daily foundation for your profile",
      detail: "Comprehensive daily multivitamin, 30 day supply.",
      price: "$32",
    },
    {
      id: "omega3",
      name: "Omega-3 Fish Oil",
      brand: "PurePharmaceuticals",
      why: "Recommended to support cardiovascular and joint health given your training volume",
      detail: "1,200mg EPA/DHA per serving, 60 day supply.",
      price: "$28",
    },
    {
      id: "magnesium",
      name: "Magnesium Glycinate",
      brand: "Thorne",
      why: "Recommended to support sleep and recovery alongside your training load",
      detail: "200mg per serving, third-party tested, 60 day supply.",
      price: "$22",
    },
  ];

  const allProducts = [...urgentProducts, ...recommendedProducts];
  const toggleCart = (id) => setCart(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const cartTotal = cart.reduce((sum, id) => {
    const p = allProducts.find(p => p.id === id);
    return sum + (p ? parseInt(p.price.replace("$", "")) : 0);
  }, 0);

  const SupplementCard = ({ p, tier }) => {
    const inCart = cart.includes(p.id);
    const isHighlighted = highlight === p.id;
    const tierColor = tier === "urgent" ? COLORS.danger : COLORS.tealLight;
    const tierBg = tier === "urgent" ? "#1A1212" : "#0F211D";
    const tierLabel = tier === "urgent" ? "NECESSARY · FROM YOUR BLOODWORK" : "SUGGESTED FOR YOU";
    return (
      <Card style={{
        border: isHighlighted ? `1.5px solid ${COLORS.tealLight}` : `1px solid ${tierColor}50`,
        background: tierBg
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8,
          background: `${tierColor}20`, color: tierColor, fontSize: 9,
          fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.5
        }}>
          {tier === "urgent" ? <AlertCircle size={9} /> : <Sparkles size={9} />} {tierLabel}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.tealLight }}>{p.price}</span>
        </div>
        <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6 }}>{p.brand}</div>
        <div style={{ fontSize: 11, color: tierColor, marginBottom: 6 }}>{p.why}</div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
          {p.detail}
        </div>
        <button onClick={() => toggleCart(p.id)} style={{
          width: "100%", background: inCart ? COLORS.bgCardAlt : COLORS.teal,
          border: inCart ? `1px solid ${COLORS.tealLight}` : "none",
          color: inCart ? COLORS.tealLight : "#06140F",
          fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 8, cursor: "pointer"
        }}>
          {inCart ? "Added to order" : "Add to order"}
        </button>
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px 18px", paddingBottom: cart.length ? 100 : 24, position: "relative" }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Marketplace</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Suggestions based on your current signals. Supplements ship directly from our
        partners. Local services open as they become available in your area.
      </div>

      <SectionLabel>Necessary, based on your bloodwork</SectionLabel>
      {urgentProducts.map(p => <SupplementCard key={p.id} p={p} tier="urgent" />)}

      <SectionLabel>Suggested for your profile</SectionLabel>
      {recommendedProducts.map(p => <SupplementCard key={p.id} p={p} tier="suggested" />)}

      <button onClick={() => setActive && setActive("browsesupplements")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.textMuted}60`,
        borderRadius: 14, padding: "14px", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 8, color: COLORS.textSecondary, fontSize: 13, fontWeight: 600,
        cursor: "pointer", marginBottom: 18
      }}>
        Browse all supplements from Thorne &amp; PurePharmaceuticals <ChevronRight size={14} />
      </button>

      <SectionLabel>Local services</SectionLabel>
      <IVTherapyCard highlighted={highlight === "iv"} />

      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: COLORS.bgCardAlt,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}><Activity size={18} color={COLORS.tealLight} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Recovery and mobility</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>
              Cold plunge, compression therapy, and bodywork from vetted local providers.
            </div>
            <span style={{
              fontSize: 11, color: COLORS.textMuted, background: COLORS.bgCardAlt,
              padding: "4px 10px", borderRadius: 6
            }}>Coming soon in your area</span>
          </div>
        </div>
      </Card>

      {cart.length > 0 && (() => {
        // Simple interaction flag: this user is on TRT (established elsewhere in the app).
        // The check is visible rather than silently passing for everything in the cart.
        const checkedItems = cart
          .map(id => allProducts.find(p => p.id === id)?.name)
          .filter(Boolean);
        return (
          <>
            <div style={{
              marginTop: 14, padding: 12, background: "#1A1610", border: `1px solid ${COLORS.warning}50`,
              borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start"
            }}>
              <AlertCircle size={14} color={COLORS.warning} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                <span style={{ color: COLORS.warning, fontWeight: 600 }}>Checked against your current therapies (TRT): </span>
                no known interactions found for {checkedItems.join(", ")}. This is not a
                substitute for review by your prescribing physician or pharmacist, especially
                if you're taking other medications not listed in your profile.
              </div>
            </div>
            <div style={{
              position: "sticky", bottom: 0, left: 0, right: 0, marginTop: 14,
              background: COLORS.bgCard, borderTop: `1px solid ${COLORS.border}`,
              padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center",
              marginLeft: -18, marginRight: -18, marginBottom: -24
            }}>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{cart.length} item{cart.length > 1 ? "s" : ""}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>${cartTotal}</div>
              </div>
              <button style={{
                background: COLORS.teal, border: "none", color: "#06140F",
                fontSize: 13, fontWeight: 700, padding: "12px 22px", borderRadius: 10, cursor: "pointer"
              }}>
                Checkout
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ---- DISCUSSION PAGE (for next doctor appointment) ----
function DiscussionPageScreen({ setActive }) {
  const [shared, setShared] = useState(false);

  const symptomPattern = [
    { date: "Jun 14", note: "Fatigue, cold sensitivity" },
    { date: "Jun 19", note: "Mild fatigue, brain fog" },
    { date: "Jun 23", note: "Cold sensitivity, hair thinning noted" },
    { date: "Jun 27", note: "Fatigue, low mood, cold sensitivity" },
  ];

  const deviceSignals = [
    { label: "Resting heart rate", detail: "Trending up 6 bpm over 3 weeks", source: "Oura" },
    { label: "Overnight body temp", detail: "Elevated 2 of last 4 nights", source: "Oura" },
    { label: "HRV", detail: "Below baseline 5 of last 7 days", source: "Oura" },
    { label: "Sleep quality", detail: "Restorative sleep down 14% over 2 weeks", source: "Eight Sleep" },
  ];

  const privateLabFiles = [
    { name: "Thyroid antibody panel, self-pay", date: "Jun 21, 2026", source: "Quest Diagnostics (direct order)", size: "412 KB" },
    { name: "Comprehensive metabolic panel", date: "Jun 21, 2026", source: "Quest Diagnostics (direct order)", size: "286 KB" },
  ];

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("records")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Records
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Discussion page</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
        For your next appointment &middot; Endocrinology, Jul 8, 2026
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 22 }}>
        A summary of what's been reported, the pattern across it, and private labs to share.
      </div>

      <SectionLabel>Summary</SectionLabel>
      <Card style={{ border: `1px solid ${COLORS.gold}50`, background: "#1A1610" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Sparkles size={18} color={COLORS.gold} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
            Over the past 6 weeks, fatigue and cold sensitivity have been reported repeatedly
            in daily check-ins, alongside a steady rise in TPO antibodies across the last 3
            lab panels while TSH has stayed in normal range. Device data shows a parallel
            rise in resting heart rate and reduced HRV. None of these signals alone would
            stand out at a single visit. Together, they're a pattern worth discussing, not
            a diagnosis, but a reason to ask whether further testing is warranted.
          </div>
        </div>
      </Card>

      <SectionLabel>Reported symptom pattern</SectionLabel>
      <Card>
        {symptomPattern.map((s, i) => (
          <div key={s.date} style={{
            display: "flex", gap: 12, padding: "9px 0",
            borderBottom: i < symptomPattern.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, width: 48, flexShrink: 0 }}>{s.date}</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{s.note}</span>
          </div>
        ))}
      </Card>

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

      <SectionLabel>Suggested questions to raise</SectionLabel>
      <Card>
        {[
          "Given the rising TPO antibodies, should we run a full thyroid antibody panel and consider a thyroid ultrasound?",
          "Could the fatigue and cold sensitivity be related, even with TSH in normal range?",
          "Is there a reason to monitor more frequently given the 6-week trend?",
        ].map((q, i, arr) => (
          <div key={i} style={{
            display: "flex", gap: 8, padding: "9px 0",
            borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <span style={{ fontSize: 13, color: COLORS.gold, flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>{q}</span>
          </div>
        ))}
      </Card>

      <SectionLabel>Private lab files to share</SectionLabel>
      <Card>
        {privateLabFiles.map((f, i) => (
          <div key={f.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: i < privateLabFiles.length - 1 ? `1px solid ${COLORS.border}` : "none"
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <FileText size={16} color={COLORS.tealLight} />
              <div>
                <div style={{ fontSize: 13 }}>{f.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{f.source} &middot; {f.date} &middot; {f.size}</div>
              </div>
            </div>
            <ChevronRight size={14} color={COLORS.textMuted} />
          </div>
        ))}
      </Card>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
        These were ordered and paid for directly, outside insurance, and haven't yet been
        seen by your doctor.
      </div>

      <button onClick={() => setShared(true)} style={{
        width: "100%", background: shared ? COLORS.bgCardAlt : COLORS.teal,
        border: shared ? `1px solid ${COLORS.tealLight}` : "none",
        color: shared ? COLORS.tealLight : "#06140F",
        fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>
        {shared ? <CheckCircle2 size={16} /> : <Upload size={16} />}
        {shared ? "Ready to share" : "Share / Export as PDF"}
      </button>
      {shared && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 10, textAlign: "center" }}>
          Export as PDF, email it directly to your provider, or print for your visit.
        </div>
      )}

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

export default function App() {
  const [active, setActive] = useState("onboarding");
  const [marketHighlight, setMarketHighlight] = useState(null);
  const [nutritionEnabled, setNutritionEnabled] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [healthHistory, setHealthHistory] = useState(null);
  const goToMarket = (highlight) => { setMarketHighlight(highlight); setActive("market"); };

  const handleOnboardingComplete = (data) => {
    setUserProfile(data);
    setActive("home");
  };

  const screens = {
    onboarding: <OnboardingScreen onComplete={handleOnboardingComplete} />,
    home: <HomeScreen setActive={setActive} goToMarket={goToMarket} nutritionEnabled={nutritionEnabled} userProfile={userProfile} healthHistory={healthHistory} />,
    checkin: <CheckInScreen />,
    aichat: <AIChatScreen setActive={setActive} />,
    records: <RecordsScreen setActive={setActive} />,
    labs: <LabsScreen setActive={setActive} goToMarket={goToMarket} />,
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
  const showTabBar = active !== "onboarding" && active !== "discussion" && active !== "orderlabs" && active !== "browsesupplements" && active !== "body" && active !== "importlabs" && active !== "geneticprofile" && active !== "medications" && active !== "preventivecare" && active !== "healthhistory";
  return (
    <div style={{ background: "#050B09", padding: 24, minHeight: 700, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <PhoneFrame tabBar={showTabBar ? <TabBar active={active} setActive={setActive} /> : null}>
        {screens[active]}
      </PhoneFrame>
    </div>
  );
}

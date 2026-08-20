import React, { useState, useRef } from "react";
import { Camera, CheckCircle2, ChevronRight, Dna, Plus, Upload, X } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";
import { callAI, firstText } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { uploadDocument } from "../lib/profileStore";

/**
 * Turn the model's raw reply into a marker array — tolerantly.
 *
 * The happy path is a clean JSON array, but the response can arrive fenced in
 * ```json, wrapped in a sentence of prose, or truncated by a max_tokens cutoff
 * mid-object. A single JSON.parse over the whole string throws on any of those and
 * loses every marker. Instead: try the whole thing first, then fall back to
 * recovering each complete flat {…} object individually. Marker objects have no
 * nested braces, so the non-nested match is safe and simply drops the one incomplete
 * trailing object a cutoff leaves behind.
 */
function parseMarkerArray(raw) {
  const clean = (raw || "").replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.markers)) return parsed.markers;
  } catch { /* fall through to per-object salvage */ }

  const out = [];
  for (const chunk of clean.match(/\{[^{}]*\}/g) || []) {
    try {
      const obj = JSON.parse(chunk);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) out.push(obj);
    } catch { /* skip the truncated trailing object */ }
  }
  return out;
}

// ---- RECORDS SCREEN ----
// ---- IMPORT LABS SCREEN ----
// Full pipeline: upload PDF or capture photo → AI extracts markers → user confirms → catalogued.
// The review step before saving is intentional: silently storing a misread value into a
// health record is worse than not storing it at all.
function ImportLabsScreen({ setActive }) {
  const { user } = useAuth();
  // "storing" tracks the file landing in storage, which is independent of the AI
  // extraction below — the document is kept even if extraction fails.
  const [storing, setStoring] = useState(false);
  const [storedDoc, setStoredDoc] = useState(null);
  const [storeError, setStoreError] = useState(null);
  const [stage, setStage] = useState("idle"); // idle | extracting | review | saved
  const [importType, setImportType] = useState("labs"); // labs | genetic
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
    setStoreError(null);
    setStoredDoc(null);

    // Store the file first and independently of extraction. The document itself is
    // the record the user asked us to keep; whether we can read values out of it is
    // a separate concern that must not be able to lose their file.
    if (user) {
      setStoring(true);
      const { document, error } = await uploadDocument(
        user.id,
        file,
        importType === "genetic" ? "genetic" : "lab"
      );
      setStoring(false);
      if (error) setStoreError(error.message || "Upload failed");
      else setStoredDoc(document);
    }

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
      const data = await callAI({
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
        ],
        // A full panel is dozens of markers; the 1000-token default truncated the JSON
        // mid-object, so JSON.parse threw and every marker was lost. Give the array room.
        maxTokens: 4096,
        pdf: true,
      });
      const raw = firstText(data, "[]");
      const parsed = parseMarkerArray(raw);
      // parseMarkerArray never throws — it salvages complete markers even from a
      // truncated or prose-wrapped response. An empty result is only an error if the
      // model returned something other than a clean empty array.
      if (!parsed.length && !/^\s*\[\s*\]\s*$/.test(raw.replace(/```json|```/g, ""))) {
        setExtractionError("Couldn't read any markers from this file. You can add them manually below, or try a clearer scan.");
      }
      setExtractedMarkers(parsed);
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

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Import lab results</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Upload a PDF, photograph a paper report, or enter results manually. Saved records
        feed your pattern review, your AI conversations, and your Discussion Page.
      </div>

      {/* Storage status — separate from extraction so the user knows the file itself
          is safe even when we can't read values out of it. */}
      {(storing || storedDoc || storeError) && (
        <div style={{
          display: "flex", gap: 9, alignItems: "center", marginBottom: 14,
          padding: "10px 12px", borderRadius: 10, fontSize: 12.5, lineHeight: 1.45,
          background: storeError ? COLORS.badDim : storedDoc ? COLORS.goodDim : COLORS.accentDim,
          border: `1px solid ${storeError ? COLORS.danger : storedDoc ? COLORS.good : COLORS.accent}33`,
          color: storeError ? COLORS.danger : storedDoc ? COLORS.good : COLORS.accent,
        }}>
          {storeError
            ? <><X size={15} /> Couldn’t save the file: {storeError}</>
            : storedDoc
              ? <><CheckCircle2 size={15} /> <span><strong>{storedDoc.file_name}</strong> saved to your records.</span></>
              : <><Upload size={15} /> Saving file to your records…</>}
        </div>
      )}

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
                background: COLORS.teal, border: "none", color: COLORS.onAccent,
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
              padding: 12, background: COLORS.badDim, border: `1px solid ${COLORS.danger}40`,
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
            width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent,
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
              flex: 1, background: COLORS.teal, border: "none", color: COLORS.onAccent,
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

export { ImportLabsScreen };

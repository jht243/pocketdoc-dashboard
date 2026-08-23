import React, { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ChevronRight, Dna, Plus, Upload, X } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";
import { callAI, firstText } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { uploadDocument, saveDocumentText, saveGeneticMarkers, saveLabMarkers } from "../lib/profileStore";
import { extractDocumentText } from "../lib/documentText";

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

/**
 * Turn the model's raw reply into a genome array — tolerantly.
 *
 * Genetic objects are NOT flat: each carries nested `recommendations` / `medications`
 * arrays, so the non-nested `{…}` salvage that parseMarkerArray uses would shatter
 * them. Here the fallback walks the string tracking brace depth (outside of strings)
 * and slices each complete top-level object, so a max_tokens cutoff only loses the
 * single unfinished trailing genome instead of every one.
 */
function parseGeneticArray(raw) {
  const clean = (raw || "").replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.markers)) return parsed.markers;
    if (parsed && Array.isArray(parsed.genes)) return parsed.genes;
  } catch { /* fall through to depth-aware salvage */ }

  const out = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const obj = JSON.parse(clean.slice(start, i + 1));
          if (obj && typeof obj === "object" && !Array.isArray(obj)) out.push(obj);
        } catch { /* skip a malformed object */ }
        start = -1;
      }
    }
  }
  return out;
}

// Coerce one model-produced genome into the exact shape the review UI and the
// store expect — defaulting missing fields rather than trusting the model to have
// filled every one, and forcing the enum-ish fields onto known values.
function normalizeGenome(g) {
  const status = ["favorable", "normal", "variant", "watch", "unknown"].includes(g?.status) ? g.status : "unknown";
  const category = g?.category === "pharma" ? "pharma" : "lifestyle";
  return {
    gene: (g?.gene || "").toString().trim(),
    variant: g?.variant || "",
    genotype: g?.genotype || "",
    rsid: g?.rsid || "",
    category,
    status,
    impact: g?.impact || "Informative",
    title: g?.title || "",
    summary: g?.summary || "",
    notes: g?.notes || "",
    recommendations: Array.isArray(g?.recommendations) ? g.recommendations.filter(Boolean) : [],
    medications: Array.isArray(g?.medications)
      ? g.medications.filter((m) => m && (m.name || typeof m === "string")).map((m) => (typeof m === "string" ? { name: m, note: "" } : m))
      : [],
    aiContext: g?.aiContext || "",
  };
}

// ---- RECORDS SCREEN ----
// ---- IMPORT LABS SCREEN ----
// Full pipeline: upload PDF or capture photo → AI extracts markers → user confirms → catalogued.
// The review step before saving is intentional: silently storing a misread value into a
// health record is worse than not storing it at all.
/**
 * The user types the draw date free-form ("Jun 21, 2026", "6/21/26"). Store it only
 * when it parses to a real date — a `drawn_on` that's actually a typo is worse than
 * an absent one, because every trend downstream would believe it.
 */
/**
 * Wrap a raw file as the content block the AI gateway expects.
 *
 * `file.type` is empty or wrong often enough on mobile that trusting it loses whole
 * documents, so anything not clearly an image is treated as a PDF.
 */
function fileBlock(base64, mediaType) {
  const cleanType = (mediaType || "").toLowerCase();
  const isImage = cleanType.startsWith("image/") && !cleanType.includes("pdf");
  return isImage
    ? { type: "image", source: { type: "base64", media_type: cleanType, data: base64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
}

function toIsoDate(text) {
  if (!text || !String(text).trim()) return null;
  const parsed = new Date(String(text).trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function ImportLabsScreen({ setActive, onImported, pendingDocument, onPendingHandled }) {
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
  const [extractedGenetics, setExtractedGenetics] = useState([]);
  const [extractionError, setExtractionError] = useState(null);
  const [savingGenetics, setSavingGenetics] = useState(false);
  const [savingLabs, setSavingLabs] = useState(false);
  // Which half of the two-step read is running, so the waiting screen says something
  // true rather than one generic spinner for both.
  const [readingDoc, setReadingDoc] = useState(false);
  const [labDate, setLabDate] = useState("");
  const [labSource, setLabSource] = useState("");
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  /**
   * Entered from Records with an already-stored document whose results never made it
   * into the health record.
   *
   * Its transcription is on the row, so this costs one cheap text call instead of
   * re-uploading and re-reading the file — and it drops the member straight onto the
   * same review screen a fresh import produces, so results still get confirmed by a
   * human before they become part of a longitudinal record.
   */
  useEffect(() => {
    if (!pendingDocument?.id) return;
    onPendingHandled?.();
    setStoredDoc(pendingDocument);
    setFileName(pendingDocument.file_name || "Stored document");
    setImagePreview(null);
    const isGenetic = pendingDocument.kind === "genetic";
    setImportType(isGenetic ? "genetic" : "labs");
    setLabSource(pendingDocument.file_name || "");
    const text = pendingDocument.extracted_text || "";
    if (!text) {
      setExtractionError("This document hasn't been read yet. Open your records and tap Read on it first.");
      setStage("review");
      return;
    }
    if (isGenetic) extractGenetics("", "", text);
    else extractMarkers("", "", text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDocument?.id]);

  const handleFile = async (e, isCamera) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name || "Photo capture");
    setStoreError(null);
    setStoredDoc(null);

    // Store the file first and independently of extraction. The document itself is
    // the record the user asked us to keep; whether we can read values out of it is
    // a separate concern that must not be able to lose their file.
    //
    // Held in a local as well as in state: the reader callback below closes over the
    // render that started the upload, where the state value is still null.
    let uploaded = null;
    if (user) {
      setStoring(true);
      const { document, error } = await uploadDocument(
        user.id,
        file,
        importType === "genetic" ? "genetic" : "lab"
      );
      setStoring(false);
      if (error) setStoreError(error.message || "Upload failed");
      else {
        uploaded = document;
        setStoredDoc(document);
      }
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      setImageData({ base64, mediaType });
      if (file.type?.startsWith("image")) setImagePreview(dataUrl);
      else setImagePreview(null);

      // Read the document to text FIRST, then extract structure out of that text.
      //
      // Both steps used to send the whole file: the transcription and the marker
      // extraction each carried the same multi-megabyte PDF, and they ran at the same
      // time. That doubled the tokens one import costs and spent them in a single
      // burst, which is what tripped the per-minute ceiling and produced "Extraction
      // failed" on files that read perfectly well. A transcription is a few thousand
      // characters, so extracting from it instead is both far cheaper and sequential.
      //
      // The transcription is worth having in its own right — it's what lets the chat
      // discuss the report's narrative, which no marker schema captures.
      setStage("extracting");
      setExtractionError(null);
      const text = await transcribeDocument(uploaded, base64, mediaType);
      if (importType === "genetic") await extractGenetics(base64, mediaType, text);
      else await extractMarkers(base64, mediaType, text);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Read the whole file to text and attach it to its document row.
   *
   * Failure here is logged onto the row rather than raised at the user: the file is
   * safely stored and the markers still extract, so a failed transcription degrades
   * what the AI knows without costing them anything they entered.
   */
  const transcribeDocument = async (document, base64, mediaType) => {
    setReadingDoc(true);
    let text = "";
    try {
      const result = await extractDocumentText(base64, mediaType);
      text = result.text || "";
      if (document?.id) await saveDocumentText(document.id, text, result.error);
      if (text) onImported?.();
    } catch (err) {
      console.error("transcribeDocument", err);
    } finally {
      setReadingDoc(false);
    }
    return text;
  };

  const extractMarkers = async (base64, mediaType, documentText = "") => {
    setStage("extracting");
    setExtractionError(null);
    try {
      // Prefer the transcription we just made: it holds every number, unit and range
      // the document does, at a fraction of the tokens, and it can't be defeated by a
      // scan the vision path renders poorly. Re-sending the file is the fallback for
      // when transcription itself failed.
      const contentBlock = documentText
        ? { type: "text", text: `Lab document transcription:\n\n${documentText}` }
        : fileBlock(base64, mediaType);

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

  // Genetic reports are a different animal from lab panels: what matters is the gene,
  // the variant/genotype, and — critically — the interpretive NOTES the report gives
  // for it. We extract those verbatim rather than paraphrasing, and classify each
  // genome as lifestyle-actionable or pharmacogenomic so the profile can file it
  // under the right tab.
  const extractGenetics = async (base64, mediaType, documentText = "") => {
    setStage("extracting");
    setExtractionError(null);
    try {
      const contentBlock = documentText
        ? { type: "text", text: `Genetic report transcription:\n\n${documentText}` }
        : fileBlock(base64, mediaType);

      const data = await callAI({
        system: `You are extracting structured genetic data from a consumer genetic report (e.g. AncestryDNA, 23andMe, a longevity or pharmacogenomic report).
Return ONLY a JSON array with no other text, no markdown, no backticks. One object per gene/variant the report discusses.
Each object must have exactly these fields:
{
  "gene": "gene symbol, e.g. MTHFR",
  "variant": "human-readable variant/genotype label the report uses, e.g. C677T heterozygous, or null",
  "genotype": "raw allele call if shown, e.g. CT, or null",
  "rsid": "dbSNP rs id if shown, e.g. rs1801133, or null",
  "category": "pharma if this genome is about drug/medication metabolism, otherwise lifestyle",
  "status": "favorable | normal | variant | watch | unknown",
  "impact": "Informative | Moderate | Clinical | Watch",
  "title": "short plain-language headline for what this genome affects",
  "summary": "1-2 sentence explanation of what this gene/variant does",
  "notes": "the report's OWN interpretive notes/description for this genome, quoted as closely as possible — do not invent, do not omit",
  "recommendations": ["actionable point the report makes for lifestyle genomes", "..."],
  "medications": [{ "name": "drug or drug class", "note": "the report's note about it" }],
  "aiContext": "one compact line an AI health assistant can use as context"
}
Rules:
- "notes" must come from the report. If the report gives no interpretation for a genome, set notes to null rather than fabricating one.
- Use "medications" only for pharmacogenomic (category: pharma) genomes; use "recommendations" for lifestyle genomes. The unused one is an empty array [].
- Set status to "favorable"/"normal" when the report frames the result as no concern, "variant" for an actionable difference, "watch" for higher-stakes findings that warrant follow-up.
- If the document contains no genetic data at all, return an empty array [].`,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              { type: "text", text: "Extract every gene/variant this genetic report discusses, with the report's own notes, as a JSON array." },
            ],
          },
        ],
        // Genomes carry nested notes + recommendations; a full report is many of them.
        // Give the array plenty of room so the JSON isn't truncated mid-genome.
        maxTokens: 8192,
        pdf: true,
      });
      const raw = firstText(data, "[]");
      const parsed = parseGeneticArray(raw).filter((g) => g && g.gene);
      if (!parsed.length && !/^\s*\[\s*\]\s*$/.test(raw.replace(/```json|```/g, ""))) {
        setExtractionError("Couldn't read any genomes from this file. You can add them manually below, or try a clearer scan.");
      }
      setExtractedGenetics(parsed.map(normalizeGenome));
      setStage("review");
    } catch (err) {
      console.error("Genetic extraction error:", err);
      setExtractionError(`Extraction failed: ${err.message}. You can add genomes manually below, or try a clearer scan.`);
      setExtractedGenetics([]);
      setStage("review");
    }
  };

  /**
   * Commit the reviewed markers to the health record.
   *
   * This button used to do nothing but advance the stage, so the success screen's
   * promise — "now part of your longitudinal record and will inform your AI
   * conversations" — was false for every lab import ever made.
   */
  const saveLabs = async () => {
    const kept = extractedMarkers.filter((m) => m.name && m.name.trim());
    if (user && kept.length) {
      setSavingLabs(true);
      const { error } = await saveLabMarkers(user.id, kept, {
        documentId: storedDoc?.id || null,
        source: labSource || storedDoc?.file_name || null,
        drawnOn: toIsoDate(labDate),
      });
      setSavingLabs(false);
      if (error) {
        setExtractionError(`Couldn't save your results: ${error.message || error}. Your file is still saved to your records.`);
        return;
      }
      onImported?.();
    }
    setStage("saved");
  };

  const saveGenetics = async () => {
    const kept = extractedGenetics.filter((g) => g.gene && g.gene.trim());
    if (user && kept.length) {
      setSavingGenetics(true);
      const withSource = kept.map((g) => ({ ...g, source: g.source || labSource || storedDoc?.file_name || null }));
      const { error } = await saveGeneticMarkers(user.id, withSource, storedDoc?.id || null);
      setSavingGenetics(false);
      if (error) {
        setExtractionError(`Couldn't save your genomes: ${error.message || error}. Your file is still saved to your records.`);
        return;
      }
    }
    setStage("saved");
  };

  /**
   * Re-run the whole read for the file already in hand.
   *
   * Retries the transcription too, not just the structured pass: when the first
   * attempt lost the transcription (which is the common case — both halves fail
   * together when the service is busy), extracting again from an empty text would
   * fall back to sending the raw file and cost the same tokens that just failed.
   */
  const retryExtraction = async () => {
    // Entered from a stored document: the transcription is already on the row, so
    // retry the structured pass alone rather than re-reading a file we never held.
    if (!imageData) {
      const text = storedDoc?.extracted_text;
      if (!text) return;
      if (importType === "genetic") await extractGenetics("", "", text);
      else await extractMarkers("", "", text);
      return;
    }
    const { base64, mediaType } = imageData;
    setStage("extracting");
    setExtractionError(null);
    const text = await transcribeDocument(storedDoc, base64, mediaType);
    if (importType === "genetic") await extractGenetics(base64, mediaType, text);
    else await extractMarkers(base64, mediaType, text);
  };

  const statusColor = { normal: COLORS.tealLight, low: COLORS.danger, high: COLORS.warning, unknown: COLORS.textMuted };
  const geneStatusColor = { favorable: COLORS.tealLight, normal: COLORS.tealLight, variant: COLORS.warning, watch: COLORS.danger, unknown: COLORS.textMuted };

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
          <input type="file" ref={fileRef} accept=".pdf,.txt,image/*" onChange={handleFile} style={{ display: "none" }} />
          <input type="file" ref={cameraRef} accept="image/*" capture="environment" onChange={(e) => handleFile(e, true)} style={{ display: "none" }} />

          <button onClick={() => { setImportType("labs"); fileRef.current?.click(); }} style={{
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

          <button onClick={() => { setImportType("labs"); cameraRef.current?.click(); }} style={{
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

          <button onClick={() => { setImportType("labs"); setExtractedMarkers([{ name: "", value: "", unit: "", range: "", status: "unknown" }]); setStage("review"); }} style={{
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

          <button onClick={() => { setImportType("genetic"); fileRef.current?.click(); }} style={{
            width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.gold}50`,
            borderRadius: 14, padding: "18px 16px", display: "flex", alignItems: "center",
            gap: 14, cursor: "pointer", marginBottom: 18, textAlign: "left"
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Dna size={18} color={COLORS.gold} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>Import genetic data</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Upload a 23andMe / AncestryDNA report or raw data file (PDF, image, or .txt)</div>
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
            {readingDoc
              ? "Reading your document..."
              : importType === "genetic" ? "Pulling out your genes..." : "Pulling out your results..."}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {readingDoc
              ? "Transcribing every result, range and note in the file"
              : importType === "genetic"
                ? "The AI is extracting genes, variants, and the report's own notes"
                : "The AI is extracting marker names, values, and reference ranges"}
          </div>
        </Card>
      )}

      {stage === "review" && importType === "genetic" && (
        <>
          {extractionError && (
            <div style={{
              padding: 12, background: COLORS.badDim, border: `1px solid ${COLORS.danger}40`,
              borderRadius: 10, fontSize: 12, color: COLORS.textSecondary, marginBottom: 14
            }}>
              <div>{extractionError}</div>
              {/* A failed read is usually transient — a busy minute on the AI service,
                  not an unreadable file. Offer the retry here rather than making the
                  member re-upload a document that is already safely stored. */}
              {(imageData || storedDoc?.extracted_text) && (
                <button onClick={retryExtraction} style={{
                  marginTop: 10, background: "none", border: `1px solid ${COLORS.accent}`,
                  color: COLORS.accent, fontSize: 12, fontWeight: 700, padding: "7px 13px",
                  borderRadius: 8, cursor: "pointer",
                }}>
                  Try reading it again
                </button>
              )}
            </div>
          )}

          <div style={{
            fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 14,
            padding: "10px 12px", background: COLORS.bgCardAlt, borderRadius: 10
          }}>
            Review the genomes we read from your report before saving. The report's own notes
            are shown under each gene — check they read correctly, then save to your profile.
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>Source (optional)</div>
            <input value={labSource} onChange={e => setLabSource(e.target.value)} placeholder="e.g. AncestryDNA, 23andMe" style={{
              width: "100%", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none"
            }} />
          </div>

          <SectionLabel>
            {extractedGenetics.length > 0 && !extractionError
              ? `${extractedGenetics.length} genome${extractedGenetics.length === 1 ? "" : "s"} extracted — review before saving`
              : "Add genomes manually"}
          </SectionLabel>

          <Card>
            {extractedGenetics.map((g, i) => (
              <div key={i} style={{
                padding: "12px 0", borderBottom: i < extractedGenetics.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input value={g.gene} onChange={e => setExtractedGenetics(prev => prev.map((x, j) => j === i ? { ...x, gene: e.target.value } : x))}
                    placeholder="Gene" style={{ flex: 1, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 9px", color: COLORS.textPrimary, fontSize: 12, fontWeight: 600, outline: "none" }} />
                  <input value={g.variant} onChange={e => setExtractedGenetics(prev => prev.map((x, j) => j === i ? { ...x, variant: e.target.value } : x))}
                    placeholder="Variant / genotype" style={{ flex: 2, background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 9px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                  <button onClick={() => setExtractedGenetics(prev => prev.filter((_, j) => j !== i))} style={{
                    background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted, flexShrink: 0
                  }}><X size={14} /></button>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: g.title || g.notes ? 6 : 0 }}>
                  <span style={{ fontSize: 10, color: geneStatusColor[g.status] || COLORS.textMuted, background: COLORS.bgCardAlt, padding: "2px 8px", borderRadius: 6 }}>{g.status}</span>
                  <button onClick={() => setExtractedGenetics(prev => prev.map((x, j) => j === i ? { ...x, category: x.category === "pharma" ? "lifestyle" : "pharma" } : x))} style={{
                    fontSize: 10, color: g.category === "pharma" ? COLORS.warning : COLORS.tealLight,
                    background: COLORS.bgCardAlt, padding: "2px 8px", borderRadius: 6, border: "none", cursor: "pointer"
                  }}>{g.category === "pharma" ? "Pharmacogenomic" : "Supplement & lifestyle"}</button>
                  {g.rsid && <span style={{ fontSize: 10, color: COLORS.textMuted }}>{g.rsid}</span>}
                </div>
                {g.title && <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>{g.title}</div>}
                {g.notes && (
                  <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, background: COLORS.bgCard, borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ fontWeight: 600, color: COLORS.gold, letterSpacing: 0.4 }}>REPORT NOTES · </span>{g.notes}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setExtractedGenetics(prev => [...prev, normalizeGenome({ gene: "", status: "unknown", category: "lifestyle" })])} style={{
              width: "100%", background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8,
              padding: "8px", color: COLORS.textMuted, fontSize: 12, cursor: "pointer", marginTop: 10
            }}>
              + Add a genome
            </button>
          </Card>

          <button onClick={saveGenetics} disabled={savingGenetics} style={{
            width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent,
            fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12,
            cursor: savingGenetics ? "default" : "pointer", opacity: savingGenetics ? 0.7 : 1, marginTop: 14
          }}>
            {savingGenetics ? "Saving to your profile…" : "Save to genetic profile"}
          </button>
          <button onClick={() => { setStage("idle"); setExtractedGenetics([]); setImagePreview(null); }} style={{
            width: "100%", background: "none", border: "none", color: COLORS.textMuted,
            fontSize: 12, padding: "10px", cursor: "pointer"
          }}>
            Start over
          </button>
        </>
      )}

      {stage === "review" && importType !== "genetic" && (
        <>
          {imagePreview && (
            <img src={imagePreview} alt="preview" style={{ width: "100%", borderRadius: 10, marginBottom: 14, maxHeight: 120, objectFit: "cover" }} />
          )}
          {extractionError && (
            <div style={{
              padding: 12, background: COLORS.badDim, border: `1px solid ${COLORS.danger}40`,
              borderRadius: 10, fontSize: 12, color: COLORS.textSecondary, marginBottom: 14
            }}>
              <div>{extractionError}</div>
              {/* A failed read is usually transient — a busy minute on the AI service,
                  not an unreadable file. Offer the retry here rather than making the
                  member re-upload a document that is already safely stored. */}
              {(imageData || storedDoc?.extracted_text) && (
                <button onClick={retryExtraction} style={{
                  marginTop: 10, background: "none", border: `1px solid ${COLORS.accent}`,
                  color: COLORS.accent, fontSize: 12, fontWeight: 700, padding: "7px 13px",
                  borderRadius: 8, cursor: "pointer",
                }}>
                  Try reading it again
                </button>
              )}
            </div>
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

          <button onClick={saveLabs} disabled={savingLabs} style={{
            width: "100%", background: COLORS.teal, border: "none", color: COLORS.onAccent,
            fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12,
            cursor: savingLabs ? "default" : "pointer", opacity: savingLabs ? 0.6 : 1, marginTop: 14
          }}>
            {savingLabs ? "Saving..." : "Save to health record"}
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
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            {importType === "genetic" ? "Saved to your genetic profile" : "Saved to your health record"}
          </div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
            {importType === "genetic"
              ? <>{extractedGenetics.filter(g => g.gene).length} genome{extractedGenetics.filter(g => g.gene).length === 1 ? "" : "s"} added from {labSource || "your genetic report"}. These now inform your Genetic Profile, supplement and pharmacogenomic guidance, and your AI conversations.</>
              : <>{extractedMarkers.filter(m => m.name).length} markers added from {labSource || "this lab report"}. These are now part of your longitudinal record and will inform your AI conversations, pattern review, and Discussion Page.</>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setActive(importType === "genetic" ? "geneticprofile" : "aichat")} style={{
              flex: 1, background: COLORS.teal, border: "none", color: COLORS.onAccent,
              fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 10, cursor: "pointer"
            }}>{importType === "genetic" ? "View genetic profile" : "Ask AI about results"}</button>
            <button onClick={() => { setStage("idle"); setImportType("labs"); setExtractedMarkers([]); setExtractedGenetics([]); setImagePreview(null); setLabDate(""); setLabSource(""); }} style={{
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

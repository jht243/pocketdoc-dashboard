/**
 * Turn an uploaded lab document into results in the health record — automatically.
 *
 * A member who uploads bloodwork has already told us what they want done with it.
 * Making them then confirm a review screen, or press an "add results" button, means
 * every file that failed its first read — or that they simply walked away from —
 * sits in their records as a document whose numbers are nowhere: the Labs screen
 * still says "import a lab result", trends never unlock, and the AI can quote the
 * report's narrative while knowing none of its values.
 *
 * So ingestion is a consequence of uploading, not a step after it. The extraction is
 * still shown, still editable, and re-saving replaces what was stored — the member
 * corrects a misread value rather than authorizing a correct one.
 *
 * Shared by the import screen and by the Records list's background pass over
 * documents that were stored before any of this existed.
 */
import { callAI, firstText } from "./api";
import { saveLabMarkers } from "./profileStore";

const EXTRACTION_PROMPT = `You are extracting structured lab data from a medical document or image.
Return ONLY JSON with no other text, no markdown, no backticks, in exactly this shape:
{
  "drawn_on": "YYYY-MM-DD date the blood was collected, or null if the document doesn't say",
  "source": "the lab or clinic that ran the panel, e.g. Quest Diagnostics, or null",
  "markers": [
    { "name": "marker name", "value": "numeric value", "unit": "unit of measurement", "range": "reference range or null", "status": "normal|low|high|unknown" }
  ]
}
Extract every lab marker the document contains.
Determine status by comparing value to range: below range = "low", above range = "high", within range = "normal", no range = "unknown".
Use the COLLECTION/DRAWN date for drawn_on, not the report or print date. If only a report date is given, use it. Never invent a date.
If you cannot find lab data in the document, return {"drawn_on": null, "source": null, "markers": []}.`;

/**
 * Turn the model's raw reply into a marker array — tolerantly.
 *
 * The happy path is a clean JSON object, but the response can arrive fenced in
 * ```json, wrapped in a sentence of prose, or truncated by a max_tokens cutoff
 * mid-object. A single JSON.parse over the whole string throws on any of those and
 * loses every marker. Instead: try the whole thing first, then fall back to
 * recovering each complete flat {…} object individually. Marker objects have no
 * nested braces, so the non-nested match is safe and simply drops the one incomplete
 * trailing object a cutoff leaves behind.
 */
export function parseMarkerArray(raw) {
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
      // The salvage pass also matches the envelope's own `{...}` fragments; only
      // objects that look like a marker are markers.
      if (obj && typeof obj === "object" && !Array.isArray(obj) && obj.name) out.push(obj);
    } catch { /* skip the truncated trailing object */ }
  }
  return out;
}

/** ISO date or null — never a half-parsed guess, which every trend would then believe. */
export function toIsoDate(text) {
  if (!text || !String(text).trim()) return null;
  const parsed = new Date(String(text).trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/**
 * Wrap a raw file as the content block the AI gateway expects.
 *
 * `file.type` is empty or wrong often enough on mobile that trusting it loses whole
 * documents, so anything not clearly an image is treated as a PDF.
 */
export function fileBlock(base64, mediaType) {
  const cleanType = (mediaType || "").toLowerCase();
  const isImage = cleanType.startsWith("image/") && !cleanType.includes("pdf");
  return isImage
    ? { type: "image", source: { type: "base64", media_type: cleanType, data: base64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
}

/**
 * Pull the panel out of a document.
 *
 * `text` is the transcription made at upload and is strongly preferred: it holds
 * every number, unit and range the document does, at a fraction of the tokens of
 * re-sending the file, and it can't be defeated by a scan the vision path renders
 * poorly. The file is the fallback for when transcription itself failed.
 *
 * @returns {Promise<{markers: Array, drawnOn: string|null, source: string|null}>}
 */
export async function extractLabPanel({ text = "", base64 = "", mediaType = "" }) {
  const contentBlock = text
    ? { type: "text", text: `Lab document transcription:\n\n${text}` }
    : fileBlock(base64, mediaType);

  const data = await callAI({
    system: EXTRACTION_PROMPT,
    messages: [
      {
        role: "user",
        content: [contentBlock, { type: "text", text: "Extract this panel's collection date, lab, and every marker." }],
      },
    ],
    // A full panel is dozens of markers; the 1000-token default truncated the JSON
    // mid-object, so JSON.parse threw and every marker was lost. Give the array room.
    maxTokens: 4096,
  });

  const raw = firstText(data, "{}");
  const clean = raw.replace(/```json|```/g, "").trim();
  let envelope = null;
  try { envelope = JSON.parse(clean); } catch { /* salvage below */ }

  return {
    markers: parseMarkerArray(raw).filter((m) => m && m.name && String(m.name).trim()),
    drawnOn: toIsoDate(envelope?.drawn_on),
    source: envelope?.source ? String(envelope.source).trim() : null,
    // Distinguishes "the model read the document and there is nothing lab-shaped in
    // it" from "the read failed", which are the same empty array to the caller.
    empty: /"markers"\s*:\s*\[\s*\]/.test(clean) || /^\s*\[\s*\]\s*$/.test(clean),
  };
}

/**
 * Extract a document's results and put them in the health record, in one step.
 *
 * Returns what was stored so a caller can show it. A document with no lab data in it
 * (a genetic report, an appointment note) resolves quietly with no markers rather
 * than as an error — nothing went wrong, there was simply nothing to file.
 *
 * @param {object}  opts
 * @param {string}  opts.userId
 * @param {object}  opts.document    the stored `documents` row (may be null for an
 *                                   unauthenticated preview)
 * @param {string} [opts.text]       the document's transcription
 * @param {string} [opts.base64]     the raw file, used only if there is no text
 * @param {string} [opts.mediaType]
 */
export async function ingestLabResults({ userId, document, text = "", base64 = "", mediaType = "" }) {
  const panel = await extractLabPanel({ text, base64, mediaType });
  if (!panel.markers.length) {
    return { ...panel, saved: false, error: null };
  }
  if (!userId) return { ...panel, saved: false, error: null };

  const { error } = await saveLabMarkers(userId, panel.markers, {
    documentId: document?.id || null,
    // The lab's own name beats the file name, which is usually a claim number.
    source: panel.source || document?.file_name || null,
    // Without the draw date every marker is dated by when the file happened to be
    // uploaded, which turns a three-year lab history into "all imported last
    // Tuesday" and destroys the trend the Labs screen exists to show.
    drawnOn: panel.drawnOn,
  });
  return { ...panel, saved: !error, error };
}

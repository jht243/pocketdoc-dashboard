/**
 * Read an uploaded health document into plain text the AI advocate can use.
 *
 * Structured extraction (lab markers, genomes) is still the primary path — it's
 * reviewable, trendable and scoreable. But it only captures what fits its schema.
 * A longevity report's narrative, a doctor's note, a radiology impression, the
 * interpretation paragraph under a lab table: none of that survives extraction to
 * `{name, value, unit}`, and until now none of it reached the chat, which saw the
 * file name alone.
 *
 * So: transcribe the whole document once at upload, store it, and give the model
 * the document itself.
 */
import { callAI, firstText } from "./api";

/**
 * How much of one document we keep.
 *
 * Generous — a full lab panel with interpretation runs long, and truncating the
 * middle of a report is how the AI ends up confidently discussing half a result.
 * The chat applies its own, tighter budget when assembling context; this is the
 * storage cap.
 */
export const MAX_DOCUMENT_CHARS = 24000;

const TRANSCRIBE_PROMPT = `You are transcribing a health document (a lab report, genetic report, longevity report, imaging report, or clinical note) into plain text for a health record.

Rules:
- Transcribe what the document actually says. Do not summarize, interpret, add, or omit.
- Keep every numeric result with its unit and reference range, and keep results in the order they appear.
- Render tables as one line per row: "Marker: value unit (reference range) — flag".
- Keep section headings, the collection/report date, the ordering provider, and the lab or company name.
- Preserve any narrative interpretation, impression, or recommendation text verbatim — it matters as much as the numbers.
- Output the transcription only. No preamble, no commentary, no markdown fences.
- If the document contains nothing health-related, output exactly: NO_CONTENT`;

/** A .txt upload (e.g. a raw genotype export) needs no model — just decode it. */
function decodeBase64Text(base64) {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch (err) {
    console.error("decodeBase64Text", err);
    return "";
  }
}

function truncate(text) {
  const clean = String(text || "").trim();
  if (clean.length <= MAX_DOCUMENT_CHARS) return clean;
  // Say so in the text itself. A silently cut-off document reads to the model as a
  // complete one, and it will draw conclusions from a report that simply stops.
  return `${clean.slice(0, MAX_DOCUMENT_CHARS)}\n\n[Transcription truncated — this document is longer than the health record stores in full.]`;
}

/**
 * Pull a stored file back down as base64, for documents uploaded before they were
 * being transcribed — the file is in the bucket, but nothing ever read it.
 *
 * @param {string} url  a short-lived signed URL from getDocumentUrl()
 */
export async function fetchAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Couldn't download the stored file (${response.status}).`);
  const buffer = new Uint8Array(await response.arrayBuffer());
  // Chunked so a multi-megabyte PDF doesn't blow the argument limit on apply().
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, buffer.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * @param {string} base64      the file's base64 payload (no data-URL prefix)
 * @param {string} mediaType   the browser-reported MIME type, which may be wrong or empty
 * @returns {Promise<{text: string, error: string|null}>}
 */
export async function extractDocumentText(base64, mediaType = "") {
  if (!base64) return { text: "", error: "No file content." };

  const cleanType = String(mediaType || "").toLowerCase();
  const isText = cleanType.startsWith("text/") || cleanType.includes("plain");
  const isImage = cleanType.startsWith("image/") && !cleanType.includes("pdf");

  if (isText) {
    const text = truncate(decodeBase64Text(base64));
    return { text, error: text ? null : "Couldn't read this text file." };
  }

  // Anything that isn't clearly an image is treated as a PDF — `file.type` is empty
  // or wrong often enough on mobile that trusting it loses whole documents.
  const contentBlock = isImage
    ? { type: "image", source: { type: "base64", media_type: cleanType, data: base64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };

  try {
    const data = await callAI({
      system: TRANSCRIBE_PROMPT,
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: "Transcribe this document to plain text." }],
        },
      ],
      // A multi-page panel is long; a small budget truncates mid-result.
      maxTokens: 8192,
    });
    const raw = firstText(data, "").trim();
    if (!raw || raw === "NO_CONTENT") {
      return { text: "", error: "No readable health content found in this file." };
    }
    return { text: truncate(raw), error: null };
  } catch (err) {
    console.error("extractDocumentText", err);
    return { text: "", error: err.message || "Extraction failed." };
  }
}

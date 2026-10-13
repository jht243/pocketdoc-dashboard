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
import { renameDocument } from "./profileStore";

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

const NAME_PROMPT = `You name health documents for a member's records list, based on what the document says.

Return ONE short title, 3 to 8 words, and nothing else. Shape it as:
  [Lab or company] [Document type] — [Mon YYYY]
e.g. "Quest Diagnostics Lipid Panel — Mar 2024", "Function Health Biomarker Report — Jan 2025",
"23andMe Raw Genotype Data", "Chest X-Ray Report — Aug 2023", "Cardiology Visit Note — Feb 2025".

Rules:
- Name the specific test or document type ("Comprehensive Metabolic Panel", not "Lab Report") when the document says it. If it covers many panels, use a broader name ("Annual Blood Panel").
- Use the collection or visit date, not a print or report date, when both are given. Omit the date if there is none.
- Omit the lab or company if the document doesn't name one.
- Never include the patient's name, date of birth, account, accession, claim or order numbers, or any other identifier.
- No quotes, no file extension, no trailing punctuation.
- If you can't tell what the document is, output exactly: UNKNOWN`;

/** How much of a transcription the namer sees — the header holds everything a name needs. */
const NAME_SOURCE_CHARS = 4000;

/**
 * Has this document never been given a content-based name?
 *
 * Every file a browser hands over carries an extension (.pdf, .jpg, .HEIC, .txt) and a
 * generated name never does, so the extension is the marker — it lets the Records list
 * name files stored before naming existed, exactly once, without a column to track it.
 */
export function needsContentName(fileName) {
  return !fileName || /\.[a-z0-9]{2,5}$/i.test(String(fileName).trim());
}

/** Clean the model's title into something safe to show and store, or null. */
function cleanName(raw) {
  const name = String(raw || "")
    .split("\n")[0]
    .replace(/^["'`*\s]+|["'`*\s]+$/g, "")
    .replace(/^title:\s*/i, "")
    // A period anywhere could end up looking like an extension, which would mark the
    // document as unnamed and have it renamed on every visit.
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || /^unknown$/i.test(name) || name.length > 90) return null;
  return name;
}

/**
 * A human name for a document, read from its transcription — what the member would
 * call it, instead of "IMG_4821.HEIC" or "R0034492_final(2).pdf".
 *
 * @returns {Promise<string|null>} null when the document can't be named; the caller
 *   keeps whatever name it already has
 */
export async function nameDocument(text) {
  const source = String(text || "").trim().slice(0, NAME_SOURCE_CHARS);
  if (!source) return null;
  try {
    const data = await callAI({
      system: NAME_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: `Document transcription:\n\n${source}` }] }],
      maxTokens: 40,
    });
    return cleanName(firstText(data, ""));
  } catch (err) {
    // A document keeping its upload name is a cosmetic miss, never a reason to fail
    // the read that produced the text.
    console.error("nameDocument", err);
    return null;
  }
}

/**
 * Name a stored document from its transcription and save the name.
 *
 * @returns {Promise<string|null>} the new name, or null if it kept its old one
 */
export async function nameStoredDocument(document, text) {
  if (!document?.id || !text || !needsContentName(document.file_name)) return null;
  const name = await nameDocument(text);
  if (!name) return null;
  const { error } = await renameDocument(document.id, name);
  return error ? null : name;
}

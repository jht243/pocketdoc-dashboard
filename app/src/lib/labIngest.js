/**
 * Turn an uploaded lab document into results in the health record — automatically.
 *
 * A member who uploads bloodwork has already told us what they want done with it.
 * Making them then confirm a review screen, or press an "add results" button, means
 * every file that failed its first read — or that they simply walked away from —
 * sits in their records as a document whose numbers are nowhere. So ingestion is a
 * consequence of uploading, not a step after it. The results are still shown, still
 * editable, and re-saving replaces what was stored.
 *
 * Since Oct 22 2026 the reading is the care team's (agents/lib/ingest.mjs): the Blood
 * Work specialist reads the document with the document tools and extracts the
 * results, the Fact Checker reads it independently, and only what both reads support
 * comes back. A row they couldn't settle is named in `unclear` and is never filed; a
 * marker that didn't match its own row of the report is named in `dropped`.
 *
 * Shared by the import screen, onboarding, and the Records list's background pass.
 */
import { readDocument } from "./agentsClient";
import { clearDocumentResults, saveDocumentText, saveLabMarkers } from "./profileStore";

/** ISO date or null — never a half-parsed guess, which every trend would then believe. */
export function toIsoDate(text) {
  if (!text || !String(text).trim()) return null;
  const parsed = new Date(String(text).trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/**
 * Read a lab document with the care team and file what it confirms.
 *
 * @param {object}  opts
 * @param {string}  opts.userId
 * @param {object}  opts.document    the stored `documents` row (null for a preview)
 * @param {string}  opts.base64      the file
 * @param {string} [opts.mediaType]
 * @returns {Promise<{text, markers, drawnOn, source, unclear, dropped, empty, saved, error}>}
 */
export async function ingestLabResults({ userId, document, base64, mediaType = "" }) {
  const none = { text: "", markers: [], drawnOn: null, source: null, unclear: [], dropped: [], empty: false, saved: false, error: null };
  if (!base64) return none;
  const read = await readDocument({ kind: "labs", file: base64, mediaType });
  const result = {
    ...none,
    text: read.text || "",
    markers: read.markers || [],
    drawnOn: read.drawnOn || null,
    source: read.source || null,
    unclear: read.unclear || [],
    dropped: read.dropped || [],
    empty: Boolean(read.empty),
  };
  // The checked transcription is what the chat and every agent read, so it replaces
  // whatever was stored for this document before.
  if (document?.id) await saveDocumentText(document.id, result.text, result.text ? null : "No readable health content found in this file.");
  if (!userId) return result;
  if (!result.markers.length) {
    // Nothing confirmed: anything filed from this document by an earlier, unchecked
    // read goes too.
    if (document?.id) await clearDocumentResults(userId, document.id);
    return result;
  }

  const { error } = await saveLabMarkers(userId, result.markers, {
    documentId: document?.id || null,
    // The lab's own name beats the file name, which is usually a claim number.
    source: result.source || document?.file_name || null,
    // Without the draw date every marker is dated by when the file happened to be
    // uploaded, which destroys the trend the Labs screen exists to show.
    drawnOn: result.drawnOn,
  });
  return { ...result, saved: !error, error };
}

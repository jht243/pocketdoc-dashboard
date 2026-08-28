import React, { useEffect, useRef, useState } from "react";
import { FileText, Camera, Dna, Trash2, ChevronRight, Sparkles, AlertCircle } from "lucide-react";
import { COLORS, RADIUS } from "../theme/tokens";
import { useAuth } from "../lib/AuthContext";
import { listDocuments, getDocumentUrl, deleteDocument, saveDocumentText, loadPanelDocumentIds, countDocumentData, markDocumentNoLabData, NO_LAB_DATA_VERDICT } from "../lib/profileStore";
import { extractDocumentText, fetchAsBase64 } from "../lib/documentText";
import { ingestLabResults } from "../lib/labIngest";

const KIND_ICON = { lab: FileText, genetic: Dna, other: FileText };

/**
 * Is a stored read failure worth trying again on its own?
 *
 * A rate limit, a network blip or a transient model error will succeed next time and
 * should never need the member's attention. "There is nothing health-related in this
 * file" is a verdict about the file itself — retrying it just burns tokens on every
 * visit to this screen, forever.
 */
const PERMANENT_READ_ERRORS = /no readable health content|no file content|couldn't read this text file/i;

function isRetryableReadError(error) {
  return !!error && !PERMANENT_READ_ERRORS.test(String(error));
}

/**
 * The stages a document actually moves through on its way into the health record,
 * and how far along the bar sits while each one runs.
 *
 * The percentages aren't cosmetic: each stage owns a slice of the bar, and the bar
 * only crosses into the next slice when that step of the real pipeline completes.
 * Inside a slice it eases toward — but never reaches — the ceiling, so a slow model
 * call still looks alive without ever claiming progress that hasn't happened.
 */
const READ_STAGES = {
  queued:   { label: "Waiting to be read",              start: 2,   ceiling: 6 },
  fetching: { label: "Opening your file",               start: 8,   ceiling: 24 },
  reading:  { label: "Reading this document",           start: 26,  ceiling: 72 },
  filing:   { label: "Adding its results to your labs", start: 74,  ceiling: 96 },
  done:     { label: "Done",                            start: 100, ceiling: 100 },
};

/** How long a finished bar stays at 100% before the row goes back to its status line. */
const DONE_LINGER_MS = 1400;

function iconFor(doc) {
  if (doc.mime_type?.startsWith("image/")) return Camera;
  return KIND_ICON[doc.kind] || FileText;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The user's uploaded documents, read from the database rather than local state —
 * this is what makes an upload feel like it was actually kept.
 *
 * Files live in a private bucket, so opening one mints a short-lived signed URL on
 * demand instead of storing a permanent public link.
 */
export default function DocumentList({ limit, onEmptyAction, onDocumentsChange }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [readingId, setReadingId] = useState(null);
  // Where each document is in the read pipeline right now, keyed by id:
  // { stage, pct }. Reading a file is the slowest thing this app does to something
  // the member just handed over, and a row that says nothing for thirty seconds
  // reads as broken — so every stage transition is shown as it happens.
  const [progress, setProgress] = useState({});
  // Documents whose results are already in the health record, so the list can tell
  // "stored and read" apart from "actually counted in your labs and trends".
  const [panelDocIds, setPanelDocIds] = useState(new Set());

  // Documents attempted this session, so a file that can't be read isn't retried on
  // every re-render of the screen.
  const attempted = useRef(new Set());

  /** Move a document to a pipeline stage, never letting the bar travel backwards. */
  const setStage = (docId, stage) => {
    setProgress((prev) => {
      const floor = READ_STAGES[stage].start;
      const current = prev[docId]?.pct || 0;
      return { ...prev, [docId]: { stage, pct: Math.max(floor, current) } };
    });
  };

  /** Fill the bar, hold it there a beat so the member sees it land, then clear it. */
  const finishProgress = (docId) => {
    setProgress((prev) => (prev[docId] ? { ...prev, [docId]: { stage: "done", pct: 100 } } : prev));
    setTimeout(() => {
      setProgress((prev) => {
        if (prev[docId]?.stage !== "done") return prev;
        const next = { ...prev };
        delete next[docId];
        return next;
      });
    }, DONE_LINGER_MS);
  };

  // Ease each in-flight bar toward its stage ceiling. The real pipeline reports
  // stages, not percentages — this is what turns four discrete steps into motion the
  // member can watch, while the ceilings keep it honest about what has finished.
  useEffect(() => {
    const moving = Object.values(progress).some((p) => p.stage !== "done" && p.pct < READ_STAGES[p.stage].ceiling);
    if (!moving) return;
    const timer = setInterval(() => {
      setProgress((prev) => {
        let changed = false;
        const next = {};
        for (const [id, p] of Object.entries(prev)) {
          const { ceiling } = READ_STAGES[p.stage];
          if (p.stage === "done" || p.pct >= ceiling) { next[id] = p; continue; }
          // Decelerating, but with a floor on the step so it never visibly stalls.
          const pct = Math.min(ceiling, p.pct + Math.max(0.12, (ceiling - p.pct) * 0.05));
          next[id] = { ...p, pct };
          changed = true;
        }
        return changed ? next : prev;
      });
    }, 180);
    return () => clearInterval(timer);
  }, [progress]);

  const load = async () => {
    if (!user) return setLoading(false);
    setLoading(true);
    const [rows, panelIds] = await Promise.all([
      listDocuments(user.id),
      loadPanelDocumentIds(user.id),
    ]);
    setDocs(rows);
    setPanelDocIds(panelIds);
    setLoading(false);
    return { rows, panelIds };
  };

  useEffect(() => {
    load().then(({ rows, panelIds } = {}) => backfillUnread(rows, panelIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /**
   * Read any document the AI can't yet see.
   *
   * Files uploaded before transcription existed are stored but unread, which means
   * the chat knows their names and nothing else. Rather than make the member
   * re-upload everything, fetch each one back out of the bucket and read it — once,
   * in the background, oldest concern first.
   */
  const backfillUnread = async (rows = [], panelIds = new Set()) => {
    // Decide the whole worklist before touching any of it, so every document that is
    // going to be read says so from the start. Handling them one at a time and only
    // labelling the current one would leave five files sitting silent behind the
    // first — which is exactly the wait that reads as "nothing is happening".
    const work = [];
    for (const doc of rows) {
      if (attempted.current.has(doc.id)) continue;
      attempted.current.add(doc.id);
      if (!doc.extracted_text && (!doc.extract_error || isRetryableReadError(doc.extract_error))) {
        // Never read, or last read failed for a reason that isn't about this file —
        // read it, which files its results as part of the same pass. A failed read is
        // usually a busy minute on the AI service, and leaving it parked behind a
        // "tap to retry" is the same dead end as leaving results behind a button.
        work.push({ doc, job: "read" });
        continue;
      }
      // Read, but its numbers never reached the record: an import whose extraction hit
      // a rate limit, or a file stored before results were filed automatically. The
      // transcription is already on the row, so this is one cheap text call and the
      // member never has to know it happened.
      if (doc.extracted_text && doc.kind !== "genetic" && !panelIds.has(doc.id)
        && doc.extract_error !== NO_LAB_DATA_VERDICT) {
        work.push({ doc, job: "file" });
      }
    }
    if (!work.length) return;

    work.forEach(({ doc }) => setStage(doc.id, "queued"));
    for (const { doc, job } of work) {
      if (job === "read") {
        await readDocument(doc);
      } else {
        await fileResults(doc, doc.extracted_text);
        finishProgress(doc.id);
      }
    }
  };

  /**
   * Put a document's results in the health record.
   *
   * Automatic, unprompted, and quiet about it: a member who uploaded bloodwork has
   * already said what they want done with it. A failure here is left silent too —
   * the file and its transcription are safe, and the next visit to this screen tries
   * again.
   */
  const fileResults = async (doc, text) => {
    if (!user || !text || doc.kind === "genetic") return;
    setStage(doc.id, "filing");
    try {
      const { saved, markers, error } = await ingestLabResults({ userId: user.id, document: doc, text });
      if (saved) {
        setPanelDocIds((prev) => new Set(prev).add(doc.id));
        onDocumentsChange?.();
      } else if (!error && !markers.length) {
        // The model read the whole document and found nothing lab-shaped — a
        // genetic report, an appointment note. Record that verdict, or this file
        // is flagged "we'll try again" and re-extracted on every visit, forever.
        await markDocumentNoLabData(doc.id);
        setDocs((prev) => prev.map((d) => (d.id === doc.id
          ? { ...d, extract_error: NO_LAB_DATA_VERDICT }
          : d)));
      }
    } catch (err) {
      console.error("fileResults", err);
    }
  };

  /** Download a stored file, transcribe it, and attach the text to its row. */
  const readDocument = async (doc) => {
    if (!doc.storage_path) return;
    setReadingId(doc.id);
    setStage(doc.id, "fetching");
    try {
      const url = await getDocumentUrl(doc.storage_path, 300);
      if (!url) throw new Error("Couldn't open the stored file.");
      const base64 = await fetchAsBase64(url);
      setStage(doc.id, "reading");
      const { text, error } = await extractDocumentText(base64, doc.mime_type || "");
      await saveDocumentText(doc.id, text, error);
      // Update in place rather than refetching the list: a reload mid-backfill would
      // restart the loop over a stale snapshot.
      setDocs((prev) => prev.map((d) => (d.id === doc.id
        ? { ...d, extracted_text: text || null, extract_error: error || null, status: text ? "extracted" : "failed" }
        : d)));
      if (text) onDocumentsChange?.();
      // Reading a lab report and filing its results are one action from the member's
      // side, so they happen together rather than leaving results behind a second tap.
      if (text) await fileResults(doc, text);
    } catch (err) {
      console.error("readDocument", err);
      await saveDocumentText(doc.id, "", err.message);
      setDocs((prev) => prev.map((d) => (d.id === doc.id
        ? { ...d, extract_error: err.message, status: "failed" }
        : d)));
    } finally {
      setReadingId(null);
      finishProgress(doc.id);
    }
  };

  const open = async (doc) => {
    setBusyId(doc.id);
    const url = await getDocumentUrl(doc.storage_path);
    setBusyId(null);
    if (url) window.open(url, "_blank", "noopener");
  };

  const remove = async (doc) => {
    // Name what actually goes. Results are filed automatically now, so "remove this
    // file" quietly means "remove the 62 results it added to your labs and trends"
    // — a member deleting a bad upload deserves to know that's what they're getting,
    // and a member deleting a file they still have results for deserves the warning.
    setBusyId(doc.id);
    const { markers, genomes } = await countDocumentData(doc.id);
    setBusyId(null);

    const derived = [
      markers ? `${markers} lab result${markers === 1 ? "" : "s"}` : null,
      genomes ? `${genomes} genome${genomes === 1 ? "" : "s"}` : null,
    ].filter(Boolean).join(" and ");

    const message = derived
      ? `Remove "${doc.file_name}" from your records?\n\nThis also deletes the ${derived} it added to your health record. Your labs, trends and AI conversations will no longer include them.`
      : `Remove "${doc.file_name}" from your records?`;
    if (!window.confirm(message)) return;

    setBusyId(doc.id);
    // Nothing about this document is filed any more, so let a re-upload of the same
    // file be read and filed afresh instead of being skipped as already-attempted.
    attempted.current.delete(doc.id);
    const { error } = await deleteDocument(doc);
    setBusyId(null);
    if (error) {
      window.alert("Couldn't remove that document. Nothing was deleted — try again in a moment.");
      return;
    }
    setPanelDocIds((prev) => {
      const next = new Set(prev);
      next.delete(doc.id);
      return next;
    });
    load();
    onDocumentsChange?.();
  };

  /**
   * A lab document that has been read but whose markers were never saved.
   *
   * Genetic reports are excluded — they land in the genetic profile, not in a lab
   * panel, so they would otherwise be flagged forever.
   */
  const resultsMissing = (doc) =>
    doc.kind !== "genetic" && !!doc.extracted_text && !panelDocIds.has(doc.id)
    // "There are no lab results in this file" is an answer, not a pending retry.
    && doc.extract_error !== NO_LAB_DATA_VERDICT;

  if (loading) {
    return (
      <div style={{ fontSize: 12.5, color: COLORS.textMuted, padding: "10px 0" }}>
        Loading your records…
      </div>
    );
  }

  if (!docs.length) {
    return (
      <div style={{
        border: `1px dashed ${COLORS.border}`, borderRadius: RADIUS.md,
        padding: "18px 16px", textAlign: "center",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>No documents yet</div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: onEmptyAction ? 12 : 0 }}>
          Lab reports and records you upload will be kept here.
        </div>
        {onEmptyAction && (
          <button onClick={onEmptyAction} style={{
            background: COLORS.accent, color: COLORS.onAccent, border: "none",
            borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
          }}>
            Upload a record
          </button>
        )}
      </div>
    );
  }

  const shown = limit ? docs.slice(0, limit) : docs;
  // Waiting members care about their place in line, not just that a queue exists.
  const queue = shown.filter((d) => progress[d.id]?.stage === "queued").map((d) => d.id);

  return (
    <div>
      {shown.map((doc) => {
        const Icon = iconFor(doc);
        const inFlight = progress[doc.id];
        // A read that ended badly doesn't get a victory lap: drop straight back to the
        // status line, which says precisely what went wrong and offers the retry.
        const active = inFlight && inFlight.stage === "done" && !doc.extracted_text ? null : inFlight;
        const queuePlace = active?.stage === "queued" ? queue.indexOf(doc.id) + 1 : 0;
        return (
          <div key={doc.id} style={{
            display: "flex", alignItems: "center", gap: 11,
            padding: "11px 0", borderBottom: `1px solid ${COLORS.border}`,
            opacity: busyId === doc.id ? 0.5 : 1,
          }}>
            <div style={{
              width: 36, height: 36, flexShrink: 0, borderRadius: 10,
              background: COLORS.accentDim, display: "grid", placeItems: "center",
            }}>
              <Icon size={17} color={COLORS.accent} strokeWidth={1.9} />
            </div>

            <button
              onClick={() => open(doc)}
              style={{
                flex: 1, minWidth: 0, background: "none", border: "none",
                textAlign: "left", cursor: "pointer", padding: 0,
              }}
            >
              <div style={{
                fontSize: 13, fontWeight: 600, color: COLORS.textPrimary,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {doc.file_name || "Untitled document"}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>
                {formatDate(doc.created_at)}
                {doc.kind === "genetic" ? " · Genetic data" : " · Lab report"}
              </div>
              {/* Whether the AI can actually read this file — the one thing about a
                  stored document the member can't otherwise tell. */}
              {active ? (
                <div style={{ marginTop: 5 }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 8, fontSize: 11, marginBottom: 4,
                  }}>
                    <span style={{ color: active.stage === "done" ? COLORS.tealLight : COLORS.textSecondary }}>
                      {active.stage === "done"
                        ? (panelDocIds.has(doc.id) ? "Done — its results are in your labs" : "Done — your AI can read this")
                        : queuePlace > 1
                          ? `${READ_STAGES.queued.label} — ${queuePlace} in line`
                          : `${READ_STAGES[active.stage].label}…`}
                    </span>
                    <span style={{ color: COLORS.textMuted, fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(active.pct)}%
                    </span>
                  </div>
                  <div style={{
                    height: 4, borderRadius: 999, background: COLORS.ringTrack, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", width: `${active.pct}%`, borderRadius: 999,
                      background: COLORS.accent,
                      // Matches the ticker so the fill glides between updates rather
                      // than stepping.
                      transition: "width 200ms linear",
                    }} />
                  </div>
                </div>
              ) : (
              <div style={{ fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                {doc.extracted_text ? (
                  // Being readable and being counted are different things — a member
                  // whose extraction failed had a document the AI could read while their
                  // Labs screen still showed nothing. Say which one this is, precisely.
                  doc.extract_error === NO_LAB_DATA_VERDICT ? (
                    // Not an error, and not pending: the file is saved and readable,
                    // it simply has no lab values in it. Say that as a finished outcome
                    // and stop there — a "yet" reads as "still working", and there is
                    // nothing here for the member to do.
                    <><Sparkles size={11} color={COLORS.tealLight} /><span style={{ color: COLORS.tealLight }}>
                      Saved — your AI can read this. It contains no lab values.
                    </span></>
                  ) : resultsMissing(doc) ? (
                    <><AlertCircle size={11} color={COLORS.warning} /><span style={{ color: COLORS.warning }}>
                      Saved and readable — its results aren't in your labs yet. Retrying automatically.
                    </span></>
                  ) : (
                    <><Sparkles size={11} color={COLORS.tealLight} /><span style={{ color: COLORS.tealLight }}>Your AI can read this</span></>
                  )
                ) : (
                  <><AlertCircle size={11} color={COLORS.warning} /><span style={{ color: COLORS.warning }}>
                    {doc.extract_error
                      ? `Saved, but couldn't be read: ${String(doc.extract_error).slice(0, 120)} — tap Read to retry`
                      : "Saved — not read by your AI yet"}
                  </span></>
                )}
              </div>
              )}
            </button>

            {!doc.extracted_text && readingId !== doc.id && !active && (
              <button
                onClick={() => readDocument(doc)}
                title="Let the AI read this document"
                style={{
                  background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
                  borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 600,
                  color: COLORS.textSecondary, cursor: "pointer", flexShrink: 0,
                }}
              >
                Read
              </button>
            )}

            <button
              onClick={() => remove(doc)}
              title="Remove"
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 6, display: "grid", placeItems: "center", flexShrink: 0,
              }}
            >
              <Trash2 size={15} color={COLORS.textMuted} />
            </button>
          </div>
        );
      })}

      {limit && docs.length > limit && (
        <div style={{ fontSize: 11.5, color: COLORS.textMuted, paddingTop: 10, display: "flex", alignItems: "center", gap: 3 }}>
          {docs.length - limit} more <ChevronRight size={12} />
        </div>
      )}
    </div>
  );
}

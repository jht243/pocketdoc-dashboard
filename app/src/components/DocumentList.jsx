import React, { useEffect, useState } from "react";
import { FileText, Camera, Dna, Trash2, ChevronRight } from "lucide-react";
import { COLORS, RADIUS } from "../theme/tokens";
import { useAuth } from "../lib/AuthContext";
import { listDocuments, getDocumentUrl, deleteDocument } from "../lib/profileStore";

const KIND_ICON = { lab: FileText, genetic: Dna, other: FileText };

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
export default function DocumentList({ limit, onEmptyAction }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    if (!user) return setLoading(false);
    setLoading(true);
    setDocs(await listDocuments(user.id));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const open = async (doc) => {
    setBusyId(doc.id);
    const url = await getDocumentUrl(doc.storage_path);
    setBusyId(null);
    if (url) window.open(url, "_blank", "noopener");
  };

  const remove = async (doc) => {
    if (!window.confirm(`Remove "${doc.file_name}" from your records?`)) return;
    setBusyId(doc.id);
    await deleteDocument(doc);
    setBusyId(null);
    load();
  };

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

  return (
    <div>
      {shown.map((doc) => {
        const Icon = iconFor(doc);
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
                {doc.status === "uploaded" ? " · Not yet analyzed" : ""}
              </div>
            </button>

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

import React, { useEffect, useState } from "react";
import { ArchiveRestore, ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { COLORS, DISPLAY } from "../theme/tokens";
import { chatImageUrl, deleteArchived, listArchived, loadMessages } from "../lib/chatStore";
import { RichReply } from "./RichReply";

const dateOf = (iso) => (iso
  ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  : "");

const iconButton = {
  background: COLORS.bgCardAlt, border: "none", borderRadius: 16, width: 32, height: 32,
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
};

/**
 * The member's archived conversations, over the chat screen: a list, then one
 * thread read-only with Restore and Delete. Archived threads are kept but not read
 * by the advocate, so a member can clear the chat without losing what was said.
 */
export function ArchivedChats({ userId, onClose, onRestore, onChanged, onNavigate }) {
  const [threads, setThreads] = useState(null);
  const [open, setOpen] = useState(null);         // the thread being read
  const [messages, setMessages] = useState(null); // its messages, once loaded
  const [busy, setBusy] = useState(false);

  const refresh = () => listArchived(userId).then(setThreads);
  useEffect(() => { refresh(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) { setMessages(null); return; }
    let cancelled = false;
    (async () => {
      const stored = await loadMessages(userId, 500, { thread: open.id });
      const hydrated = await Promise.all(stored.map(async (m) => (
        m.imagePath ? { ...m, imageUrl: await chatImageUrl(m.imagePath) } : m
      )));
      if (!cancelled) setMessages(hydrated);
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  const remove = async () => {
    if (busy || !window.confirm("Delete this archived conversation for good? This can't be undone.")) return;
    setBusy(true);
    await deleteArchived(userId, open.id);
    setOpen(null);
    await refresh();
    onChanged?.();
    setBusy(false);
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    const done = await onRestore(open.id);
    setBusy(false);
    if (done) onClose();
  };

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%", zIndex: 100,
      background: COLORS.bgDeep, display: "flex", flexDirection: "column", padding: "20px 18px 100px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        {open && (
          <button onClick={() => setOpen(null)} aria-label="Back to archived chats" style={iconButton}>
            <ChevronLeft size={16} color={COLORS.textSecondary} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0, fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {open ? "Archived conversation" : "Archived chats"}
        </div>
        <button onClick={onClose} aria-label="Close archived chats" style={iconButton}>
          <X size={16} color={COLORS.textSecondary} />
        </button>
      </div>

      {!open && (<>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
          Archived conversations are kept here. Your advocate doesn't read them in new chats; restore one to pick it back up.
        </div>
        {threads === null && <div style={{ fontSize: 12, color: COLORS.textMuted }}>Loading…</div>}
        {threads?.length === 0 && <div style={{ fontSize: 12, color: COLORS.textMuted }}>Nothing archived yet.</div>}
        {threads?.map((t) => (
          <button key={t.id} onClick={() => setOpen(t)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12,
            padding: "12px 14px", marginBottom: 8, cursor: "pointer", color: COLORS.textPrimary,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                Archived {dateOf(t.archivedAt)} · {t.count} message{t.count === 1 ? "" : "s"}
              </div>
            </div>
            <ChevronRight size={15} color={COLORS.textMuted} />
          </button>
        ))}
      </>)}

      {open && (<>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{open.title}</div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2, marginBottom: 12 }}>Archived {dateOf(open.archivedAt)}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={restore} disabled={busy} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: COLORS.teal, color: COLORS.onAccent, border: "none", borderRadius: 10,
            padding: "9px 12px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
          }}><ArchiveRestore size={14} /> Restore to chat</button>
          <button onClick={remove} disabled={busy} aria-label="Delete archived conversation" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: COLORS.bgCardAlt, color: COLORS.textSecondary, border: `1px solid ${COLORS.border}`, borderRadius: 10,
            padding: "9px 12px", fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
          }}><Trash2 size={14} /> Delete</button>
        </div>
        {messages === null && <div style={{ fontSize: 12, color: COLORS.textMuted }}>Loading…</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {messages?.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.imageUrl && <img src={m.imageUrl} alt="uploaded" style={{ maxWidth: 180, borderRadius: 12, marginBottom: 6 }} />}
              <div style={{
                maxWidth: m.role === "assistant" ? "92%" : "84%", padding: "10px 14px", borderRadius: 16,
                borderBottomRightRadius: m.role === "user" ? 4 : 16,
                borderBottomLeftRadius: m.role === "assistant" ? 4 : 16,
                background: m.role === "user" ? COLORS.teal : COLORS.bgCard,
                color: m.role === "user" ? COLORS.onAccent : COLORS.textPrimary,
                fontSize: 13, lineHeight: 1.6,
              }}>
                {m.role === "assistant" && !m.error
                  ? <RichReply text={m.text} onNavigate={onNavigate} />
                  : <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
              </div>
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

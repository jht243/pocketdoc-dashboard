/**
 * Persistence for the AI advocate conversation.
 *
 * The thread is the member's, not the session's: every message is written to
 * `ghai.conversation_messages` as it happens and read back on mount, so leaving
 * the screen — or the app — never costs them the conversation.
 *
 * Attached photos go to the private `health-docs` bucket rather than living as
 * base64 in a row. The whole thread is replayed to the model on each turn, so an
 * image has to be re-sendable later, and a data URL in the database would bloat
 * every read of the conversation to fetch bytes most turns don't need.
 *
 * The open conversation is the messages with no `conversation_id`. Archiving moves
 * it into a `ghai.conversations` row: off the screen and out of the advocate's
 * replay, but kept, readable and restorable (migration 20261020_chat_archive).
 */
import { supabase, isConfigured } from "./supabase";

const BUCKET = "health-docs";

/* ---------------- messages ---------------- */

function fromRow(row) {
  return {
    id: row.id,
    role: row.role,
    text: row.text || "",
    citations: row.citations || [],
    imagePath: row.image_path || null,
    team: row.team || null,
    error: row.is_error,
    createdAt: row.created_at,
    // Written while Test mode showed a demo profile (removed Oct 18 2026): kept for
    // the member to read, never used as context by the AI.
    fromTestMode: row.from_test_mode === true,
  };
}

/**
 * The member's conversation, oldest first so it renders as a transcript.
 * `limit` caps how far back we hydrate — the tail is what a returning member
 * actually reads, and phase 2 replaces this with per-thread paging.
 */
export async function loadMessages(userId, limit = 200, { thread = "open" } = {}) {
  if (!isConfigured || !userId) return [];
  let query = supabase
    .from("conversation_messages")
    .select("*")
    .eq("user_id", userId);
  // "open": the chat on screen. "all": archived threads too, for the insight cards,
  // where a symptom the member described still counts after the chat is archived.
  // Anything else is one archived conversation's id.
  if (thread === "open") query = query.is("conversation_id", null);
  else if (thread !== "all") query = query.eq("conversation_id", thread);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("loadMessages", error);
    return [];
  }
  return (data || []).map(fromRow).reverse();
}

/**
 * Write one message. Called as each turn happens rather than batched at the end,
 * so a member who navigates away mid-answer still finds their question stored.
 */
export async function appendMessage(userId, { role, text = "", citations = [], imagePath = null, error = false, team = null }) {
  if (!isConfigured || !userId) return null;
  const row = {
    user_id: userId,
    role,
    text,
    citations,
    image_path: imagePath,
    is_error: error,
  };
  // The care team's event log, so a stored reply can replay who was consulted.
  // Only sent when there is one, so plain messages never depend on the column.
  if (team) row.team = team;
  let { data, error: dbError } = await supabase
    .from("conversation_messages")
    .insert(row)
    .select()
    .single();
  // A database that hasn't had the `team` migration yet must not cost the member
  // their reply: store it without the trace instead.
  if (dbError && team && /team/i.test(dbError.message || "")) {
    delete row.team;
    ({ data, error: dbError } = await supabase.from("conversation_messages").insert(row).select().single());
  }
  if (dbError) {
    // A failed write must not swallow the reply the member is already reading, so
    // this is reported and the in-memory message stands.
    console.error("appendMessage", dbError);
    return null;
  }
  return fromRow(data);
}

/** One thread's messages: the open one (`null`) or an archived one, by id. */
const inThread = (query, conversationId) =>
  conversationId ? query.eq("conversation_id", conversationId) : query.is("conversation_id", null);

/** Remove the photos a thread carried, before its messages go. */
async function removeThreadImages(userId, conversationId) {
  const { data: rows } = await inThread(
    supabase.from("conversation_messages").select("image_path").eq("user_id", userId).not("image_path", "is", null),
    conversationId,
  );
  const paths = (rows || []).map((r) => r.image_path).filter(Boolean);
  if (paths.length) {
    const { error: rmError } = await supabase.storage.from(BUCKET).remove(paths);
    // Orphaned objects are litter, not a reason to keep the messages the member
    // asked to delete — log and carry on.
    if (rmError) console.error("removeThreadImages", rmError);
  }
}

/** Delete the open conversation, including any photos it carried. Archived ones stay. */
export async function clearConversation(userId) {
  if (!isConfigured || !userId) return { error: null };
  await removeThreadImages(userId, null);
  const { error } = await supabase
    .from("conversation_messages")
    .delete()
    .eq("user_id", userId)
    .is("conversation_id", null);
  if (error) console.error("clearConversation", error);
  return { error };
}

/* ---------------- archive ---------------- */

/** The archive's name for a thread: the member's first question, clipped. */
export function threadTitle(messages = []) {
  // Test-mode-era questions were about the demo profile, so they never name a thread.
  const asked = (m) => m.role === "user" && String(m.text || "").trim();
  const first = messages.find((m) => asked(m) && !m.fromTestMode);
  const fallback = messages.some(asked) ? "Earlier conversation (Test mode)" : "Conversation";
  const t = String(first?.text || fallback).replace(/\s+/g, " ").trim();
  return t.length > 70 ? `${t.slice(0, 69).trimEnd()}…` : t;
}

/**
 * Move the open conversation into the archive. Its messages keep their dates and
 * photos; they only stop being the thread on screen and the one the advocate reads.
 */
export async function archiveConversation(userId, title) {
  if (!isConfigured || !userId) return { error: null };
  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title, archived_at: new Date().toISOString() })
    .select()
    .single();
  if (error) {
    console.error("archiveConversation", error);
    return { error };
  }
  const { error: moveError } = await supabase
    .from("conversation_messages")
    .update({ conversation_id: conv.id })
    .eq("user_id", userId)
    .is("conversation_id", null);
  if (moveError) {
    // Nothing moved: drop the empty archive entry rather than list a blank thread.
    console.error("archiveConversation/move", moveError);
    await supabase.from("conversations").delete().eq("id", conv.id);
    return { error: moveError };
  }
  return { error: null, conversation: conv };
}

/** Archived conversations, newest first, each with how many messages it holds. */
export async function listArchived(userId) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, archived_at, created_at, conversation_messages(count)")
    .eq("user_id", userId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error) {
    console.error("listArchived", error);
    return [];
  }
  return (data || []).map((c) => ({
    id: c.id,
    title: c.title || "Conversation",
    archivedAt: c.archived_at,
    count: c.conversation_messages?.[0]?.count ?? 0,
  }));
}

/**
 * Bring an archived conversation back as the open one. The caller archives the
 * current open thread first, so the two are never merged into one.
 */
export async function restoreConversation(userId, conversationId) {
  if (!isConfigured || !userId || !conversationId) return { error: null };
  const { error } = await supabase
    .from("conversation_messages")
    .update({ conversation_id: null })
    .eq("user_id", userId)
    .eq("conversation_id", conversationId);
  if (error) {
    console.error("restoreConversation", error);
    return { error };
  }
  await supabase.from("conversations").delete().eq("id", conversationId).eq("user_id", userId);
  return { error: null };
}

/** Delete an archived conversation for good, photos included. */
export async function deleteArchived(userId, conversationId) {
  if (!isConfigured || !userId || !conversationId) return { error: null };
  await removeThreadImages(userId, conversationId);
  // Its messages go with it (on delete cascade).
  const { error } = await supabase.from("conversations").delete().eq("id", conversationId).eq("user_id", userId);
  if (error) console.error("deleteArchived", error);
  return { error };
}

/* ---------------- images ---------------- */

/**
 * Store an attached photo. Namespaced under the member's id because the bucket
 * policy enforces that prefix, and under `chat/` so a conversation photo is never
 * mistaken for an uploaded lab document.
 */
export async function uploadChatImage(userId, file) {
  if (!isConfigured || !userId || !file) return { path: null, error: null };
  const safeName = (file.name || "photo.jpg").replace(/[^\w.\-]/g, "_");
  const path = `${userId}/chat/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) {
    console.error("uploadChatImage", error);
    return { path: null, error };
  }
  return { path, error: null };
}

/** Short-lived signed URL for displaying a stored photo; the bucket is private. */
export async function chatImageUrl(path, expiresInSeconds = 3600) {
  if (!isConfigured || !path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("chatImageUrl", error);
    return null;
  }
  return data?.signedUrl || null;
}

/**
 * A stored photo as bare base64, which is the shape the model expects. Used when
 * replaying a thread whose images were uploaded in an earlier session and so are
 * no longer in memory.
 */
export async function chatImageBase64(path) {
  if (!isConfigured || !path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    console.error("chatImageBase64", error);
    return null;
  }
  const buffer = await data.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000; // chunked so a large photo can't blow the argument limit
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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
 * Phase 1 is one continuous conversation per member; `conversation_id` stays null
 * until phase 2 introduces separate threads.
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
    error: row.is_error,
    createdAt: row.created_at,
  };
}

/**
 * The member's conversation, oldest first so it renders as a transcript.
 * `limit` caps how far back we hydrate — the tail is what a returning member
 * actually reads, and phase 2 replaces this with per-thread paging.
 */
export async function loadMessages(userId, limit = 200) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("*")
    .eq("user_id", userId)
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
export async function appendMessage(userId, { role, text = "", citations = [], imagePath = null, error = false }) {
  if (!isConfigured || !userId) return null;
  const { data, error: dbError } = await supabase
    .from("conversation_messages")
    .insert({
      user_id: userId,
      role,
      text,
      citations,
      image_path: imagePath,
      is_error: error,
    })
    .select()
    .single();
  if (dbError) {
    // A failed write must not swallow the reply the member is already reading, so
    // this is reported and the in-memory message stands.
    console.error("appendMessage", dbError);
    return null;
  }
  return fromRow(data);
}

/** Delete the whole conversation, including any photos it carried. */
export async function clearConversation(userId) {
  if (!isConfigured || !userId) return { error: null };

  const { data: rows } = await supabase
    .from("conversation_messages")
    .select("image_path")
    .eq("user_id", userId)
    .not("image_path", "is", null);

  const paths = (rows || []).map((r) => r.image_path).filter(Boolean);
  if (paths.length) {
    const { error: rmError } = await supabase.storage.from(BUCKET).remove(paths);
    // Orphaned objects are litter, not a reason to keep the messages the member
    // asked to delete — log and carry on.
    if (rmError) console.error("clearConversation/storage", rmError);
  }

  const { error } = await supabase
    .from("conversation_messages")
    .delete()
    .eq("user_id", userId);
  if (error) console.error("clearConversation", error);
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

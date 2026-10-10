/**
 * Delete the calling member's account, permanently.
 *
 * Two things hold a member's data: rows in the ghai schema and files in the
 * private `health-docs` bucket. Every ghai table references auth.users with
 * ON DELETE CASCADE, so deleting the auth user removes every row in one step.
 * Storage has no such link, so the member's folder (`<user id>/…`, which the bucket
 * policy already enforces) is emptied first. Files go first on purpose: if that
 * step fails the account still exists and the member can try again, rather than
 * leaving orphaned lab PDFs that nobody can reach or delete.
 *
 * The browser cannot do this itself. Deleting an auth user takes the service role,
 * so it happens here, after the caller is identified from their own JWT. A member
 * can only ever delete themselves.
 *
 * Body: { confirm: "DELETE" }. The literal is required so a stray request, or a
 * replayed one from somewhere other than the confirmation screen, cannot delete an
 * account.
 */

import { CORS, adminClient, json, userFromRequest } from "../_shared/admin.ts";

const BUCKET = "health-docs";

type Admin = ReturnType<typeof adminClient>;

/** Every object path under a prefix, walking into sub-folders (chat/, labs, …). */
async function listAll(admin: Admin, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      // Folders come back without an id.
      if (entry.id) out.push(path);
      else out.push(...(await listAll(admin, path)));
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Not authenticated." }, 401);

    const { confirm } = await req.json().catch(() => ({}));
    if (confirm !== "DELETE") return json({ error: "Deletion was not confirmed." }, 400);

    const admin = adminClient();

    const paths = await listAll(admin, user.id);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
      if (error) return json({ error: `Could not delete your files: ${error.message}` }, 500);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return json({ error: `Could not delete your account: ${error.message}` }, 500);

    return json({ ok: true, filesDeleted: paths.length });
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

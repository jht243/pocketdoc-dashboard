/**
 * Shared Edge Function helpers: the service-role Supabase client, CORS, and the
 * caller-identity check.
 *
 * The service-role client bypasses RLS, which is exactly what the sync path needs
 * (it writes biometric rows on the user's behalf) and exactly why every function
 * using it must establish WHO it is acting for before it touches a row.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

/** Service-role client. Bypasses RLS — only ever reachable from function code. */
export const adminClient = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** ghai-schema-bound query builder, matching the browser client's binding. */
export const ghai = (admin: ReturnType<typeof adminClient>) => admin.schema("ghai");

/**
 * Resolve the calling user from the request's JWT.
 *
 * Functions deployed WITH jwt verification still need this to know which user is
 * calling — the gateway only proves the token is valid, not whose it is. Returns
 * null when there's no usable token; callers must treat that as 401.
 */
export async function userFromRequest(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id };
}

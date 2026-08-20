/**
 * Step 2 of the Oura OAuth flow: the redirect target Oura sends the user back to.
 *
 * This is a plain browser navigation, not an app fetch — there is no JWT on the
 * request. Identity comes entirely from the `state` nonce minted by
 * ghai-oura-connect, which is why that nonce is single-use and short-lived.
 *
 * MUST be deployed without JWT verification:
 *   supabase functions deploy ghai-oura-callback --no-verify-jwt
 *
 * Every exit path is a redirect back into the app. A user who just clicked "Allow"
 * should never end up staring at a raw JSON error body in their browser.
 *
 * Secrets: OURA_CLIENT_ID, OURA_CLIENT_SECRET, OURA_TOKEN_KEY, SITE_URL
 */

import { adminClient, ghai } from "../_shared/admin.ts";
import { seal } from "../_shared/crypto.ts";
import {
  assertConfigured,
  buildRowsForRange,
  exchangeCode,
  fetchPersonalInfo,
  isoDay,
} from "../_shared/oura.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// 30 days is enough to seed the 14-day rolling baseline the UI compares against and
// still show a trend, without a slow first connect.
const BACKFILL_DAYS = 30;

const redirect = (params: Record<string, string>) => {
  const url = new URL(SITE_URL || "/");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
};

Deno.serve(async (req) => {
  try {
    assertConfigured();

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const denied = url.searchParams.get("error");

    // The user pressed "Deny" at Oura. Not an error worth alarming them about.
    if (denied) return redirect({ oura: "cancelled" });
    if (!code || !state) return redirect({ oura: "error", reason: "missing_code" });

    const admin = adminClient();

    // Consume the nonce: select then delete, so a replayed callback finds nothing.
    const { data: stateRow } = await ghai(admin)
      .from("oura_oauth_states")
      .select("nonce, user_id, return_to, expires_at")
      .eq("nonce", state)
      .maybeSingle();

    if (!stateRow) return redirect({ oura: "error", reason: "invalid_state" });
    await ghai(admin).from("oura_oauth_states").delete().eq("nonce", state);

    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      return redirect({ oura: "error", reason: "expired_state" });
    }

    const userId = stateRow.user_id as string;

    // ---- exchange the code -------------------------------------------------
    const tokens = await exchangeCode(
      code,
      `${SUPABASE_URL}/functions/v1/ghai-oura-callback`,
    );

    // ---- identify the Oura member -----------------------------------------
    // Webhook events identify people by Oura's user id, not ours, so this mapping
    // has to be captured now — there's no way to derive it later.
    const personal = await fetchPersonalInfo(tokens.access_token);
    const ouraUserId = personal?.id;
    if (!ouraUserId) return redirect({ oura: "error", reason: "no_personal_info" });

    // Record the scopes actually GRANTED. Oura's consent screen lets a user decline
    // individual scopes, so what we asked for and what we got can differ — and the
    // UI needs to know which panels will stay empty.
    const grantedScopes = (tokens.scope ?? "").split(/[\s,]+/).filter(Boolean);

    const { error: upsertError } = await ghai(admin)
      .from("oura_connections")
      .upsert(
        {
          user_id: userId,
          oura_user_id: String(ouraUserId),
          access_token_enc: await seal(tokens.access_token),
          refresh_token_enc: await seal(tokens.refresh_token),
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: grantedScopes,
          status: "connected",
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      // The unique constraint on oura_user_id is the interesting failure: this Oura
      // account is already linked to a different app user.
      const reason = upsertError.code === "23505" ? "already_linked" : "store_failed";
      return redirect({ oura: "error", reason });
    }

    // ---- backfill ----------------------------------------------------------
    // Done inline so the user lands on a populated Home screen rather than an empty
    // one that fills in later. A backfill failure is not a connection failure — the
    // tokens are stored and the nightly sync will catch up.
    try {
      const rows = await buildRowsForRange(
        tokens.access_token,
        userId,
        isoDay(BACKFILL_DAYS),
        isoDay(0),
      );
      if (rows.length) {
        await ghai(admin)
          .from("wearable_daily")
          .upsert(rows, { onConflict: "user_id,day,source" });
      }
      await ghai(admin)
        .from("oura_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("user_id", userId);
    } catch (backfillErr) {
      await ghai(admin)
        .from("oura_connections")
        .update({ last_error: `Backfill failed: ${String((backfillErr as Error)?.message ?? backfillErr)}` })
        .eq("user_id", userId);
      return redirect({ oura: "connected", warn: "backfill_pending" });
    }

    return redirect({ oura: "connected" });
  } catch (err) {
    console.error("ghai-oura-callback", String((err as Error)?.message ?? err));
    return redirect({ oura: "error", reason: "unexpected" });
  }
});

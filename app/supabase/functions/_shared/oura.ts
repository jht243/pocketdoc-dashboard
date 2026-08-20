/**
 * Oura API v2 client + the Oura → wearable_daily mapping.
 *
 * Everything that knows Oura's wire format lives here. The Edge Functions handle
 * transport and auth; this module owns "what does an Oura payload mean".
 *
 * Docs: https://cloud.ouraring.com/v2/docs
 *
 * Secrets used by callers:
 *   OURA_CLIENT_ID
 *   OURA_CLIENT_SECRET
 */

import { open, seal } from "./crypto.ts";

export const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
export const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
export const OURA_API = "https://api.ouraring.com/v2";

const CLIENT_ID = Deno.env.get("OURA_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("OURA_CLIENT_SECRET") ?? "";

/**
 * Scopes we request. Deliberately narrower than what Oura offers — `email`, `tag`
 * and `session` aren't used anywhere in the app, and the consent screen lets a user
 * decline scopes individually, so a shorter list means fewer chances to be declined.
 *   personal   → /usercollection/personal_info, needed for the Oura user id
 *   daily      → daily_sleep / daily_readiness / daily_activity
 *   heartrate  → the `sleep` session detail (HRV in ms, lowest HR)
 *   workout    → workouts
 *   spo2       → daily_spo2
 */
export const OURA_SCOPES = ["personal", "daily", "heartrate", "workout", "spo2"];

export const basicAuthHeader = () =>
  `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`;

export function assertConfigured() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("OURA_CLIENT_ID / OURA_CLIENT_SECRET are not configured.");
  }
}

/* ------------------------------------------------------------------ tokens -- */

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const data = await res.json();
  if (!res.ok) {
    // `invalid_grant` is the meaningful one: the user revoked access at Oura's end,
    // or a rotated refresh token was lost. Callers mark the connection revoked.
    const err = new Error(data?.error_description || data?.error || `HTTP ${res.status}`);
    (err as any).ouraError = data?.error ?? null;
    throw err;
  }
  return data as TokenResponse;
}

export const exchangeCode = (code: string, redirectUri: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

export const refreshTokens = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

/**
 * Return a usable access token for a stored connection, refreshing when it is
 * within 5 minutes of expiry.
 *
 * Oura ROTATES the refresh token on every refresh, so the new one is persisted here
 * immediately. Dropping it silently bricks the connection until the user reconnects.
 */
export async function getAccessToken(
  admin: any,
  connection: { user_id: string; access_token_enc: string; refresh_token_enc: string; token_expires_at: string },
): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  if (expiresAt - Date.now() > 5 * 60_000) {
    return await open(connection.access_token_enc);
  }

  try {
    const fresh = await refreshTokens(await open(connection.refresh_token_enc));
    await admin
      .schema("ghai")
      .from("oura_connections")
      .update({
        access_token_enc: await seal(fresh.access_token),
        refresh_token_enc: await seal(fresh.refresh_token),
        token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
        status: "connected",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", connection.user_id);
    return fresh.access_token;
  } catch (err) {
    if ((err as any).ouraError === "invalid_grant") {
      // Consent is gone. Stop syncing rather than retrying forever; the UI shows a
      // reconnect prompt off the back of this status.
      await admin
        .schema("ghai")
        .from("oura_connections")
        .update({
          status: "revoked",
          last_error: "Access was revoked at Oura. The user needs to reconnect.",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", connection.user_id);
    }
    throw err;
  }
}

/* -------------------------------------------------------------- collections -- */

/** GET a v2 collection across a date range, following `next_token` pagination. */
export async function fetchCollection(
  accessToken: string,
  collection: string,
  startDate: string,
  endDate: string,
): Promise<any[]> {
  const out: any[] = [];
  let nextToken: string | null = null;

  do {
    const url = new URL(`${OURA_API}/usercollection/${collection}`);
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    if (nextToken) url.searchParams.set("next_token", nextToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (res.status === 429) throw new Error("Oura rate limit hit (429). Back off and retry.");
    if (res.status === 403) {
      // The user declined this scope at consent. Not fatal — the rest still syncs.
      return out;
    }
    if (!res.ok) {
      throw new Error(`Oura ${collection} failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
    }

    const data = await res.json();
    out.push(...(data?.data ?? []));
    nextToken = data?.next_token ?? null;
  } while (nextToken);

  return out;
}

/** Fetch a single object by id — used by the webhook path, which gets a pointer only. */
export async function fetchObject(
  accessToken: string,
  collection: string,
  objectId: string,
): Promise<any | null> {
  const res = await fetch(`${OURA_API}/usercollection/${collection}/${objectId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchPersonalInfo(accessToken: string): Promise<any> {
  const res = await fetch(`${OURA_API}/usercollection/personal_info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Oura personal_info failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return await res.json();
}

/* ------------------------------------------------------------------ mapping -- */

const round = (n: unknown, dp = 1) =>
  typeof n === "number" && Number.isFinite(n) ? Number(n.toFixed(dp)) : null;

const minutes = (seconds: unknown) =>
  typeof seconds === "number" && Number.isFinite(seconds) ? Math.round(seconds / 60) : null;

/**
 * Pick the night's main sleep session.
 *
 * The `sleep` collection returns one row per session, so a day with naps has several.
 * Only `long_sleep` carries meaningful HRV/resting-HR; averaging a 20-minute nap into
 * the night's numbers would quietly corrupt the baselines. Falls back to the longest
 * session when Oura hasn't typed them.
 */
export function pickMainSleep(sessions: any[]): any | null {
  if (!sessions?.length) return null;
  const longSleep = sessions.filter((s) => s?.type === "long_sleep");
  const pool = longSleep.length ? longSleep : sessions;
  return pool.reduce((best, s) =>
    (s?.total_sleep_duration ?? 0) > (best?.total_sleep_duration ?? 0) ? s : best
  , pool[0]);
}

/**
 * Zone 2 minutes — DERIVED, because Oura has no training-zone concept at all.
 *
 * Oura's medium-activity band is roughly MET 4-7, which brackets Zone 2 for most
 * people, so medium + high is the closest honest proxy without pulling the 288-sample
 * MET time-series. The UI labels this "Active minutes (MET 4+)" rather than "Zone 2",
 * because we are not measuring heart-rate zones and shouldn't imply that we are.
 */
export function deriveZone2Minutes(dailyActivity: any): number | null {
  if (!dailyActivity) return null;
  const medium = dailyActivity.medium_activity_minutes ?? 0;
  const high = dailyActivity.high_activity_minutes ?? 0;
  return medium + high;
}

export interface OuraDayInputs {
  dailySleep?: any;
  dailyReadiness?: any;
  dailyActivity?: any;
  sleepSessions?: any[];
  dailySpo2?: any;
}

/** Build one `wearable_daily` row from the day's collected Oura payloads. */
export function toWearableDaily(userId: string, day: string, inputs: OuraDayInputs) {
  const { dailySleep, dailyReadiness, dailyActivity, sleepSessions, dailySpo2 } = inputs;
  const sleep = pickMainSleep(sleepSessions ?? []);

  return {
    user_id: userId,
    day,
    source: "oura",

    sleep_score: dailySleep?.score ?? null,
    readiness_score: dailyReadiness?.score ?? null,
    activity_score: dailyActivity?.score ?? null,

    // HRV in milliseconds and resting HR come from the sleep SESSION.
    // daily_readiness.contributors.hrv_balance is a 0-100 score, not milliseconds —
    // using it here would put a plausible-looking wrong number on the Home screen.
    hrv_ms: round(sleep?.average_hrv),
    resting_hr: sleep?.lowest_heart_rate ?? null,
    average_hr: round(sleep?.average_heart_rate),
    // Oura reports efficiency 0-100; the app's `today.sleepEfficiency` is a fraction.
    sleep_efficiency: typeof sleep?.efficiency === "number" ? round(sleep.efficiency / 100, 2) : null,
    total_sleep_minutes: minutes(sleep?.total_sleep_duration),
    deep_sleep_minutes: minutes(sleep?.deep_sleep_duration),
    rem_sleep_minutes: minutes(sleep?.rem_sleep_duration),
    awake_minutes: minutes(sleep?.awake_time),
    temp_deviation_c: round(dailyReadiness?.temperature_deviation, 2),
    spo2_percent: round(dailySpo2?.spo2_percentage?.average, 1),

    steps: dailyActivity?.steps ?? null,
    active_calories: dailyActivity?.active_calories ?? null,
    high_activity_minutes: dailyActivity?.high_activity_minutes ?? null,
    medium_activity_minutes: dailyActivity?.medium_activity_minutes ?? null,
    zone2_minutes: deriveZone2Minutes(dailyActivity),

    raw: {
      daily_sleep: dailySleep ?? null,
      daily_readiness: dailyReadiness ?? null,
      daily_activity: dailyActivity ?? null,
      sleep: sleep ?? null,
      daily_spo2: dailySpo2 ?? null,
    },
    synced_at: new Date().toISOString(),
  };
}

/**
 * Fetch every collection for a date range and fold them into one row per day.
 *
 * Collections are fetched in parallel and indexed by `day`, so a day missing one
 * collection (a night without the ring on, a declined scope) still produces a row
 * with the fields it does have rather than being dropped entirely.
 */
export async function buildRowsForRange(
  accessToken: string,
  userId: string,
  startDate: string,
  endDate: string,
) {
  const [dailySleep, dailyReadiness, dailyActivity, sleepSessions, dailySpo2] =
    await Promise.all([
      fetchCollection(accessToken, "daily_sleep", startDate, endDate),
      fetchCollection(accessToken, "daily_readiness", startDate, endDate),
      fetchCollection(accessToken, "daily_activity", startDate, endDate),
      fetchCollection(accessToken, "sleep", startDate, endDate),
      fetchCollection(accessToken, "daily_spo2", startDate, endDate),
    ]);

  const byDay = <T extends { day?: string }>(rows: T[]) =>
    new Map(rows.filter((r) => r?.day).map((r) => [r.day as string, r]));

  const sleepMap = byDay(dailySleep);
  const readinessMap = byDay(dailyReadiness);
  const activityMap = byDay(dailyActivity);
  const spo2Map = byDay(dailySpo2);

  const sessionsByDay = new Map<string, any[]>();
  for (const s of sleepSessions) {
    if (!s?.day) continue;
    sessionsByDay.set(s.day, [...(sessionsByDay.get(s.day) ?? []), s]);
  }

  const days = new Set<string>([
    ...sleepMap.keys(),
    ...readinessMap.keys(),
    ...activityMap.keys(),
    ...spo2Map.keys(),
    ...sessionsByDay.keys(),
  ]);

  return [...days].sort().map((day) =>
    toWearableDaily(userId, day, {
      dailySleep: sleepMap.get(day),
      dailyReadiness: readinessMap.get(day),
      dailyActivity: activityMap.get(day),
      sleepSessions: sessionsByDay.get(day),
      dailySpo2: spo2Map.get(day),
    })
  );
}

/** YYYY-MM-DD, `daysAgo` days before today (UTC). */
export function isoDay(daysAgo = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

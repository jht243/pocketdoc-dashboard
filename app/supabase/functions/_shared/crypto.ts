/**
 * Envelope encryption for stored third-party OAuth tokens.
 *
 * An Oura refresh token is a long-lived credential to a person's biometric history.
 * RLS keeps it away from the browser, but anyone holding a database dump would still
 * read it in plaintext — so tokens are sealed here, in the function layer, and the
 * database only ever sees ciphertext.
 *
 * AES-256-GCM via WebCrypto (built into Deno, no dependency). Format:
 *   base64(iv) . ":" . base64(ciphertext+tag)
 * A fresh 12-byte IV per seal, which is what GCM requires — never reuse one.
 *
 * Secret:
 *   OURA_TOKEN_KEY   base64-encoded 32 random bytes. Generate with:
 *                      openssl rand -base64 32
 *
 * Rotating the key invalidates every stored token; users would have to reconnect.
 */

const KEY_B64 = Deno.env.get("OURA_TOKEN_KEY") ?? "";

let cachedKey: CryptoKey | null = null;

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  if (!KEY_B64) throw new Error("OURA_TOKEN_KEY is not configured.");

  const raw = b64ToBytes(KEY_B64);
  if (raw.byteLength !== 32) {
    throw new Error(
      `OURA_TOKEN_KEY must decode to 32 bytes (got ${raw.byteLength}). Generate with: openssl rand -base64 32`,
    );
  }

  cachedKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  return cachedKey;
}

/** Encrypt a token for storage. */
export async function seal(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${bytesToB64(iv)}:${bytesToB64(new Uint8Array(ciphertext))}`;
}

/** Decrypt a stored token. Throws if the key changed or the value was tampered with. */
export async function open(sealed: string): Promise<string> {
  const key = await getKey();
  const [ivB64, dataB64] = String(sealed).split(":");
  if (!ivB64 || !dataB64) throw new Error("Malformed sealed value.");

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(ivB64) },
    key,
    b64ToBytes(dataB64),
  );
  return new TextDecoder().decode(plaintext);
}

/** Constant-time string compare, for verification tokens and HMAC digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Hex HMAC-SHA256, used to verify Oura webhook signatures. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

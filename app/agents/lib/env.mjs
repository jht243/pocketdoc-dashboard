// Tiny .env loader (no dependency). Reads agents/.env.local, then app/.env.local,
// then process.env wins over both. Locally the app's own .env.local already holds
// the Supabase URL and anon key, so the service needs nothing new to run.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function loadDotEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no file */ }
  return out;
}

const fileEnv = { ...loadDotEnv(join(here, '..', '..', '.env.local')), ...loadDotEnv(join(here, '..', '.env.local')) };

export function env(key, fallback = undefined) {
  return process.env[key] ?? fileEnv[key] ?? fallback;
}

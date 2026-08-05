/**
 * Writes Supabase Auth email HTML into app/emails/auth/ and optionally
 * PATCHes them onto the MetabolicHealth project via the Management API.
 *
 * Usage:
 *   node scripts/apply-auth-email-templates.mjs           # write files only
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-auth-email-templates.mjs --apply
 *
 * Token: https://supabase.com/dashboard/account/tokens
 * Project: MetabolicHealth (pmqxkdqkqxhbrymeerem) — temporary GHAI host
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "emails", "auth");
const PROJECT_REF = "pmqxkdqkqxhbrymeerem";

const { AUTH_EMAIL_TEMPLATES } = await import(
  pathToFileURL(join(root, "src", "lib", "emailLayout.js")).href
);

mkdirSync(outDir, { recursive: true });

const subjects = {};
const contents = {};

for (const [key, tpl] of Object.entries(AUTH_EMAIL_TEMPLATES)) {
  const html = tpl.content();
  writeFileSync(join(outDir, `${key}.html`), html, "utf8");
  subjects[key] = tpl.subject;
  contents[key] = html;
  console.log(`wrote emails/auth/${key}.html`);
}

writeFileSync(
  join(outDir, "subjects.json"),
  JSON.stringify(subjects, null, 2) + "\n",
  "utf8"
);

const apply = process.argv.includes("--apply");
if (!apply) {
  console.log("\nDry run only. To push to Supabase Auth:");
  console.log(
    "  SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-auth-email-templates.mjs --apply"
  );
  console.log(
    "\nOr paste each HTML file into Dashboard → Authentication → Email Templates:"
  );
  console.log(
    `  https://supabase.com/dashboard/project/${PROJECT_REF}/auth/templates`
  );
  process.exit(0);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const payload = {
  mailer_subjects_confirmation: subjects.confirmation,
  mailer_templates_confirmation_content: contents.confirmation,
  mailer_subjects_invite: subjects.invite,
  mailer_templates_invite_content: contents.invite,
  mailer_subjects_magic_link: subjects.magic_link,
  mailer_templates_magic_link_content: contents.magic_link,
  mailer_subjects_recovery: subjects.recovery,
  mailer_templates_recovery_content: contents.recovery,
  mailer_subjects_email_change: subjects.email_change,
  mailer_templates_email_change_content: contents.email_change,
  mailer_subjects_reauthentication: subjects.reauthentication,
  mailer_templates_reauthentication_content: contents.reauthentication,
};

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }
);

const text = await res.text();
if (!res.ok) {
  console.error(`Supabase API ${res.status}:`, text);
  process.exit(1);
}

console.log("\nApplied auth email templates to MetabolicHealth.");
console.log("Send a test signup to verify the new confirm-email design.");

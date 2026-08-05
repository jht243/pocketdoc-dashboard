/**
 * Shared branded email shell for Guided Health AI / PocketDoc.
 *
 * Table-based, inline styles only — works across Gmail, Apple Mail, Outlook,
 * and mobile clients. Colors match app/src/theme/tokens.js.
 */

export const EMAIL_COLORS = {
  bg: "#f6f7f9",
  card: "#ffffff",
  accent: "#0284c7",
  accentDeep: "#0369a1",
  text: "#0f172a",
  textSecondary: "#55657a",
  textMuted: "#8494a7",
  border: "#e5eaf0",
  good: "#16a34a",
  onAccent: "#ffffff",
};

const BRAND = "Guided Health AI";
const DISCLAIMER =
  "Guided Health AI is a wellness companion, not a medical device. It does not diagnose, treat, or prescribe, and it never replaces your clinician.";

/**
 * @param {object} opts
 * @param {string} opts.preheader  Inbox preview text (hidden in body)
 * @param {string} opts.headline   Primary heading (h1)
 * @param {string} [opts.subheader] Supporting line under the headline
 * @param {string} opts.bodyHtml   Main body HTML (paragraphs, lists, etc.)
 * @param {string} [opts.ctaLabel] Button label
 * @param {string} [opts.ctaUrl]   Button href
 * @param {string} [opts.footerNote] Extra footer line above disclaimer
 */
export function renderEmailLayout({
  preheader = "",
  headline,
  subheader = "",
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerNote = "",
}) {
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;margin-bottom:8px">
                    <tr>
                      <td align="left">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td bgcolor="${EMAIL_COLORS.accent}" style="background-color:${EMAIL_COLORS.accent};border-radius:12px;text-align:center">
                              <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding-top:14px;padding-bottom:14px;padding-left:28px;padding-right:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:${EMAIL_COLORS.onAccent};text-decoration:none;border-radius:12px">
                                ${ctaLabel}
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <p style="margin-top:16px;margin-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${EMAIL_COLORS.textMuted}">
                    Or paste this link into your browser:<br />
                    <a href="${ctaUrl}" style="color:${EMAIL_COLORS.accent};word-break:break-all;text-decoration:underline">${ctaUrl}</a>
                  </p>`
      : "";

  const subheaderBlock = subheader
    ? `<p style="margin-top:0;margin-bottom:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${EMAIL_COLORS.textSecondary}">${subheader}</p>`
    : "";

  const footerNoteBlock = footerNote
    ? `<p style="margin-top:0;margin-bottom:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${EMAIL_COLORS.textMuted}">${footerNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeAttr(headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_COLORS.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <div lang="en" dir="ltr" style="display:none;max-height:0;overflow:hidden;mso-hide:all">
    ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${EMAIL_COLORS.bg}" style="background-color:${EMAIL_COLORS.bg}">
    <tr>
      <td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;width:100%">
          <!-- Brand header -->
          <tr>
            <td style="padding-bottom:20px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="${EMAIL_COLORS.accent}" width="32" height="32" style="background-color:${EMAIL_COLORS.accent};border-radius:10px;width:32px;height:32px;text-align:center;vertical-align:middle">
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:700;line-height:32px;color:${EMAIL_COLORS.onAccent}">GH</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle">
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:600;line-height:1.2;color:${EMAIL_COLORS.text};letter-spacing:-0.01em">${BRAND}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td bgcolor="${EMAIL_COLORS.card}" style="background-color:${EMAIL_COLORS.card};border:1px solid ${EMAIL_COLORS.border};border-radius:16px;padding-top:32px;padding-bottom:32px;padding-left:28px;padding-right:28px">
              <h1 style="margin-top:0;margin-bottom:8px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;line-height:1.25;color:${EMAIL_COLORS.text};letter-spacing:-0.01em">
                ${headline}
              </h1>
              ${subheaderBlock}
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${EMAIL_COLORS.text}">
                ${bodyHtml}
              </div>
              ${ctaBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;padding-left:8px;padding-right:8px">
              ${footerNoteBlock}
              <p style="margin-top:0;margin-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.55;color:${EMAIL_COLORS.textMuted}">
                ${DISCLAIMER}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

/**
 * Supabase Auth Go-template body (no full document — Auth injects into its mailer).
 * Uses {{ .ConfirmationURL }} etc. Placeholders must stay unescaped for Go templates.
 */
export function renderAuthEmailBody({
  headline,
  subheader = "",
  bodyHtml,
  ctaLabel,
  ctaUrl = "{{ .ConfirmationURL }}",
  footerNote = "",
}) {
  const c = EMAIL_COLORS;
  const subheaderBlock = subheader
    ? `<p style="margin-top:0;margin-bottom:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${c.textSecondary}">${subheader}</p>`
    : "";
  const footerNoteBlock = footerNote
    ? `<p style="margin-top:0;margin-bottom:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${c.textMuted}">${footerNote}</p>`
    : "";
  const ctaBlock = ctaLabel
    ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;margin-bottom:8px">
  <tr>
    <td align="left">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td bgcolor="${c.accent}" style="background-color:${c.accent};border-radius:12px;text-align:center">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding-top:14px;padding-bottom:14px;padding-left:28px;padding-right:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:${c.onAccent};text-decoration:none;border-radius:12px">${ctaLabel}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<p style="margin-top:16px;margin-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${c.textMuted}">If the button does not work, copy and paste this link into your browser:<br /><a href="${ctaUrl}" style="color:${c.accent};word-break:break-all;text-decoration:underline">${ctaUrl}</a></p>`
    : "";

  return `<div lang="en" dir="ltr" style="margin:0;padding:0;background-color:${c.bg}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${c.bg}" style="background-color:${c.bg}">
  <tr>
    <td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;width:100%">
        <tr>
          <td style="padding-bottom:20px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="${c.accent}" width="32" height="32" style="background-color:${c.accent};border-radius:10px;width:32px;height:32px;text-align:center;vertical-align:middle">
                  <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:700;line-height:32px;color:${c.onAccent}">GH</span>
                </td>
                <td style="padding-left:10px;vertical-align:middle">
                  <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:600;line-height:1.2;color:${c.text};letter-spacing:-0.01em">${BRAND}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td bgcolor="${c.card}" style="background-color:${c.card};border:1px solid ${c.border};border-radius:16px;padding-top:32px;padding-bottom:32px;padding-left:28px;padding-right:28px">
            <h1 style="margin-top:0;margin-bottom:8px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;line-height:1.25;color:${c.text};letter-spacing:-0.01em">${headline}</h1>
            ${subheaderBlock}
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${c.text}">${bodyHtml}</div>
            ${ctaBlock}
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;padding-left:8px;padding-right:8px">
            ${footerNoteBlock}
            <p style="margin-top:0;margin-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.55;color:${c.textMuted}">${DISCLAIMER}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</div>`;
}

/** Auth template catalog — subjects + bodies for Supabase Management API / dashboard. */
export const AUTH_EMAIL_TEMPLATES = {
  confirmation: {
    subject: "Confirm your Guided Health AI account",
    content: () =>
      renderAuthEmailBody({
        headline: "Confirm your email",
        subheader: "One quick step to finish creating your account.",
        bodyHtml: `<p style="margin-top:0;margin-bottom:12px">Thanks for signing up for Guided Health AI. Confirm your email so we can keep your health profile secure and send you important updates.</p>
<p style="margin-top:0;margin-bottom:0">This link expires shortly and can only be used once.</p>`,
        ctaLabel: "Confirm email",
        ctaUrl: "{{ .ConfirmationURL }}",
      }),
  },
  invite: {
    subject: "You're invited to Guided Health AI",
    content: () =>
      renderAuthEmailBody({
        headline: "You're invited",
        subheader: "Create your Guided Health AI account to get started.",
        bodyHtml: `<p style="margin-top:0;margin-bottom:0">Someone invited you to join Guided Health AI — a proactive health companion for your labs, screenings, and care plan.</p>`,
        ctaLabel: "Accept invitation",
        ctaUrl: "{{ .ConfirmationURL }}",
      }),
  },
  magic_link: {
    subject: "Your Guided Health AI sign-in link",
    content: () =>
      renderAuthEmailBody({
        headline: "Sign in to Guided Health AI",
        subheader: "Use the secure link below. No password needed.",
        bodyHtml: `<p style="margin-top:0;margin-bottom:0">This link expires shortly and can only be used once. If you did not request it, you can ignore this email.</p>`,
        ctaLabel: "Sign in",
        ctaUrl: "{{ .ConfirmationURL }}",
      }),
  },
  recovery: {
    subject: "Reset your Guided Health AI password",
    content: () =>
      renderAuthEmailBody({
        headline: "Reset your password",
        subheader: "Choose a new password for your account.",
        bodyHtml: `<p style="margin-top:0;margin-bottom:0">We received a request to reset the password for {{ .Email }}. If you did not ask for this, you can safely ignore this email.</p>`,
        ctaLabel: "Reset password",
        ctaUrl: "{{ .ConfirmationURL }}",
      }),
  },
  email_change: {
    subject: "Confirm your new email address",
    content: () =>
      renderAuthEmailBody({
        headline: "Confirm your new email",
        subheader: "Verify {{ .NewEmail }} as your updated address.",
        bodyHtml: `<p style="margin-top:0;margin-bottom:0">Follow the button below to finish changing the email on your Guided Health AI account. If you did not request this, ignore this message.</p>`,
        ctaLabel: "Confirm new email",
        ctaUrl: "{{ .ConfirmationURL }}",
      }),
  },
  reauthentication: {
    subject: "{{ .Token }} is your Guided Health AI verification code",
    content: () =>
      renderAuthEmailBody({
        headline: "Your verification code",
        subheader: "Enter this code to confirm it's you.",
        bodyHtml: `<p style="margin-top:0;margin-bottom:16px">Use the code below. It expires shortly.</p>
<p style="margin-top:0;margin-bottom:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.12em;line-height:1.2;color:${EMAIL_COLORS.text};text-align:center">{{ .Token }}</p>`,
        ctaLabel: null,
      }),
  },
};

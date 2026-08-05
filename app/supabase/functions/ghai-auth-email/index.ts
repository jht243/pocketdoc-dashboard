/**
 * Auth Send Email Hook → Resend.
 *
 * Supabase Auth still creates users/tokens; this function sends the branded
 * email through Resend instead of Supabase's built-in mailer.
 *
 * verify_jwt must be false — Auth signs requests with SEND_EMAIL_HOOK_SECRET.
 */
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM =
  Deno.env.get("GHAI_EMAIL_FROM") ??
  "Guided Health AI <noreply@intake.layer3labs.io>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const hookSecret = hookSecretRaw.replace("v1,whsec_", "");

const COLORS = {
  bg: "#f6f7f9",
  card: "#ffffff",
  accent: "#0284c7",
  text: "#0f172a",
  textSecondary: "#55657a",
  textMuted: "#8494a7",
  border: "#e5eaf0",
  onAccent: "#ffffff",
};

const DISCLAIMER =
  "Guided Health AI is a wellness companion, not a medical device. It does not diagnose, treat, or prescribe, and it never replaces your clinician.";

function renderEmail({
  headline,
  subheader,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  otp,
}: {
  headline: string;
  subheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  otp?: string;
}) {
  const c = COLORS;
  const otpBlock = otp
    ? `<p style="margin-top:16px;margin-bottom:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.12em;line-height:1.2;color:${c.text};text-align:center">${otp}</p>`
    : "";
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;margin-bottom:8px">
  <tr><td align="left">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td bgcolor="${c.accent}" style="background-color:${c.accent};border-radius:12px;text-align:center">
        <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding-top:14px;padding-bottom:14px;padding-left:28px;padding-right:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:${c.onAccent};text-decoration:none;border-radius:12px">${ctaLabel}</a>
      </td>
    </tr></table>
  </td></tr></table>
  <p style="margin-top:16px;margin-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${c.textMuted}">If the button does not work, copy and paste this link into your browser:<br /><a href="${ctaUrl}" style="color:${c.accent};word-break:break-all;text-decoration:underline">${ctaUrl}</a></p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:${c.bg}">
  <div lang="en" dir="ltr">
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
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:600;line-height:1.2;color:${c.text}">Guided Health AI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="${c.card}" style="background-color:${c.card};border:1px solid ${c.border};border-radius:16px;padding-top:32px;padding-bottom:32px;padding-left:28px;padding-right:28px">
              <h1 style="margin-top:0;margin-bottom:8px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;line-height:1.25;color:${c.text}">${headline}</h1>
              <p style="margin-top:0;margin-bottom:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${c.textSecondary}">${subheader}</p>
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${c.text}">${bodyHtml}${otpBlock}</div>
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;padding-left:8px;padding-right:8px">
              <p style="margin-top:0;margin-bottom:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.55;color:${c.textMuted}">${DISCLAIMER}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  </div>
</body>
</html>`;
}

function buildConfirmUrl(
  tokenHash: string,
  emailActionType: string,
  redirectTo: string,
) {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const params = new URLSearchParams({
    token: tokenHash,
    type: emailActionType,
    redirect_to: redirectTo || base,
  });
  return `${base}/auth/v1/verify?${params.toString()}`;
}

function buildMessage(userEmail: string, emailData: {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
}) {
  const confirmUrl = buildConfirmUrl(
    emailData.token_hash,
    emailData.email_action_type,
    emailData.redirect_to,
  );
  const type = emailData.email_action_type;

  switch (type) {
    case "signup":
    case "email":
      return {
        subject: "Confirm your Guided Health AI account",
        html: renderEmail({
          headline: "Confirm your email",
          subheader: "One quick step to finish creating your account.",
          bodyHtml:
            `<p style="margin-top:0;margin-bottom:12px">Thanks for signing up for Guided Health AI. Confirm your email so we can keep your health profile secure and send you important updates.</p>
<p style="margin-top:0;margin-bottom:0">This link expires shortly and can only be used once.</p>`,
          ctaLabel: "Confirm email",
          ctaUrl: confirmUrl,
        }),
        text: `Confirm your Guided Health AI email: ${confirmUrl}`,
      };
    case "invite":
      return {
        subject: "You're invited to Guided Health AI",
        html: renderEmail({
          headline: "You're invited",
          subheader: "Create your Guided Health AI account to get started.",
          bodyHtml:
            `<p style="margin-top:0;margin-bottom:0">Someone invited you to join Guided Health AI — a proactive health companion for your labs, screenings, and care plan.</p>`,
          ctaLabel: "Accept invitation",
          ctaUrl: confirmUrl,
        }),
        text: `Accept your Guided Health AI invitation: ${confirmUrl}`,
      };
    case "magiclink":
      return {
        subject: "Your Guided Health AI sign-in link",
        html: renderEmail({
          headline: "Sign in to Guided Health AI",
          subheader: "Use the secure link below. No password needed.",
          bodyHtml:
            `<p style="margin-top:0;margin-bottom:0">This link expires shortly and can only be used once. If you did not request it, you can ignore this email.</p>`,
          ctaLabel: "Sign in",
          ctaUrl: confirmUrl,
        }),
        text: `Sign in to Guided Health AI: ${confirmUrl}`,
      };
    case "recovery":
      return {
        subject: "Reset your Guided Health AI password",
        html: renderEmail({
          headline: "Reset your password",
          subheader: "Choose a new password for your account.",
          bodyHtml:
            `<p style="margin-top:0;margin-bottom:0">We received a request to reset the password for ${userEmail}. If you did not ask for this, you can safely ignore this email.</p>`,
          ctaLabel: "Reset password",
          ctaUrl: confirmUrl,
        }),
        text: `Reset your Guided Health AI password: ${confirmUrl}`,
      };
    case "email_change":
      return {
        subject: "Confirm your new email address",
        html: renderEmail({
          headline: "Confirm your new email",
          subheader: "Verify your updated address to finish the change.",
          bodyHtml:
            `<p style="margin-top:0;margin-bottom:0">Follow the button below to finish changing the email on your Guided Health AI account. If you did not request this, ignore this message.</p>`,
          ctaLabel: "Confirm new email",
          ctaUrl: confirmUrl,
        }),
        text: `Confirm your new Guided Health AI email: ${confirmUrl}`,
      };
    case "reauthentication":
      return {
        subject: `${emailData.token} is your Guided Health AI verification code`,
        html: renderEmail({
          headline: "Your verification code",
          subheader: "Enter this code to confirm it's you.",
          bodyHtml:
            `<p style="margin-top:0;margin-bottom:16px">Use the code below. It expires shortly.</p>`,
          otp: emailData.token,
        }),
        text: `Your Guided Health AI verification code is ${emailData.token}`,
      };
    default:
      return {
        subject: "Guided Health AI",
        html: renderEmail({
          headline: "Continue with Guided Health AI",
          subheader: "Use the secure link below to continue.",
          bodyHtml: `<p style="margin-top:0;margin-bottom:0">This link expires shortly and can only be used once.</p>`,
          ctaLabel: "Continue",
          ctaUrl: confirmUrl,
        }),
        text: `Continue with Guided Health AI: ${confirmUrl}`,
      };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 405 });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: { message: "RESEND_API_KEY missing" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!hookSecret) {
    return new Response(JSON.stringify({ error: { message: "SEND_EMAIL_HOOK_SECRET missing" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
      };
    };

    const message = buildMessage(user.email, email_data);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [user.email],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("resend error", res.status, body);
      return new Response(
        JSON.stringify({
          error: {
            http_code: res.status,
            message: body?.message || "Resend send failed",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    console.error("auth email hook failed", error);
    const message = error instanceof Error ? error.message : "Hook verification failed";
    return new Response(
      JSON.stringify({ error: { http_code: 401, message } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

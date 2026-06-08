import { clean, publicApiBaseUrl } from "./_google.js";

function sender() {
  return process.env.MAIL_FROM || "Boudoir Collective Berlin <noreply@boudoircollectiveberlin.de>";
}

function replyTo() {
  return clean(process.env.MAIL_REPLY_TO, 200);
}

function mailProvider() {
  const configured = clean(process.env.MAIL_PROVIDER, 40).toLowerCase();
  if (configured) return configured;
  if (process.env.M365_CLIENT_ID && process.env.M365_CLIENT_SECRET && process.env.M365_REFRESH_TOKEN) return "m365";
  if (process.env.RESEND_API_KEY) return "resend";
  return "";
}

export function mailConfigured() {
  return Boolean(mailProvider());
}

function m365AuthMode() {
  const configured = clean(process.env.M365_AUTH_MODE, 40).toLowerCase();
  if (configured) return configured;
  if (process.env.M365_REFRESH_TOKEN) return "delegated";
  return "application";
}

function senderParts() {
  const value = sender();
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return { name: "", email: clean(value, 200).toLowerCase() };
  }

  return {
    name: clean(match[1].replaceAll('"', ""), 120),
    email: clean(match[2], 200).toLowerCase()
  };
}

function htmlBody(text, html) {
  if (html) return html;
  return `<pre>${String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre>`;
}

async function sendViaResend({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = clean(to, 200).toLowerCase();
  if (!apiKey || !recipient) {
    return { ok: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: sender(),
      to: recipient,
      subject,
      text,
      html,
      reply_to: replyTo() || undefined
    })
  });

  if (!response.ok) {
    const error = new Error("mail_failed");
    error.statusCode = 502;
    error.response = await response.text().catch(() => "");
    throw error;
  }

  return { ok: true, provider: "resend" };
}

async function m365AccessToken() {
  const tenantId = clean(process.env.M365_TENANT_ID, 120) || "common";
  const clientId = clean(process.env.M365_CLIENT_ID, 200);
  const clientSecret = clean(process.env.M365_CLIENT_SECRET, 400);
  const refreshToken = clean(process.env.M365_REFRESH_TOKEN, 4000);

  if (!clientId || !clientSecret) {
    return "";
  }
  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  if (m365AuthMode() === "application") {
    body.set("grant_type", "client_credentials");
    body.set("scope", "https://graph.microsoft.com/.default");
  } else {
    if (!refreshToken) return "";
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refreshToken);
    body.set("scope", "openid offline_access https://graph.microsoft.com/Mail.Send");
  }

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const error = new Error("m365_token_failed");
    error.statusCode = 502;
    error.response = await response.text().catch(() => "");
    throw error;
  }

  const payload = await response.json();
  return clean(payload.access_token, 8000);
}

async function sendViaM365({ to, subject, text, html }) {
  const recipient = clean(to, 200).toLowerCase();
  const accessToken = await m365AccessToken();
  const senderAddress = String(process.env.M365_SENDER_EMAIL || "").trim().toLowerCase();
  if (!senderAddress) {
    return { ok: false, provider: "m365", error: "Missing M365_SENDER_EMAIL" };
  }
  if (!recipient || !accessToken) {
    return { ok: false, provider: "m365", skipped: true };
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderAddress)}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: htmlBody(text, html)
        },
        toRecipients: [{
          emailAddress: {
            address: recipient
          }
        }],
        replyTo: replyTo() ? [{
          emailAddress: {
            address: replyTo()
          }
        }] : undefined
      },
      saveToSentItems: true
    })
  });

  const errorBody = await response.text().catch(() => "");
  console.log("m365_send_result", {
    provider: "m365",
    senderAddress,
    recipient,
    status: response.status,
    statusText: response.statusText,
    errorBody: response.ok ? "" : errorBody
  });

  if (response.status !== 202) {
    return {
      ok: false,
      provider: "m365",
      status: response.status,
      statusText: response.statusText,
      errorBody
    };
  }

  return { ok: true, provider: "m365", status: response.status };
}

export async function sendMail({ to, subject, text, html }) {
  const provider = mailProvider();
  if (provider === "m365") {
    return sendViaM365({ to, subject, text, html });
  }
  if (provider === "resend") {
    return sendViaResend({ to, subject, text, html });
  }
  return { ok: false, skipped: true };
}

export function actionUrl(req, action, token) {
  const base = publicApiBaseUrl(req);
  return `${base}/api/registration-action?action=${encodeURIComponent(action)}&token=${encodeURIComponent(token)}`;
}

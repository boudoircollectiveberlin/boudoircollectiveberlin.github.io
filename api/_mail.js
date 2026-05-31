import { clean, publicBaseUrl } from "./_google.js";

function sender() {
  return process.env.MAIL_FROM || "Boudoir Collective Berlin <noreply@boudoircollectiveberlin.de>";
}

function replyTo() {
  return clean(process.env.MAIL_REPLY_TO, 200);
}

export async function sendMail({ to, subject, text, html }) {
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
    throw error;
  }

  return { ok: true };
}

export function actionUrl(req, action, token) {
  const base = publicBaseUrl(req);
  return `${base}/api/registration-action?action=${encodeURIComponent(action)}&token=${encodeURIComponent(token)}`;
}

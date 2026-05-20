import crypto from "node:crypto";
import { applyCors, getSheetsClient, readBody, verifyFirebaseIdToken } from "./_google.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_RE = /^@?[a-zA-Z0-9._]{1,30}$/;
const ALLOWED_EVENT_FUNCTIONS = new Set(["model", "photographer", "mua", "team", "other"]);

function clean(value, maxLength = 600) {
  return String(value || "").trim().slice(0, maxLength);
}

function validate(payload) {
  const errors = {};
  const eventFunction = clean(payload.eventFunction, 80);
  const eventId = clean(payload.eventId, 120);
  const name = clean(payload.name, 120);
  const email = clean(payload.email, 180).toLowerCase();
  const instagram = clean(payload.instagram, 80);
  const partnerName = clean(payload.partnerName, 120);
  const partnerEmail = clean(payload.partnerEmail, 180).toLowerCase();
  const partnerFunction = clean(payload.partnerFunction, 80);
  const consent = payload.consent === true;
  const privacy = payload.privacy === true;

  if (!eventId) errors.eventId = "event_required";
  if (!ALLOWED_EVENT_FUNCTIONS.has(eventFunction)) errors.eventFunction = "event_function_required";
  if (!name) errors.name = "name_required";
  if (!EMAIL_RE.test(email)) errors.email = "email_invalid";
  if (instagram && !INSTAGRAM_RE.test(instagram)) errors.instagram = "instagram_invalid";
  if ((partnerName || partnerFunction || clean(payload.partnerInstagram, 80)) && !partnerEmail) errors.partnerEmail = "partner_email_required";
  if (partnerEmail && !EMAIL_RE.test(partnerEmail)) errors.partnerEmail = "partner_email_invalid";
  if (partnerFunction && !ALLOWED_EVENT_FUNCTIONS.has(partnerFunction)) errors.partnerFunction = "partner_function_invalid";
  if ((partnerName || partnerEmail || partnerFunction) && !payload.partnerNotice) errors.partnerNotice = "partner_notice_required";
  if (!consent) errors.consent = "codex_required";
  if (!privacy) errors.privacy = "privacy_required";
  if (payload.website && clean(payload.website)) errors.website = "bot_rejected";

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: {
      eventId,
      eventFunction,
      name,
      email,
      instagram: instagram ? (instagram.startsWith("@") ? instagram : `@${instagram}`) : "",
      partnerName,
      partnerEmail,
      partnerInstagram: clean(payload.partnerInstagram, 80),
      partnerFunction,
      partnerConsentStatus: partnerEmail ? "pending" : "",
      pairing: clean(payload.pairing, 120),
      portfolio: clean(payload.portfolio, 300),
      notes: clean(payload.notes, 1000),
      whatsappIntent: payload.whatsappIntent === true ? "yes" : "no"
    }
  };
}

function registrationId(data) {
  return crypto
    .createHash("sha256")
    .update(`${data.eventId}:${data.email}:${Date.now()}:${crypto.randomUUID()}`)
    .digest("hex")
    .slice(0, 16);
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const body = readBody(req);
    const identity = await verifyFirebaseIdToken(body.idToken);
    const result = validate(body);

    if (!result.ok) {
      res.status(400).json({ ok: false, error: "validation_failed", fields: result.errors });
      return;
    }

    if (!process.env.REGISTRATION_SHEET_ID) {
      throw new Error("Missing REGISTRATION_SHEET_ID");
    }

    const id = registrationId(result.data);
    const timestamp = new Date().toISOString();
    const sheets = getSheetsClient();
    const range = process.env.REGISTRATION_SHEET_RANGE || "Registrations!A:Z";

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.REGISTRATION_SHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          timestamp,
          id,
          result.data.eventId,
          identity.sub,
          identity.provider,
          result.data.eventFunction,
          result.data.name,
          identity.email,
          result.data.instagram,
          result.data.partnerName,
          result.data.partnerEmail,
          result.data.partnerInstagram,
          result.data.partnerFunction,
          result.data.partnerConsentStatus,
          result.data.pairing,
          result.data.portfolio,
          result.data.whatsappIntent,
          result.data.notes
        ]]
      }
    });

    res.status(200).json({ ok: true, registrationId: id });
  } catch (error) {
    console.error("registration_failed", { message: error.message });
    res.status(error.statusCode || 500).json({ ok: false, error: "registration_failed" });
  }
}

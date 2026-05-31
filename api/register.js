import crypto from "node:crypto";
import { actionUrl, mailConfigured, sendMail } from "./_mail.js";
import { applyCors, clean, getSheetsClient, readBody, verifyFirebaseIdToken } from "./_google.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_RE = /^@?[a-zA-Z0-9._]{1,30}$/;
const ALLOWED_EVENT_FUNCTIONS = new Set(["model", "photographer", "mua", "team", "other"]);
const MAX_INVITEES = 6;
const GRABOWSEE_EVENT_ID = "heilstaette-grabowsee-2026-07-04";

function normalizeInstagram(value) {
  const instagram = clean(value, 80);
  return instagram ? (instagram.startsWith("@") ? instagram : `@${instagram}`) : "";
}

function invitedParticipants(payload) {
  const raw = Array.isArray(payload.invitedParticipants) ? payload.invitedParticipants : [];
  const legacy = !raw.length && (payload.partnerName || payload.partnerEmail || payload.partnerInstagram || payload.partnerFunction)
    ? [{
        name: payload.partnerName,
        email: payload.partnerEmail,
        instagram: payload.partnerInstagram,
        eventFunction: payload.partnerFunction
      }]
    : [];

  return [...raw, ...legacy]
    .slice(0, MAX_INVITEES)
    .map((participant) => ({
      name: clean(participant?.name, 120),
      email: clean(participant?.email, 180).toLowerCase(),
      instagram: normalizeInstagram(participant?.instagram),
      eventFunction: clean(participant?.eventFunction || participant?.function, 80)
    }))
    .filter((participant) => participant.name || participant.email || participant.instagram || participant.eventFunction);
}

function validate(payload) {
  const errors = {};
  const eventFunction = clean(payload.eventFunction, 80);
  const eventId = clean(payload.eventId, 120);
  const name = clean(payload.name, 120);
  const email = clean(payload.email, 180).toLowerCase();
  const instagram = normalizeInstagram(payload.instagram);
  const invitees = invitedParticipants(payload);
  const consent = payload.consent === true;
  const privacy = payload.privacy === true;

  if (!eventId) errors.eventId = "event_required";
  if (!ALLOWED_EVENT_FUNCTIONS.has(eventFunction)) errors.eventFunction = "event_function_required";
  if (!name) errors.name = "name_required";
  if (!EMAIL_RE.test(email)) errors.email = "email_invalid";
  if (instagram && !INSTAGRAM_RE.test(instagram)) errors.instagram = "instagram_invalid";
  const inviteeEmails = new Set();
  invitees.forEach((participant, index) => {
    if (!participant.email) errors[`invitee${index}Email`] = "invitee_email_required";
    if (participant.email && !EMAIL_RE.test(participant.email)) errors[`invitee${index}Email`] = "invitee_email_invalid";
    if (participant.email === email) errors[`invitee${index}Email`] = "invitee_email_must_differ";
    if (participant.email && inviteeEmails.has(participant.email)) errors[`invitee${index}Email`] = "invitee_email_duplicate";
    inviteeEmails.add(participant.email);
    if (participant.instagram && !INSTAGRAM_RE.test(participant.instagram)) errors[`invitee${index}Instagram`] = "invitee_instagram_invalid";
    if (participant.eventFunction && !ALLOWED_EVENT_FUNCTIONS.has(participant.eventFunction)) errors[`invitee${index}Function`] = "invitee_function_invalid";
    if (!participant.eventFunction) errors[`invitee${index}Function`] = "invitee_function_required";
  });
  if (invitees.length && !payload.partnerNotice) errors.partnerNotice = "partner_notice_required";
  if (!consent) errors.consent = "codex_required";
  if (!privacy) errors.privacy = "privacy_required";
  if (payload.website && clean(payload.website)) errors.website = "bot_rejected";

  if (eventId === GRABOWSEE_EVENT_ID) {
    const participantRoles = [eventFunction, ...invitees.map((participant) => participant.eventFunction)].filter(Boolean);
    const photographerCount = participantRoles.filter((role) => role === "photographer").length;
    const modelCount = participantRoles.filter((role) => role === "model").length;

    if (!["model", "photographer"].includes(eventFunction)) errors.eventFunction = "grabowsee_role_invalid";
    if (invitees.some((participant) => !["model", "photographer"].includes(participant.eventFunction))) {
      errors.invitees = "grabowsee_invite_role_invalid";
    }
    if (photographerCount !== 1) errors.roleMix = "grabowsee_one_photographer_required";
    if (modelCount < 1) errors.roleMix = "grabowsee_model_required";
  }

  const primaryInvitee = invitees[0] || {};
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: {
      eventId,
      eventFunction,
      name,
      email,
      instagram,
      invitees,
      partnerName: primaryInvitee.name || "",
      partnerEmail: primaryInvitee.email || "",
      partnerInstagram: primaryInvitee.instagram || "",
      partnerFunction: primaryInvitee.eventFunction || "",
      partnerConsentStatus: invitees.length ? "pending" : "",
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

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function eventLabel(eventId) {
  if (eventId === "heilstaette-grabowsee-2026-07-04") return "Heilstätte Grabowsee";
  return eventId;
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
    const undoToken = randomToken();
    const inviteTokens = result.data.invitees.map((participant, index) => ({
      email: participant.email,
      token: randomToken(),
      hash: "",
      index
    }));
    inviteTokens.forEach((item) => {
      item.hash = hashToken(item.token);
    });
    const sheets = getSheetsClient();
    const range = process.env.REGISTRATION_SHEET_RANGE || "Registrations!A:Z";
    const inviteesForSheet = result.data.invitees.map((participant, index) => ({
      ...participant,
      status: "pending",
      invitedAt: timestamp,
      confirmedAt: "",
      index
    }));
    const inviteHashesForSheet = inviteTokens.map(({ email, hash, index }) => ({ email, hash, index }));
    const inviteSummary = inviteesForSheet.map((participant) => `${participant.email}:${participant.status}`).join(", ");

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
          result.data.notes,
          result.data.invitees.length ? "pending_invites" : "pending_review",
          hashToken(undoToken),
          inviteTokens[0]?.hash || "",
          "",
          timestamp,
          JSON.stringify(inviteesForSheet),
          JSON.stringify(inviteHashesForSheet),
          inviteSummary
        ]]
      }
    });

    const undoUrl = actionUrl(req, "undo-registration", undoToken);
    await sendMail({
      to: identity.email,
      subject: `Boudoir Collective Berlin: registration received for ${eventLabel(result.data.eventId)}`,
      text: [
        `Hi ${result.data.name},`,
        "",
        `we received your application for ${eventLabel(result.data.eventId)}.`,
        result.data.invitees.length
          ? `Your invited participants still need to confirm before the application is complete: ${result.data.invitees.map((participant) => participant.email).join(", ")}.`
          : "The organizer team will review the role mix and come back to you.",
        "",
        `If this was not you, undo the registration here: ${undoUrl}`,
        "",
        "Boudoir Collective Berlin"
      ].join("\n"),
      html: `<p>Hi ${result.data.name},</p><p>We received your application for <strong>${eventLabel(result.data.eventId)}</strong>.</p><p>${result.data.invitees.length ? `Your invited participants still need to confirm before the application is complete: ${result.data.invitees.map((participant) => participant.email).join(", ")}.` : "The organizer team will review the role mix and come back to you."}</p><p><a href="${undoUrl}">This was not me - undo this registration</a></p><p>Boudoir Collective Berlin</p>`
    });

    for (const invitation of inviteTokens) {
      const participant = result.data.invitees[invitation.index];
      const confirmUrl = actionUrl(req, "confirm-partner", invitation.token);
      const rejectUrl = actionUrl(req, "reject-partner", invitation.token);
      await sendMail({
        to: participant.email,
        subject: `Boudoir Collective Berlin: invitation for ${eventLabel(result.data.eventId)}`,
        text: [
          `Hi ${participant.name || ""},`,
          "",
          `${result.data.name} suggested you as a partner for ${eventLabel(result.data.eventId)}.`,
          "Please create/sign in to your community profile as well. The application is only valid once you confirm.",
          "",
          `Confirm partner application: ${confirmUrl}`,
          `Reject this suggestion: ${rejectUrl}`,
          "",
          "Boudoir Collective Berlin"
        ].join("\n"),
        html: `<p>Hi ${participant.name || ""},</p><p>${result.data.name} suggested you as a partner for <strong>${eventLabel(result.data.eventId)}</strong>.</p><p>Please create/sign in to your community profile as well. The application is only valid once you confirm.</p><p><a href="${confirmUrl}">Confirm partner application</a></p><p><a href="${rejectUrl}">Reject this suggestion</a></p><p>Boudoir Collective Berlin</p>`
      });
    }

    res.status(200).json({ ok: true, registrationId: id, mailConfigured: mailConfigured() });
  } catch (error) {
    console.error("registration_failed", { message: error.message });
    res.status(error.statusCode || 500).json({ ok: false, error: "registration_failed" });
  }
}

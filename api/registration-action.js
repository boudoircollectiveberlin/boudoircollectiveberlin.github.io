import crypto from "node:crypto";
import { applyCors, clean, getSheetsClient, publicBaseUrl } from "./_google.js";

function hashToken(token) {
  return crypto.createHash("sha256").update(clean(token, 200)).digest("hex");
}

function columnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const mod = (value - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    value = Math.floor((value - mod) / 26);
  }
  return name;
}

async function updateCell(sheets, rowNumber, columnIndex, value) {
  const sheetName = (process.env.REGISTRATION_SHEET_RANGE || "Registrations!A:Z").split("!")[0];
  const column = columnName(columnIndex);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.REGISTRATION_SHEET_ID,
    range: `${sheetName}!${column}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] }
  });
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function inviteSummary(invitees) {
  return invitees.map((participant) => `${clean(participant.email, 180)}:${clean(participant.status, 80)}`).join(", ");
}

function eventDetailPath(eventId) {
  if (eventId === "heilstaette-grabowsee-2026-07-04") return "event-grabowsee.html";
  if (eventId === "schloss-wrodow-2026-08-08") return "event-wrodow.html";
  return "account.html";
}

function frontendBaseUrl(req) {
  const configured = publicBaseUrl(req);
  if (configured) return configured;
  const host = clean(req?.headers?.["x-forwarded-host"] || req?.headers?.host, 240);
  const proto = clean(req?.headers?.["x-forwarded-proto"], 20) || "https";
  if (!host) return "";
  const siteHost = host === "boudoircollectiveberlin.de"
    ? "www.boudoircollectiveberlin.de"
    : (host.startsWith("api.") ? `www.${host.slice(4)}` : host);
  return `${proto}://${siteHost}`.replace(/\/$/, "");
}

function redirectToEventPage(req, res, eventId, params = {}) {
  const base = frontendBaseUrl(req);
  const target = eventDetailPath(eventId);
  const search = new URLSearchParams(params);
  const location = `${base}/${target}?${search.toString()}#application`;
  res.writeHead(303, { Location: location });
  res.end();
}

function registrationStatus(invitees) {
  if (!invitees.length) return "pending_review";
  if (invitees.some((participant) => participant.status === "rejected")) return "invite_rejected";
  if (invitees.some((participant) => participant.status === "pending")) return "pending_invites";
  if (invitees.some((participant) => participant.status === "confirmed_profile_required")) return "invite_profiles_required";
  return "pending_review";
}

async function hasMemberProfile(sheets, email) {
  const memberResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.REGISTRATION_SHEET_ID,
    range: process.env.MEMBER_SHEET_RANGE || "Members!A:Z"
  }).catch(() => ({ data: { values: [] } }));
  return (memberResponse.data.values || []).some((row) => clean(row?.[2], 180).toLowerCase() === email);
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    if (!process.env.REGISTRATION_SHEET_ID) throw new Error("Missing REGISTRATION_SHEET_ID");

    const action = clean(req.query.action, 60);
    const token = clean(req.query.token, 200);
    const hashed = hashToken(token);
    const sheets = getSheetsClient();
    const range = process.env.REGISTRATION_SHEET_RANGE || "Registrations!A:Z";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.REGISTRATION_SHEET_ID,
      range
    });

    const rows = response.data.values || [];
    const hashColumn = action === "undo-registration" ? 19 : 20;
    const rowIndex = rows.findIndex((row) => {
      if (clean(row?.[hashColumn], 200) === hashed) return true;
      if (action === "undo-registration") return false;
      return parseJson(row?.[24], []).some((invite) => clean(invite?.hash, 200) === hashed);
    });
    if (rowIndex < 0) {
      res.status(404).send("This action link is invalid or expired.");
      return;
    }

    const rowNumber = rowIndex + 1;
    const eventId = clean(rows[rowIndex]?.[2], 120);
    if (action === "undo-registration") {
      await updateCell(sheets, rowNumber, 18, "canceled_by_link");
      await updateCell(sheets, rowNumber, 22, new Date().toISOString());
      redirectToEventPage(req, res, eventId, {
        registrationAction: "undo-registration",
        registrationResult: "canceled"
      });
      return;
    }

    if (action === "confirm-partner") {
      const invitees = parseJson(rows[rowIndex]?.[23], []);
      const hashes = parseJson(rows[rowIndex]?.[24], []);
      const inviteHash = hashes.find((invite) => clean(invite?.hash, 200) === hashed);
      const inviteIndex = Number.isInteger(inviteHash?.index) ? inviteHash.index : 0;
      const partnerEmail = clean(invitees[inviteIndex]?.email || rows[rowIndex]?.[10], 180).toLowerCase();
      const hasPartnerProfile = await hasMemberProfile(sheets, partnerEmail);

      if (invitees.length && invitees[inviteIndex]) {
        invitees[inviteIndex].status = hasPartnerProfile ? "confirmed" : "confirmed_profile_required";
        invitees[inviteIndex].confirmedAt = new Date().toISOString();
        await updateCell(sheets, rowNumber, 23, JSON.stringify(invitees));
        await updateCell(sheets, rowNumber, 25, inviteSummary(invitees));
      }
      await updateCell(sheets, rowNumber, 13, "confirmed");
      await updateCell(sheets, rowNumber, 18, invitees.length ? registrationStatus(invitees) : (hasPartnerProfile ? "pending_review" : "partner_confirmed_profile_required"));
      await updateCell(sheets, rowNumber, 22, new Date().toISOString());
      redirectToEventPage(req, res, eventId, {
        registrationAction: "confirm-partner",
        registrationResult: hasPartnerProfile ? "confirmed" : "profile-required"
      });
      return;
    }

    if (action === "reject-partner") {
      const invitees = parseJson(rows[rowIndex]?.[23], []);
      const hashes = parseJson(rows[rowIndex]?.[24], []);
      const inviteHash = hashes.find((invite) => clean(invite?.hash, 200) === hashed);
      const inviteIndex = Number.isInteger(inviteHash?.index) ? inviteHash.index : 0;
      if (invitees.length && invitees[inviteIndex]) {
        invitees[inviteIndex].status = "rejected";
        invitees[inviteIndex].confirmedAt = new Date().toISOString();
        await updateCell(sheets, rowNumber, 23, JSON.stringify(invitees));
        await updateCell(sheets, rowNumber, 25, inviteSummary(invitees));
      }
      await updateCell(sheets, rowNumber, 13, "rejected");
      await updateCell(sheets, rowNumber, 18, invitees.length ? registrationStatus(invitees) : "partner_rejected");
      await updateCell(sheets, rowNumber, 22, new Date().toISOString());
      redirectToEventPage(req, res, eventId, {
        registrationAction: "reject-partner",
        registrationResult: "rejected"
      });
      return;
    }

    res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    console.error("registration_action_failed", { message: error.message });
    res.status(error.statusCode || 500).json({ ok: false, error: "registration_action_failed" });
  }
}

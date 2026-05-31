import crypto from "node:crypto";
import { applyCors, clean, getSheetsClient, isAdminIdentity, readBearerToken, readBody, verifyFirebaseIdToken } from "./_google.js";

function rangeSheet(range, fallback) {
  return (range || fallback).split("!")[0];
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

async function updateCell(sheets, spreadsheetId, sheetName, rowNumber, columnIndex, value) {
  const column = columnName(columnIndex);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
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

function publicRegistration(row) {
  return {
    id: clean(row[1], 80),
    eventId: clean(row[2], 120),
    role: clean(row[5], 60),
    name: clean(row[6], 120),
    email: clean(row[7], 180),
    partnerName: clean(row[9], 120),
    partnerEmail: clean(row[10], 180),
    partnerStatus: clean(row[13], 60),
    status: clean(row[18], 60) || "pending_review",
    adminStatus: clean(row[21], 60),
    updatedAt: clean(row[22], 80),
    invitees: parseJson(row[23], []).map((participant) => ({
      name: clean(participant?.name, 120),
      email: clean(participant?.email, 180),
      instagram: clean(participant?.instagram, 80),
      role: clean(participant?.eventFunction, 60),
      status: clean(participant?.status, 80)
    }))
  };
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
    const identity = await verifyFirebaseIdToken(req.method === "GET" ? readBearerToken(req) : readBody(req).idToken);
    if (!isAdminIdentity(identity)) {
      res.status(403).json({ ok: false, error: "admin_required" });
      return;
    }

    const sheets = getSheetsClient();
    const spreadsheetId = process.env.REGISTRATION_SHEET_ID;
    if (!spreadsheetId) throw new Error("Missing REGISTRATION_SHEET_ID");

    const registrationRange = process.env.REGISTRATION_SHEET_RANGE || "Registrations!A:Z";
    const memberRange = process.env.MEMBER_SHEET_RANGE || "Members!A:Z";

    if (req.method === "GET") {
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: registrationRange });
      const rows = response.data.values || [];
      res.status(200).json({
        ok: true,
        admin: true,
        registrations: rows.slice(1).map(publicRegistration).filter((item) => item.id).reverse().slice(0, 80)
      });
      return;
    }

    const body = readBody(req);
    const action = clean(body.action, 60);
    const now = new Date().toISOString();

    if (["confirm", "reject", "undo"].includes(action)) {
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: registrationRange });
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row) => clean(row?.[1], 80) === clean(body.registrationId, 80));
      if (rowIndex < 0) {
        res.status(404).json({ ok: false, error: "registration_not_found" });
        return;
      }

      const status = action === "confirm" ? "confirmed" : (action === "reject" ? "rejected" : "pending_review");
      const sheetName = rangeSheet(registrationRange, "Registrations!A:Z");
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 18, status);
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 21, `${status}_by:${identity.email}`);
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 22, now);
      res.status(200).json({ ok: true, status });
      return;
    }

    if (action === "delete-member") {
      const targetEmail = clean(body.email, 180).toLowerCase();
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: memberRange });
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row) => clean(row?.[2], 180).toLowerCase() === targetEmail);
      if (rowIndex < 0) {
        res.status(404).json({ ok: false, error: "member_not_found" });
        return;
      }

      const emailHash = crypto.createHash("sha256").update(targetEmail).digest("hex").slice(0, 16);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${rangeSheet(memberRange, "Members!A:Z")}!A${rowIndex + 1}:R${rowIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[now, "", `deleted:${emailHash}`, "", "", "", "", "", "no", "no", "no", "no", `deleted_by_admin:${identity.email}`, "deleted", "none", "no", "", ""]]
        }
      });
      res.status(200).json({ ok: true, status: "member_deleted" });
      return;
    }

    res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    console.error("admin_failed", { message: error.message });
    res.status(error.statusCode || 500).json({ ok: false, error: "admin_failed" });
  }
}

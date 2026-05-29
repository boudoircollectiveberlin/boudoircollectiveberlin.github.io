import crypto from "node:crypto";
import { applyCors, clean, getSheetsClient } from "./_google.js";

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
    const rowIndex = rows.findIndex((row) => clean(row?.[hashColumn], 200) === hashed);
    if (rowIndex < 0) {
      res.status(404).send("This action link is invalid or expired.");
      return;
    }

    const rowNumber = rowIndex + 1;
    if (action === "undo-registration") {
      await updateCell(sheets, rowNumber, 18, "canceled_by_link");
      await updateCell(sheets, rowNumber, 22, new Date().toISOString());
      res.status(200).send("Registration canceled. If you have questions, contact the organizer team.");
      return;
    }

    if (action === "confirm-partner") {
      const partnerEmail = clean(rows[rowIndex]?.[10], 180).toLowerCase();
      const memberResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.REGISTRATION_SHEET_ID,
        range: process.env.MEMBER_SHEET_RANGE || "Members!A:Z"
      }).catch(() => ({ data: { values: [] } }));
      const hasPartnerProfile = (memberResponse.data.values || []).some((row) => clean(row?.[2], 180).toLowerCase() === partnerEmail);
      await updateCell(sheets, rowNumber, 13, "confirmed");
      await updateCell(sheets, rowNumber, 18, hasPartnerProfile ? "pending_review" : "partner_confirmed_profile_required");
      await updateCell(sheets, rowNumber, 22, new Date().toISOString());
      res.status(200).send("Partner confirmation received. Please also make sure your community profile is registered with the same email; otherwise the application remains incomplete.");
      return;
    }

    if (action === "reject-partner") {
      await updateCell(sheets, rowNumber, 13, "rejected");
      await updateCell(sheets, rowNumber, 18, "partner_rejected");
      await updateCell(sheets, rowNumber, 22, new Date().toISOString());
      res.status(200).send("Partner suggestion rejected. The organizer team will see this in the registration list.");
      return;
    }

    res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    console.error("registration_action_failed", { message: error.message });
    res.status(error.statusCode || 500).json({ ok: false, error: "registration_action_failed" });
  }
}

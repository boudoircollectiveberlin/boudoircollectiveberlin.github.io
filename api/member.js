import { applyCors, clean, getSheetsClient, readBearerToken, readBody, verifyFirebaseIdToken } from "./_google.js";

const ALLOWED_FUNCTIONS = new Set(["model", "photographer", "mua"]);

function normalizeFunctions(value) {
  const entries = Array.isArray(value) ? value : [];
  return entries
    .map((entry) => clean(entry, 40))
    .filter((entry) => ALLOWED_FUNCTIONS.has(entry));
}

function parseBoolean(value) {
  return String(value || "").trim().toLowerCase() === "yes";
}

function rangeSheet(range, fallback) {
  return clean(range, 120).split("!")[0] || clean(fallback, 120).split("!")[0];
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function registrationStatus(invitees) {
  if (!invitees.length) return "pending_review";
  if (invitees.some((participant) => clean(participant?.status, 80) === "rejected")) return "invite_rejected";
  if (invitees.some((participant) => clean(participant?.status, 80) === "pending")) return "pending_invites";
  if (invitees.some((participant) => clean(participant?.status, 80) === "confirmed_profile_required")) return "invite_profiles_required";
  return "pending_review";
}

async function updateCell(sheets, spreadsheetId, sheetName, rowNumber, columnIndex, value) {
  const column = String.fromCharCode(65 + columnIndex);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${column}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] }
  });
}

async function completePendingInviteProfiles(sheets, spreadsheetId, identityEmail) {
  const registrationRange = process.env.REGISTRATION_SHEET_RANGE || "Registrations!A:Z";
  const sheetName = rangeSheet(registrationRange, "Registrations!A:Z");
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: registrationRange }).catch(() => ({ data: { values: [] } }));
  const rows = response.data.values || [];
  const now = new Date().toISOString();
  await Promise.all(rows.slice(1).map(async (row, offset) => {
    const invitees = parseJson(row?.[23], []);
    let changed = false;
    invitees.forEach((invitee) => {
      if (clean(invitee?.email, 180).toLowerCase() === identityEmail && clean(invitee?.status, 80) === "confirmed_profile_required") {
        invitee.status = "confirmed";
        invitee.confirmedAt = invitee.confirmedAt || now;
        changed = true;
      }
    });
    if (!changed) return;
    const rowNumber = offset + 2;
    await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 23, JSON.stringify(invitees));
    await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 25, invitees.map((item) => `${clean(item.email, 180)}:${clean(item.status, 80)}`).join(", "));
    await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 18, registrationStatus(invitees));
    await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 22, now);
  }));
}

function memberFromRow(row) {
  return {
    displayName: clean(row[3], 120),
    provider: clean(row[4], 60),
    functions: normalizeFunctions(String(row[5] || "").split(",")),
    instagram: clean(row[6], 80),
    portfolio: clean(row[7], 300),
    futureUpdates: parseBoolean(row[8]),
    lobbyInfo: parseBoolean(row[9]),
    communityConsent: parseBoolean(row[10]),
    communityPrivacy: parseBoolean(row[11]),
    memberStatus: clean(row[12], 40) || "registered",
    privateProfileVisibility: clean(row[13], 40) || "orga_only",
    communityProfileVisibility: clean(row[14], 40) || "none",
    discoverable: parseBoolean(row[15]),
    discoverableName: clean(row[16], 120),
    discoverableIntro: clean(row[17], 600)
  };
}

async function loadMemberProfile(identity) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.REGISTRATION_SHEET_ID,
    range: process.env.MEMBER_SHEET_RANGE || "Members!A:Z"
  });

  const rows = response.data.values || [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const rowUid = clean(row?.[1], 200);
    const rowEmail = clean(row?.[2], 200).toLowerCase();
    const identityEmail = clean(identity.email, 200).toLowerCase();
    if (rowUid === identity.sub || (!rowUid && identityEmail && rowEmail === identityEmail)) {
      return memberFromRow(row);
    }
  }

  return null;
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    if (!process.env.REGISTRATION_SHEET_ID) {
      throw new Error("Missing REGISTRATION_SHEET_ID");
    }

    if (req.method === "GET") {
      const identity = await verifyFirebaseIdToken(readBearerToken(req));
      const member = await loadMemberProfile(identity);
      res.status(200).json({ ok: true, member });
      return;
    }

    const body = readBody(req);
    const identity = await verifyFirebaseIdToken(body.idToken);
    const displayName = clean(body.displayName || identity.name, 120);
    const functions = normalizeFunctions(body.functions);

    if (!displayName) {
      res.status(400).json({ ok: false, error: "validation_failed", fields: { displayName: "name_required" } });
      return;
    }

    if (!functions.length) {
      res.status(400).json({ ok: false, error: "validation_failed", fields: { functions: "functions_required" } });
      return;
    }

    if (body.communityConsent !== true || body.communityPrivacy !== true) {
      res.status(400).json({
        ok: false,
        error: "validation_failed",
        fields: {
          communityConsent: body.communityConsent === true ? undefined : "codex_required",
          communityPrivacy: body.communityPrivacy === true ? undefined : "privacy_required"
        }
      });
      return;
    }

    const sheets = getSheetsClient();
    const memberRange = process.env.MEMBER_SHEET_RANGE || "Members!A:Z";
    const values = [[
      new Date().toISOString(),
      identity.sub,
      identity.email,
      displayName,
      identity.provider,
      functions.join(","),
      clean(body.instagram, 80),
      clean(body.portfolio, 300),
      body.futureUpdates === true ? "yes" : "no",
      body.lobbyInfo === true ? "yes" : "no",
      body.communityConsent === true ? "yes" : "no",
      body.communityPrivacy === true ? "yes" : "no",
      "registered",
      "orga_only",
      body.discoverable === true ? "confirmed_members" : "none",
      body.discoverable === true ? "yes" : "no",
      clean(body.discoverableName || displayName, 120),
      clean(body.discoverableIntro, 600)
    ]];
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.REGISTRATION_SHEET_ID,
      range: memberRange
    }).catch(() => ({ data: { values: [] } }));
    const rows = existing.data.values || [];
    const identityEmail = clean(identity.email, 200).toLowerCase();
    const rowIndex = rows.findIndex((row, index) => index > 0 && (clean(row?.[1], 200) === identity.sub || clean(row?.[2], 200).toLowerCase() === identityEmail));

    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.REGISTRATION_SHEET_ID,
        range: `${rangeSheet(memberRange, "Members!A:Z")}!A${rowIndex + 1}:R${rowIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values }
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.REGISTRATION_SHEET_ID,
        range: memberRange,
        valueInputOption: "USER_ENTERED",
        requestBody: { values }
      });
    }

    await completePendingInviteProfiles(sheets, process.env.REGISTRATION_SHEET_ID, identityEmail);

    res.status(200).json({ ok: true, memberStatus: "registered" });
  } catch (error) {
    console.error("member_failed", { message: error.message });
    res.status(error.statusCode || 500).json({ ok: false, error: "member_failed", detail: error.message });
  }
}

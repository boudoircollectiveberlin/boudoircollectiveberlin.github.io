import { applyCors, getSheetsClient, readBearerToken, readBody, verifyFirebaseIdToken } from "./_google.js";

function clean(value, maxLength = 600) {
  return String(value || "").trim().slice(0, maxLength);
}

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
    communityProfileVisibility: clean(row[14], 40) || "none"
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
    if (clean(row?.[1], 200) === identity.sub) {
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
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.REGISTRATION_SHEET_ID,
      range: process.env.MEMBER_SHEET_RANGE || "Members!A:Z",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
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
          "none"
        ]]
      }
    });

    res.status(200).json({ ok: true, memberStatus: "registered" });
  } catch (error) {
    console.error("member_failed", { message: error.message });
    res.status(error.statusCode || 500).json({ ok: false, error: "member_failed" });
  }
}

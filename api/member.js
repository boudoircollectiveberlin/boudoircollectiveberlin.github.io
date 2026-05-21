import { applyCors, getSheetsClient, readBody, verifyFirebaseIdToken } from "./_google.js";

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
    if (!process.env.REGISTRATION_SHEET_ID) {
      throw new Error("Missing REGISTRATION_SHEET_ID");
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

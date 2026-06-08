import { applyCors, clean, getSheetsClient, readBearerToken, verifyFirebaseIdToken } from "./_google.js";
import { GRABOWSEE_EVENT_ID } from "./register.js";

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

function rangeSheet(range, fallback) {
  return clean(range, 120).split("!")[0] || clean(fallback, 120).split("!")[0];
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

function parseBoolean(value) {
  return String(value || "").trim().toLowerCase() === "yes";
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function memberFromRow(row) {
  return {
    displayName: clean(row?.[3], 120),
    provider: clean(row?.[4], 60),
    memberStatus: clean(row?.[12], 40) || "registered",
    discoverable: parseBoolean(row?.[15])
  };
}

function isSimulatedRow(row) {
  return clean(row?.[21], 120).startsWith("simulated_by:");
}

function humanEventLabel(eventId) {
  if (eventId === GRABOWSEE_EVENT_ID) return "Heilstätte Grabowsee";
  return eventId;
}

function registrationSummary(row, identityEmail) {
  const email = clean(row?.[7], 180).toLowerCase();
  const invitees = parseJson(row?.[23], []).map((participant) => ({
    email: clean(participant?.email, 180).toLowerCase(),
    role: clean(participant?.eventFunction, 60),
    status: clean(participant?.status, 60) || "pending"
  }));
  const isApplicant = identityEmail === email;
  const inviteeMatch = invitees.find((participant) => participant.email === identityEmail);
  if (!isApplicant && !inviteeMatch) return null;

  return {
    registrationId: clean(row?.[1], 80),
    eventId: clean(row?.[2], 120),
    eventLabel: humanEventLabel(clean(row?.[2], 120)),
    role: isApplicant ? clean(row?.[5], 60) : inviteeMatch?.role || "",
    registrationStatus: clean(row?.[18], 60) || "pending_review",
    adminStatus: clean(row?.[21], 120),
    updatedAt: clean(row?.[22], 80),
    applicant: isApplicant,
    simulated: isSimulatedRow(row),
    invitees: isApplicant ? invitees : [],
    inviteeStatus: isApplicant ? "" : (inviteeMatch?.status || ""),
    canWithdraw: isApplicant,
    canRespondInvite: !isApplicant && Boolean(inviteeMatch)
  };
}

async function loadMemberAndCount(sheets, spreadsheetId, memberRange, identity) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: memberRange });
  const rows = response.data.values || [];
  const latestMembers = new Map();
  const identityEmail = clean(identity.email, 180).toLowerCase();
  let member = null;

  for (let index = rows.length - 1; index >= 1; index -= 1) {
    const row = rows[index];
    const uid = clean(row?.[1], 200);
    const email = clean(row?.[2], 180).toLowerCase();
    const key = uid || email;
    if (!key || latestMembers.has(key)) continue;
    latestMembers.set(key, row);
    if (!member && (uid === identity.sub || (identityEmail && email === identityEmail))) {
      member = memberFromRow(row);
    }
  }

  const registeredCount = Array.from(latestMembers.values()).filter((row) => {
    const email = clean(row?.[2], 180).toLowerCase();
    const memberStatus = clean(row?.[12], 40).toLowerCase();
    return email && !email.startsWith("deleted:") && memberStatus === "registered";
  }).length;

  return {
    member,
    otherRegisteredCount: member ? Math.max(registeredCount - 1, 0) : null
  };
}

async function loadRegistrationSummaries(sheets, spreadsheetId, registrationRange, identityEmail) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: registrationRange });
  const rows = response.data.values || [];
  return rows
    .slice(1)
    .map((row) => registrationSummary(row, identityEmail))
    .filter(Boolean)
    .reverse()
    .slice(0, 20);
}

function registrationStatus(invitees) {
  if (!invitees.length) return "pending_review";
  if (invitees.some((participant) => clean(participant?.status, 80) === "rejected")) return "invite_rejected";
  if (invitees.some((participant) => clean(participant?.status, 80) === "pending")) return "pending_invites";
  if (invitees.some((participant) => clean(participant?.status, 80) === "confirmed_profile_required")) return "invite_profiles_required";
  return "pending_review";
}

async function hasMemberProfile(sheets, spreadsheetId, memberRange, identity) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: memberRange });
  const rows = response.data.values || [];
  const identityEmail = clean(identity.email, 180).toLowerCase();
  for (let index = rows.length - 1; index >= 1; index -= 1) {
    const row = rows[index];
    const uid = clean(row?.[1], 200);
    const email = clean(row?.[2], 180).toLowerCase();
    if (uid === identity.sub || (identityEmail && email === identityEmail)) {
      return clean(row?.[12], 40).toLowerCase() === "registered";
    }
  }
  return false;
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
    if (!process.env.REGISTRATION_SHEET_ID) {
      throw new Error("Missing REGISTRATION_SHEET_ID");
    }

    const identity = await verifyFirebaseIdToken(readBearerToken(req));
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.REGISTRATION_SHEET_ID;
    const memberRange = process.env.MEMBER_SHEET_RANGE || "Members!A:Z";
    const registrationRange = process.env.REGISTRATION_SHEET_RANGE || "Registrations!A:Z";
    const identityEmail = clean(identity.email, 180).toLowerCase();

    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
      const action = clean(body.action, 60);
      const registrationId = clean(body.registrationId, 80);
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: registrationRange });
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row) => clean(row?.[1], 80) === registrationId);
      if (rowIndex < 1) {
        res.status(404).json({ ok: false, error: "registration_not_found" });
        return;
      }

      const row = rows[rowIndex];
      const rowNumber = rowIndex + 1;
      const sheetName = rangeSheet(registrationRange, "Registrations!A:Z");
      const applicantEmail = clean(row?.[7], 180).toLowerCase();
      const invitees = parseJson(row?.[23], []);
      const inviteeIndex = invitees.findIndex((participant) => clean(participant?.email, 180).toLowerCase() === identityEmail);
      const now = new Date().toISOString();

      if (action === "withdraw-registration") {
        if (applicantEmail !== identityEmail) {
          res.status(403).json({ ok: false, error: "not_registration_owner" });
          return;
        }
        await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 18, "canceled_by_user");
        await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 21, `canceled_by_user:${identityEmail}`);
        await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 22, now);
        res.status(200).json({ ok: true, status: "canceled_by_user" });
        return;
      }

      if (action === "confirm-invite" || action === "reject-invite") {
        if (inviteeIndex < 0) {
          res.status(403).json({ ok: false, error: "invite_not_found_for_user" });
          return;
        }
        if (action === "reject-invite") {
          invitees[inviteeIndex].status = "rejected";
          invitees[inviteeIndex].confirmedAt = now;
        } else {
          const memberExists = await hasMemberProfile(sheets, spreadsheetId, memberRange, identity);
          invitees[inviteeIndex].status = memberExists ? "confirmed" : "confirmed_profile_required";
          invitees[inviteeIndex].confirmedAt = now;
        }
        await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 23, JSON.stringify(invitees));
        await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 25, invitees.map((participant) => `${clean(participant.email, 180)}:${clean(participant.status, 80)}`).join(", "));
        await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 13, action === "reject-invite" ? "rejected" : "confirmed");
        await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 18, registrationStatus(invitees));
        await updateCell(sheets, spreadsheetId, sheetName, rowNumber, 22, now);
        res.status(200).json({ ok: true, status: clean(invitees[inviteeIndex].status, 80) });
        return;
      }

      res.status(400).json({ ok: false, error: "unknown_action" });
      return;
    }

    const { member, otherRegisteredCount } = await loadMemberAndCount(sheets, spreadsheetId, memberRange, identity);
    const registrations = await loadRegistrationSummaries(sheets, spreadsheetId, registrationRange, identityEmail);

    res.status(200).json({
      ok: true,
      member,
      otherRegisteredCount,
      registrations
    });
  } catch (error) {
    console.error("summary_failed", { message: error.message });
    res.status(error.statusCode || 500).json({ ok: false, error: "summary_failed" });
  }
}

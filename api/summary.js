import { applyCors, clean, getSheetsClient, readBearerToken, verifyFirebaseIdToken } from "./_google.js";
import { GRABOWSEE_EVENT_ID } from "./register.js";

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
    invitees: isApplicant ? invitees : [],
    inviteeStatus: isApplicant ? "" : (inviteeMatch?.status || "")
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
    .filter((row) => !isSimulatedRow(row))
    .map((row) => registrationSummary(row, identityEmail))
    .filter(Boolean)
    .reverse()
    .slice(0, 20);
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
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

    const { member, otherRegisteredCount } = await loadMemberAndCount(sheets, spreadsheetId, memberRange, identity);
    const registrations = member
      ? await loadRegistrationSummaries(sheets, spreadsheetId, registrationRange, identityEmail)
      : [];

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

import crypto from "node:crypto";
import { actionUrl, sendMail } from "./_mail.js";
import { applyCors, clean, getSheetsClient, isAdminIdentity, readBearerToken, readBody, verifyFirebaseIdToken } from "./_google.js";
import { GRABOWSEE_EVENT_ID, WRODOW_EVENT_ID, eventLabel, validate as validateRegistrationPayload } from "./register.js";

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

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function registrationId(seed) {
  return crypto
    .createHash("sha256")
    .update(`${seed}:${Date.now()}:${crypto.randomUUID()}`)
    .digest("hex")
    .slice(0, 16);
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function plusAlias(email, suffix) {
  const value = clean(email, 180).toLowerCase();
  const [local, domain] = value.split("@");
  if (!local || !domain) return "";
  const baseLocal = local.split("+")[0];
  return `${baseLocal}+${suffix}@${domain}`;
}

function demoMailPreview(kind, to, subject, text, html, links) {
  return {
    kind,
    to,
    subject,
    text,
    html,
    links
  };
}

function assertMailAccepted(mailResult, context) {
  if (mailResult?.ok) return;
  const error = new Error("mail_failed");
  error.statusCode = 502;
  error.mailResult = mailResult || null;
  error.mailContext = context;
  throw error;
}

function registrationStatus(invitees) {
  if (!invitees.length) return "pending_review";
  if (invitees.some((participant) => clean(participant?.status, 80) === "rejected")) return "invite_rejected";
  if (invitees.some((participant) => clean(participant?.status, 80) === "pending")) return "pending_invites";
  if (invitees.some((participant) => clean(participant?.status, 80) === "confirmed_profile_required")) return "invite_profiles_required";
  return "pending_review";
}

function humanEventLabel(eventId) {
  return eventLabel(eventId);
}

function humanEventDateLabel(eventId) {
  if (eventId === GRABOWSEE_EVENT_ID) return "04.07.2026";
  if (eventId === WRODOW_EVENT_ID) return "08.08.2026";
  return "";
}

function simulatedMarker(email) {
  return `simulated_by:${email}`;
}

function isSimulatedRow(row) {
  return clean(row?.[21], 120).startsWith("simulated_by:");
}

async function createDemoMemberRows(sheets, spreadsheetId, memberRange, now, adminEmail, participants) {
  const values = participants.map((participant) => [
    now,
    `demo:${participant.email}`,
    participant.email,
    participant.name,
    "demo_admin",
    participant.role,
    "",
    "",
    "no",
    "no",
    "yes",
    "yes",
    `demo_by:${adminEmail}`,
    "registered",
    "orga_only",
    "no",
    "",
    ""
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: memberRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values }
  });
}

async function createSimulatedRegistration({ req, sheets, spreadsheetId, registrationRange, memberRange, body, identity }) {
  const simulation = body.simulation && typeof body.simulation === "object" ? body.simulation : {};
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const applicantEmail = clean(simulation.email || payload.email, 180).toLowerCase();
  const applicantName = clean(simulation.displayName || payload.name, 120) || "Admin Simulation";
  const applicantRole = clean(simulation.eventFunction || payload.eventFunction, 80);
  const createProfiles = body.createProfiles === true;
  const sendDemoMail = body.sendDemoMail === true;

  const result = validateRegistrationPayload({
    ...payload,
    email: applicantEmail,
    name: applicantName,
    eventFunction: applicantRole
  });

  if (!result.ok) {
    const error = new Error("validation_failed");
    error.statusCode = 400;
    error.fields = result.errors;
    throw error;
  }

  const now = new Date().toISOString();
  const id = registrationId(`${applicantEmail}:${result.data.eventId}`);
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
  const inviteesForSheet = result.data.invitees.map((participant, index) => ({
    ...participant,
    status: "pending",
    invitedAt: now,
    confirmedAt: "",
    index
  }));
  const inviteHashesForSheet = inviteTokens.map(({ email, hash, index }) => ({ email, hash, index }));
  const inviteSummary = inviteesForSheet.map((participant) => `${participant.email}:${participant.status}`).join(", ");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: registrationRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        now,
        id,
        result.data.eventId,
        `sim:${applicantEmail}`,
        "admin_simulation",
        result.data.eventFunction,
        result.data.name,
        result.data.email,
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
        simulatedMarker(identity.email),
        now,
        JSON.stringify(inviteesForSheet),
        JSON.stringify(inviteHashesForSheet),
        inviteSummary
      ]]
    }
  });

  if (createProfiles) {
    await createDemoMemberRows(sheets, spreadsheetId, memberRange, now, identity.email, [
      { name: result.data.name, email: result.data.email, role: result.data.eventFunction },
      ...result.data.invitees.map((invitee) => ({
        name: invitee.name || invitee.email,
        email: invitee.email,
        role: invitee.eventFunction
      }))
    ]);
  }

  const label = humanEventLabel(result.data.eventId);
  const undoUrl = actionUrl(req, "undo-registration", undoToken);
  const previews = [
    demoMailPreview(
      "applicant",
      result.data.email,
      `Boudoir Collective Berlin: simulation for ${label}`,
      `Simulation ${id} created for ${label}.\nUndo: ${undoUrl}`,
      `<p>Simulation <strong>${id}</strong> created for <strong>${label}</strong>.</p><p><a href="${undoUrl}">Undo registration</a></p>`,
      [{ label: "Undo registration", url: undoUrl }]
    )
  ];

  for (const invitation of inviteTokens) {
    const participant = result.data.invitees[invitation.index];
    const confirmUrl = actionUrl(req, "confirm-partner", invitation.token);
    const rejectUrl = actionUrl(req, "reject-partner", invitation.token);
    const eventDate = humanEventDateLabel(result.data.eventId);
    const labelWithDate = eventDate ? `${label} am ${eventDate}` : label;
    previews.push(demoMailPreview(
      "invite",
      participant.email,
      `Boudoir Collective Berlin: Simulationseinladung zu ${labelWithDate}`,
      `Hallo ${participant.name || participant.email},\n\n${result.data.name} hat dich testweise zu ${labelWithDate} von Boudoir Collective Berlin eingeladen.\n\nEinladung best\u00e4tigen: ${confirmUrl}\nEinladung ablehnen: ${rejectUrl}`,
      `<p>Hallo ${participant.name || participant.email},</p><p>${result.data.name} hat dich testweise zu <strong>${label}</strong>${eventDate ? ` am <strong>${eventDate}</strong>` : ""} von Boudoir Collective Berlin eingeladen.</p><p><a href="${confirmUrl}">Einladung best\u00e4tigen</a></p><p><a href="${rejectUrl}">Einladung ablehnen</a></p>`,
      [
        { label: "Einladung best\u00e4tigen", url: confirmUrl },
        { label: "Einladung ablehnen", url: rejectUrl }
      ]
    ));
  }

  const mailResults = [];
  if (sendDemoMail) {
    for (const preview of previews) {
      const mailResult = await sendMail({
        to: preview.to,
        subject: preview.subject,
        text: preview.text,
        html: preview.html
      });
      mailResults.push({
        kind: preview.kind,
        to: preview.to,
        ...mailResult
      });
      assertMailAccepted(mailResult, { kind: preview.kind, to: preview.to });
    }
  }

  return {
    id,
    previews,
    createProfiles,
    sendDemoMail,
    mailResults,
    simulation: {
      email: result.data.email,
      displayName: result.data.name,
      eventFunction: result.data.eventFunction
    }
  };
}

async function createDemoRegistration({ req, sheets, spreadsheetId, registrationRange, memberRange, body, identity }) {
  const baseEmail = clean(body.baseEmail, 180).toLowerCase();
  const inviteCount = Math.min(Math.max(Number(body.inviteCount) || 2, 1), 5);
  const createProfiles = body.createProfiles === true;
  const sendDemoMail = body.sendDemoMail === true;
  const eventId = clean(body.eventId, 120) || "heilstaette-grabowsee-2026-07-04";
  const now = new Date().toISOString();
  const id = registrationId(baseEmail || identity.email);
  const applicantEmail = plusAlias(baseEmail, "user0");
  const undoToken = randomToken();

  if (!applicantEmail) {
    const error = new Error("Invalid demo base email");
    error.statusCode = 400;
    throw error;
  }

  const invitees = Array.from({ length: inviteCount }, (_, index) => {
    const role = index === 0 ? "photographer" : "model";
    return {
      name: `Demo User ${index + 1}`,
      email: plusAlias(baseEmail, `user${index + 1}`),
      instagram: "",
      eventFunction: role,
      status: "pending",
      invitedAt: now,
      confirmedAt: "",
      index
    };
  });
  const inviteTokens = invitees.map((participant) => ({
    email: participant.email,
    token: randomToken(),
    hash: "",
    index: participant.index
  }));
  inviteTokens.forEach((item) => {
    item.hash = hashToken(item.token);
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: registrationRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        now,
        id,
        eventId,
        `demo:${applicantEmail}`,
        "demo_admin",
        "model",
        "Demo Applicant",
        applicantEmail,
        "",
        invitees[0]?.name || "",
        invitees[0]?.email || "",
        "",
        invitees[0]?.eventFunction || "",
        invitees.length ? "pending" : "",
        "demo",
        "",
        "yes",
        `Admin demo created by ${identity.email}`,
        invitees.length ? "pending_invites" : "pending_review",
        hashToken(undoToken),
        inviteTokens[0]?.hash || "",
        `demo_by:${identity.email}`,
        now,
        JSON.stringify(invitees),
        JSON.stringify(inviteTokens.map(({ email, hash, index }) => ({ email, hash, index }))),
        invitees.map((participant) => `${participant.email}:${participant.status}`).join(", ")
      ]]
    }
  });

  if (createProfiles) {
    await createDemoMemberRows(sheets, spreadsheetId, memberRange, now, identity.email, [
      { name: "Demo Applicant", email: applicantEmail, role: "model" },
      ...invitees.map((invitee) => ({ name: invitee.name, email: invitee.email, role: invitee.eventFunction }))
    ]);
  }

  const undoUrl = actionUrl(req, "undo-registration", undoToken);
  const previews = [
    demoMailPreview(
      "applicant",
      applicantEmail,
      "Boudoir Collective Berlin: demo registration received",
      `Demo application ${id} received.\nUndo: ${undoUrl}`,
      `<p>Demo application <strong>${id}</strong> received.</p><p><a href="${undoUrl}">Undo registration</a></p>`,
      [{ label: "Undo registration", url: undoUrl }]
    )
  ];

  for (const invitation of inviteTokens) {
    const invitee = invitees[invitation.index];
    const confirmUrl = actionUrl(req, "confirm-partner", invitation.token);
    const rejectUrl = actionUrl(req, "reject-partner", invitation.token);
    const eventDate = humanEventDateLabel(eventId);
    const eventLabelWithDate = eventDate ? `${humanEventLabel(eventId)} am ${eventDate}` : humanEventLabel(eventId);
    previews.push(demoMailPreview(
      "invite",
      invitee.email,
      `Boudoir Collective Berlin: Demo-Einladung zu ${eventLabelWithDate}`,
      `Hallo ${invitee.name},\n\nDemo Applicant hat dich testweise zu ${eventLabelWithDate} von Boudoir Collective Berlin eingeladen.\n\nEinladung best\u00e4tigen: ${confirmUrl}\nEinladung ablehnen: ${rejectUrl}`,
      `<p>Hallo ${invitee.name},</p><p>Demo Applicant hat dich testweise zu <strong>${humanEventLabel(eventId)}</strong>${eventDate ? ` am <strong>${eventDate}</strong>` : ""} von Boudoir Collective Berlin eingeladen.</p><p><a href="${confirmUrl}">Einladung best\u00e4tigen</a></p><p><a href="${rejectUrl}">Einladung ablehnen</a></p>`,
      [
        { label: "Einladung best\u00e4tigen", url: confirmUrl },
        { label: "Einladung ablehnen", url: rejectUrl }
      ]
    ));
  }

  const mailResults = [];
  if (sendDemoMail) {
    for (const preview of previews) {
      const mailResult = await sendMail({
        to: preview.to,
        subject: preview.subject,
        text: preview.text,
        html: preview.html
      });
      mailResults.push({
        kind: preview.kind,
        to: preview.to,
        ...mailResult
      });
      assertMailAccepted(mailResult, { kind: preview.kind, to: preview.to });
    }
  }

  return { id, previews, createProfiles, sendDemoMail, mailResults };
}

function publicRegistration(row) {
  const status = clean(row[18], 60) || "pending_review";
  return {
    id: clean(row[1], 80),
    eventId: clean(row[2], 120),
    role: clean(row[5], 60),
    name: clean(row[6], 120),
    email: clean(row[7], 180),
    partnerName: clean(row[9], 120),
    partnerEmail: clean(row[10], 180),
    partnerStatus: clean(row[13], 60),
    status,
    adminStatus: clean(row[21], 60),
    simulated: isSimulatedRow(row),
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

function publicMember(row) {
  return {
    uid: clean(row[1], 200),
    email: clean(row[2], 180),
    name: clean(row[3], 120),
    provider: clean(row[4], 60),
    role: clean(row[5], 120),
    marker: clean(row[12], 120),
    status: clean(row[12], 60) || "registered",
    updatedAt: clean(row[0], 80)
  };
}

function latestPublicMembers(rows) {
  const latest = new Map();
  for (let index = rows.length - 1; index >= 1; index -= 1) {
    const item = publicMember(rows[index]);
    const emailKey = item.email.toLowerCase();
    const isDemo = item.provider === "demo_admin" || item.marker.startsWith("demo_by:");
    if (!emailKey || latest.has(emailKey) || item.email.startsWith("deleted:") || isDemo) continue;
    latest.set(emailKey, item);
  }
  return Array.from(latest.values());
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
      const [registrationResponse, memberResponse] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId, range: registrationRange }),
        sheets.spreadsheets.values.get({ spreadsheetId, range: memberRange }).catch(() => ({ data: { values: [] } }))
      ]);
      const rows = registrationResponse.data.values || [];
      const memberRows = memberResponse.data.values || [];
      res.status(200).json({
        ok: true,
        admin: true,
        registrations: rows.slice(1).map(publicRegistration).filter((item) => item.id && item.status !== "deleted").reverse().slice(0, 80),
        members: latestPublicMembers(memberRows).slice(0, 120)
      });
      return;
    }

    const body = readBody(req);
    const action = clean(body.action, 60);
    const now = new Date().toISOString();

    if (action === "admin-confirm-invite") {
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: registrationRange });
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row) => clean(row?.[1], 80) === clean(body.registrationId, 80));
      const inviteIndex = Number(body.inviteIndex);
      if (rowIndex < 0) {
        res.status(404).json({ ok: false, error: "registration_not_found" });
        return;
      }
      const row = rows[rowIndex];
      const invitees = parseJson(row?.[23], []);
      if (!Number.isInteger(inviteIndex) || !invitees[inviteIndex]) {
        res.status(404).json({ ok: false, error: "invite_not_found" });
        return;
      }
      invitees[inviteIndex].status = "confirmed";
      invitees[inviteIndex].confirmedAt = now;
      const sheetName = rangeSheet(registrationRange, "Registrations!A:Z");
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 13, "confirmed");
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 18, registrationStatus(invitees));
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 21, `invite_confirmed_by_admin:${identity.email}`);
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 22, now);
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 23, JSON.stringify(invitees));
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 25, invitees.map((invitee) => `${clean(invitee?.email, 180)}:${clean(invitee?.status, 80)}`).join(", "));
      res.status(200).json({ ok: true, status: "invite_confirmed_by_admin" });
      return;
    }

    if (["confirm", "reject", "undo", "delete"].includes(action)) {
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: registrationRange });
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row) => clean(row?.[1], 80) === clean(body.registrationId, 80));
      if (rowIndex < 0) {
        res.status(404).json({ ok: false, error: "registration_not_found" });
        return;
      }

      const invitees = parseJson(rows[rowIndex]?.[23], []);
      const readyForConfirmation = !invitees.length || invitees.every((invitee) => clean(invitee?.status, 80) === "confirmed");
      if (action === "confirm" && !readyForConfirmation) {
        res.status(409).json({ ok: false, error: "registration_incomplete" });
        return;
      }

      const status = action === "confirm"
        ? "confirmed"
        : (action === "reject"
          ? "rejected"
          : (action === "delete" ? "deleted" : "pending_review"));
      const sheetName = rangeSheet(registrationRange, "Registrations!A:Z");
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 18, status);
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 21, `${status}_by:${identity.email}`);
      await updateCell(sheets, spreadsheetId, sheetName, rowIndex + 1, 22, now);
      res.status(200).json({ ok: true, status });
      return;
    }

    if (action === "create-demo-registration") {
      const demo = await createDemoRegistration({
        req,
        sheets,
        spreadsheetId,
        registrationRange,
        memberRange,
        body,
        identity
      });
      res.status(200).json({ ok: true, status: "demo_created", demo, mailResults: demo.mailResults || [] });
      return;
    }

    if (action === "create-simulated-registration") {
      const simulation = await createSimulatedRegistration({
        req,
        sheets,
        spreadsheetId,
        registrationRange,
        memberRange,
        body,
        identity
      });
      res.status(200).json({ ok: true, status: "simulation_created", simulation, mailResults: simulation.mailResults || [] });
      return;
    }

    if (action === "delete-member") {
      const targetEmail = clean(body.email, 180).toLowerCase();
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: memberRange });
      const rows = response.data.values || [];
      const rowIndexes = rows
        .map((row, index) => ({ row, index }))
        .filter((item) => clean(item.row?.[2], 180).toLowerCase() === targetEmail)
        .map((item) => item.index);
      if (!rowIndexes.length) {
        res.status(404).json({ ok: false, error: "member_not_found" });
        return;
      }

      const emailHash = crypto.createHash("sha256").update(targetEmail).digest("hex").slice(0, 16);
      await Promise.all(rowIndexes.map((rowIndex) => sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${rangeSheet(memberRange, "Members!A:Z")}!A${rowIndex + 1}:R${rowIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[now, "", `deleted:${emailHash}`, "", "", "", "", "", "no", "no", "no", "no", `deleted_by_admin:${identity.email}`, "deleted", "none", "no", "", ""]]
        }
      })));
      res.status(200).json({ ok: true, status: "member_deleted", rows: rowIndexes.length });
      return;
    }

    res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    console.error("admin_failed", {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode || 500,
      fields: error.fields || {},
      response: error.response?.data || null,
      responseText: error.response || null,
      senderAddress: error.senderAddress || null,
      recipient: error.recipient || null,
      authMode: error.authMode || null,
      mailResult: error.mailResult || null,
      mailContext: error.mailContext || null,
      errors: error.errors || null
    });
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message === "validation_failed" ? "validation_failed" : "admin_failed",
      fields: error.fields || {},
      detail: error.message || "admin_failed",
      mailResult: error.mailResult || null,
      mailContext: error.mailContext || null
    });
  }
}


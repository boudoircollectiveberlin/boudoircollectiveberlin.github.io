const API_BASE = window.BCB_API_BASE || "";

const upcomingEventGrid = document.querySelector("#upcoming-event-grid");
const pastEventGrid = document.querySelector("#past-event-grid");
const eventSelect = document.querySelector("#event-select");
const form = document.querySelector("#register-form");
const profileForm = document.querySelector("#profile-form");
const formStatus = document.querySelector("#form-status");
const profileStatus = document.querySelector("#profile-status");
const authStatus = document.querySelector("#auth-status");
const topbarAuthStatus = document.querySelector("#topbar-auth-status");
const topbarMemberStatus = document.querySelector("#topbar-member-status");
const eventAuthGate = document.querySelector("[data-event-auth-gate]");
const eventAuthGateTitle = document.querySelector("[data-event-auth-gate-title]");
const eventAuthGateCopy = document.querySelector("[data-event-auth-gate-copy]");
const eventAuthGateLink = document.querySelector("[data-event-auth-gate-link]");
const authButtons = Array.from(document.querySelectorAll("[data-auth-provider]"));
const authButtonSections = Array.from(document.querySelectorAll(".account-menu .auth-buttons"));
const logoutButtons = Array.from(document.querySelectorAll("[data-auth-logout]"));
const accountProfileLinks = Array.from(document.querySelectorAll("[data-account-profile-link]"));
const accountStages = Array.from(document.querySelectorAll("[data-account-stage]"));
const menuToggle = document.querySelector("[data-menu-toggle]");
const topbar = document.querySelector(".topbar");
const accountMenu = document.querySelector("[data-account-menu]");
const accountToggle = document.querySelector("[data-account-toggle]");
const accountPanel = document.querySelector("[data-account-panel]");
const profileLocked = document.querySelector("#profile-locked");
const joinTitle = document.querySelector("[data-join-title]");
const joinCopy = document.querySelector("[data-join-copy]");
const joinNote = document.querySelector("[data-join-note]");
const joinPrimary = document.querySelector("[data-join-primary]");
const registerPrimary = document.querySelector("[data-register-primary]");
const adminPanel = document.querySelector("#admin-panel");
const adminList = document.querySelector("#admin-registration-list");
const adminStatus = document.querySelector("#admin-status");
const adminDeleteEmail = document.querySelector("#admin-delete-email");
const adminDeleteMember = document.querySelector("#admin-delete-member");
const adminAccessNote = document.querySelector("#admin-access-note");
const adminAccessCopy = document.querySelector("#admin-access-copy");
const adminDemoEmail = document.querySelector("#admin-demo-email");
const adminDemoCount = document.querySelector("#admin-demo-count");
const adminDemoProfiles = document.querySelector("#admin-demo-profiles");
const adminDemoSend = document.querySelector("#admin-demo-send");
const adminCreateDemo = document.querySelector("#admin-create-demo");
const adminDemoOutput = document.querySelector("#admin-demo-output");
const accountTabButtons = Array.from(document.querySelectorAll("[data-account-tab]"));
const accountTabPanels = Array.from(document.querySelectorAll("[data-account-panel-section]"));
const ADMIN_SIMULATION_KEY = "bcb-admin-simulation";
const ADMIN_BASE_EMAIL_KEY = "bcb-admin-base-email";

let eventsCache = [];
let authState = {
  idToken: "",
  profile: null,
  member: null,
  userSummary: null,
  adminRegistrations: [],
  config: null,
  auth: null,
  firebaseHelpers: null,
  providers: {},
  profileComplete: false,
  pendingAuthLink: null,
  isAdmin: false,
  adminBaseEmail: "",
  impersonation: null,
  adminMemberSearch: "",
  adminMemberPage: 0
};

function isAccountPage() {
  return window.location.pathname.endsWith("/account.html") || window.location.pathname.endsWith("account.html");
}

function setAccountTab(name) {
  if (!isAccountPage() || !accountTabButtons.length) return;
  const next = accountTabButtons.find((button) => button.dataset.accountTab === name && !button.hidden)
    || accountTabButtons.find((button) => !button.hidden);
  if (!next) return;
  accountTabButtons.forEach((button) => {
    const active = button === next;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  accountTabPanels.forEach((panel) => {
    const active = panel.id === next.getAttribute("aria-controls");
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
}

function openProfileFormSection() {
  closeAccountMenu();
  if (topbar && menuToggle) {
    topbar.dataset.menuOpen = "false";
    menuToggle.setAttribute("aria-expanded", "false");
  }
  if (isAccountPage()) {
    setAccountTab("profile");
    window.history.replaceState({}, "", "#profile-form");
    setTimeout(() => profileForm?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  } else {
    window.location.href = "account.html#profile-form";
  }
}

function syncAccountTabLabels() {
  accountTabButtons.forEach((button) => {
    button.textContent = lang() === "de" ? (button.dataset.tabLabelDe || button.textContent) : (button.dataset.tabLabelEn || button.textContent);
  });
}

function syncAccountAdminTab() {
  const adminTabButton = document.querySelector('[data-account-tab="admin"]');
  if (!adminTabButton) return;
  adminTabButton.hidden = !authState.isAdmin;
  if (!authState.isAdmin && adminTabButton.classList.contains("is-active")) {
    setAccountTab("overview");
  }
}

function initAccountTabs() {
  if (!isAccountPage() || !accountTabButtons.length) return;
  syncAccountTabLabels();
  accountTabButtons.forEach((button) => {
    button.addEventListener("click", () => setAccountTab(button.dataset.accountTab));
  });
  if (window.location.hash === "#profile-form") {
    setAccountTab("profile");
    return;
  }
  setAccountTab("overview");
}

window.addEventListener("hashchange", () => {
  if (window.location.hash === "#profile-form") setAccountTab("profile");
});

function profileStorageKey(uid) {
  return `bcb-profile-complete:${uid}`;
}

function setCheckedValues(name, values) {
  const allowed = new Set(Array.isArray(values) ? values : []);
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = allowed.has(input.value);
  });
}

function applyMemberProfile(member) {
  if (!profileForm || !member) return;
  profileForm.elements.displayName.value = member.displayName || authState.profile?.name || "";
  profileForm.elements.instagram.value = member.instagram || "";
  profileForm.elements.portfolio.value = member.portfolio || "";
  profileForm.elements.futureUpdates.checked = member.futureUpdates === true;
  profileForm.elements.lobbyInfo.checked = member.lobbyInfo === true;
  profileForm.elements.communityConsent.checked = member.communityConsent === true;
  profileForm.elements.communityPrivacy.checked = member.communityPrivacy === true;
  if (profileForm.elements.discoverable) profileForm.elements.discoverable.checked = member.discoverable === true;
  if (profileForm.elements.discoverableName) profileForm.elements.discoverableName.value = member.discoverableName || member.displayName || "";
  if (profileForm.elements.discoverableIntro) profileForm.elements.discoverableIntro.value = member.discoverableIntro || "";
  setCheckedValues("functions", member.functions || []);
}

function currentApplicantData() {
  if (adminSimulationActive()) {
    return {
      name: authState.impersonation?.displayName || "",
      email: authState.impersonation?.email || "",
      instagram: "",
      portfolio: ""
    };
  }

  return {
    name: authState.member?.displayName || authState.profile?.name || "",
    email: authState.profile?.email || "",
    instagram: authState.member?.instagram || "",
    portfolio: authState.member?.portfolio || ""
  };
}

function accountNextTarget() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return "";
  try {
    const resolved = new URL(next, window.location.origin);
    if (resolved.origin !== window.location.origin) return "";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "";
  }
}

function eventRegistrationAccountHref() {
  const returnTarget = `${window.location.pathname}${window.location.search}#application`;
  return `account.html?next=${encodeURIComponent(returnTarget)}#profile-form`;
}

function syncEventApplicantFields() {
  if (!form) return;
  const applicant = currentApplicantData();
  if (form.elements.name) {
    form.elements.name.value = applicant.name;
    form.elements.name.readOnly = true;
  }
  if (form.elements.email) {
    form.elements.email.value = applicant.email;
    form.elements.email.readOnly = true;
  }
  if (form.elements.instagram) {
    form.elements.instagram.value = applicant.instagram;
    form.elements.instagram.readOnly = true;
  }
  if (form.elements.portfolio) {
    form.elements.portfolio.value = applicant.portfolio;
    form.elements.portfolio.readOnly = true;
  }
}

function refreshLandingCtas() {
  const hasProfile = authState.profileComplete;

  if (joinTitle) {
    joinTitle.textContent = t(hasProfile ? "joinTitleRegistered" : "joinTitle");
  }
  if (joinCopy) {
    joinCopy.textContent = t(hasProfile ? "joinCopyRegistered" : "joinCopy");
  }
  if (joinNote) {
    joinNote.textContent = t(hasProfile ? "joinNoteRegistered" : "joinNote");
  }

  [joinPrimary, registerPrimary].forEach((link) => {
    if (!link) return;
    link.textContent = t(hasProfile ? "heroPrimaryExplore" : "heroPrimary");
    link.href = hasProfile ? "#events" : "account.html";
    link.hidden = false;
  });
}

function refreshEventApplicationUi() {
  if (!form) return;

  const isSignedIn = Boolean(authState.profile?.email);
  const eventId = currentEventId();
  const existingEventEntry = eventId
    ? (Array.isArray(authState.userSummary?.registrations) ? authState.userSummary.registrations : []).find((item) => item.eventId === eventId)
    : null;
  form.closest("#application")?.classList.toggle("has-existing-entry", Boolean(existingEventEntry));
  const canUseEventForm = adminSimulationActive() || (isSignedIn && authState.profileComplete && !existingEventEntry);
  const needsProfile = isSignedIn && !authState.profileComplete && !adminSimulationActive();

  form.hidden = !canUseEventForm;

  if (!eventAuthGate) return;

  eventAuthGate.hidden = canUseEventForm;
  if (eventAuthGateLink) {
    eventAuthGateLink.href = eventRegistrationAccountHref();
  }

  if (adminSimulationActive()) return;

  if (existingEventEntry) {
    if (eventAuthGateTitle) eventAuthGateTitle.textContent = lang() === "de" ? "Dein Status für dieses Event" : "Your status for this event";
    if (eventAuthGateCopy) {
      const role = existingEventEntry.role || "";
      const status = existingEventEntry.applicant
        ? registrationStatusLabel(existingEventEntry.registrationStatus || "")
        : inviteStatusLabel(existingEventEntry.inviteeStatus || "");
      eventAuthGateCopy.textContent = lang() === "de"
        ? `Für dieses Event gibt es bereits einen Eintrag für deinen Account: ${role} · ${status}. Wenn du dich stattdessen neu bewerben möchtest, ziehe zuerst unten deine aktuelle Einladung oder Bewerbung zurück.`
        : `There is already an entry for your account for this event: ${role} · ${status}. If you want to apply again instead, withdraw your current invitation or application below first.`;
    }
    if (eventAuthGateLink) {
      eventAuthGateLink.textContent = lang() === "de" ? "Meinen Status ansehen" : "View my status";
      eventAuthGateLink.href = "#member-summary-panel";
    }
    return;
  }

  if (!isSignedIn) {
    if (eventAuthGateTitle) eventAuthGateTitle.textContent = t("grabowseeLoginRequiredTitle");
    if (eventAuthGateCopy) eventAuthGateCopy.textContent = t("grabowseeLoginRequiredCopy");
    if (eventAuthGateLink) eventAuthGateLink.textContent = t("grabowseeLoginRequiredAction");
    return;
  }

  if (needsProfile) {
    if (eventAuthGateTitle) eventAuthGateTitle.textContent = t("grabowseeProfileRequiredTitle");
    if (eventAuthGateCopy) eventAuthGateCopy.textContent = t("grabowseeProfileRequiredCopy");
    if (eventAuthGateLink) eventAuthGateLink.textContent = t("grabowseeProfileRequiredAction");
  }
}

async function loadMemberProfile() {
  if (!authState.idToken) return null;

  try {
    const response = await fetch(`${API_BASE}/api/member`, {
      headers: { Authorization: `Bearer ${authState.idToken}` }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.member || null;
  } catch {
    return null;
  }
}

function t(key) {
  return window.BCB_I18N?.translate(key) || key;
}

function lang() {
  return window.BCB_I18N?.getLanguage() || "de";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function localized(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[lang()] || value.de || value.en || "";
  }

  return value || "";
}

function isGmailAddress(email) {
  return /@gmail\.com$/i.test(String(email || "").trim());
}

function simulationPresets(baseEmail) {
  if (!isGmailAddress(baseEmail)) return [];
  const [local, domain] = baseEmail.trim().toLowerCase().split("@");
  const baseLocal = local.split("+")[0];
  return [
    { label: "Test Fotograf 1", email: `${baseLocal}+testfotograf1@${domain}`, displayName: "Test Fotograf 1", eventFunction: "photographer" },
    { label: "Test Model 1", email: `${baseLocal}+testmodel1@${domain}`, displayName: "Test Model 1", eventFunction: "model" },
    { label: "Test Model 2", email: `${baseLocal}+testmodel2@${domain}`, displayName: "Test Model 2", eventFunction: "model" }
  ];
}

function adminSimulationActive() {
  return Boolean(authState.isAdmin && authState.impersonation?.email);
}

function currentEventId() {
  return form?.elements?.eventId?.value || "";
}

function eventDetailUrl(eventId) {
  if (eventId === "heilstaette-grabowsee-2026-07-04") return "event-grabowsee.html";
  return "";
}

function registrationStatusLabel(status) {
  const mapDe = {
    pending_invites: "Invites offen",
    pending_review: "Vollständig, wartet auf Admin-Freigabe",
    invite_profiles_required: "Bestätigt, Profile fehlen noch",
    invite_rejected: "Invite abgelehnt",
    confirmed: "Bestätigt",
    rejected: "Abgelehnt",
    deleted: "Gelöscht",
    canceled_by_link: "Zurückgezogen",
    canceled_by_user: "Zurückgezogen"
  };
  const mapEn = {
    pending_invites: "Invites pending",
    pending_review: "Complete, waiting for admin review",
    invite_profiles_required: "Confirmed, profiles still required",
    invite_rejected: "Invite rejected",
    confirmed: "Confirmed",
    rejected: "Rejected",
    deleted: "Deleted",
    canceled_by_link: "Withdrawn",
    canceled_by_user: "Withdrawn"
  };
  return (lang() === "de" ? mapDe : mapEn)[status] || status || "";
}

function inviteStatusLabel(status) {
  const mapDe = {
    pending: "offen",
    confirmed: "bestätigt",
    confirmed_profile_required: "bestätigt, Profil fehlt",
    rejected: "abgelehnt"
  };
  const mapEn = {
    pending: "pending",
    confirmed: "confirmed",
    confirmed_profile_required: "confirmed, profile missing",
    rejected: "rejected"
  };
  return (lang() === "de" ? mapDe : mapEn)[status] || status || "";
}

function userActionStatusMessage(action, status) {
  if (lang() === "de") {
    if (action === "withdraw-registration" && status === "canceled_by_user") return "Deine Bewerbung wurde zurückgezogen.";
    if (action === "confirm-invite" && status === "confirmed") return "Deine Einladung wurde bestätigt.";
    if (action === "confirm-invite" && status === "confirmed_profile_required") return "Einladung bestätigt. Bitte vervollständige noch dein Profil, damit die Bewerbung vollständig wird.";
    if (action === "reject-invite" && status === "rejected") return "Deine Einladung wurde abgelehnt.";
    if (action === "add-invite" && status === "invite_added") return "Einladung wurde hinzugefügt.";
    if (action === "update-invite-email" && status === "invite_email_updated") return "Mailadresse wurde korrigiert und die Einladung neu versendet.";
  }
  if (action === "withdraw-registration" && status === "canceled_by_user") return "Your application has been withdrawn.";
  if (action === "confirm-invite" && status === "confirmed") return "Your invitation has been confirmed.";
  if (action === "confirm-invite" && status === "confirmed_profile_required") return "Invitation confirmed. Please complete your profile so the application can be completed.";
  if (action === "reject-invite" && status === "rejected") return "Your invitation has been declined.";
  if (action === "add-invite" && status === "invite_added") return "Invitation added.";
  if (action === "update-invite-email" && status === "invite_email_updated") return "Email corrected and invitation resent.";
  return "";
}

function registrationCompletionMeta(item) {
  const invitees = Array.isArray(item?.invitees) ? item.invitees : [];
  if (!invitees.length) {
    return {
      complete: true,
      label: lang() === "de" ? "Vollständig" : "Complete"
    };
  }
  const confirmedCount = invitees.filter((invitee) => invitee.status === "confirmed").length;
  const complete = confirmedCount === invitees.length;
  return {
    complete,
    label: lang() === "de"
      ? (complete
        ? `Vollständig - ${confirmedCount}/${invitees.length} Invites bestätigt`
        : `Unvollständig - ${confirmedCount}/${invitees.length} Invites bestätigt`)
      : (complete
        ? `Complete - ${confirmedCount}/${invitees.length} invites confirmed`
        : `Incomplete - ${confirmedCount}/${invitees.length} invites confirmed`)
  };
}

function inviteLine(invitee, index, registrationId, editable) {
  const label = `Invite ${escapeHtml(invitee.name || invitee.email)}${invitee.name ? ` (${escapeHtml(invitee.email)})` : ""} \u00b7 ${escapeHtml(inviteStatusLabel(invitee.status || "pending"))}`;
  if (!editable) return `<span>${label}</span>`;
  return `
    <span>${label}</span>
    <form class="inline-invite-form" data-update-invite-email data-registration-id="${escapeHtml(registrationId)}" data-invite-index="${index}">
      <input name="email" type="email" value="${escapeHtml(invitee.email || "")}" required>
      <button class="button button--ghost" type="submit">${escapeHtml(lang() === "de" ? "Mail korrigieren" : "Correct email")}</button>
    </form>
  `;
}

function lateInviteOptions(item) {
  if (!item?.applicant) return [];
  const terminal = new Set(["confirmed", "rejected", "deleted"]);
  if (terminal.has(item.registrationStatus)) return [];
  const roles = [item.role, ...(item.invitees || []).map((invitee) => invitee.role)].filter(Boolean);
  if (item.eventId === "heilstaette-grabowsee-2026-07-04") {
    const photographerCount = roles.filter((role) => role === "photographer").length;
    const modelCount = roles.filter((role) => role === "model").length;
    return [
      ...(modelCount < 3 ? [{ value: "model", label: "Model" }] : []),
      ...(photographerCount < 1 ? [{ value: "photographer", label: "Fotograf:in" }] : [])
    ];
  }
  return [{ value: "model", label: "Model" }, { value: "photographer", label: "Fotograf:in" }];
}

function actionResultMessage(action, result) {
  if (lang() === "de") {
    if (action === "confirm-partner" && result === "confirmed") {
      return {
        tone: "success",
        text: "Einladung bestätigt. Dein Status für dieses Event wurde übernommen."
      };
    }
    if (action === "confirm-partner" && result === "profile-required") {
      return {
        tone: "warning",
        text: "Einladung bestätigt. Bitte melde dich mit derselben E-Mail an und vervollständige dein Community-Profil, damit die Bewerbung vollständig wird."
      };
    }
    if (action === "reject-partner" && result === "rejected") {
      return {
        tone: "warning",
        text: "Einladung abgelehnt. Die Orga sieht den aktualisierten Status direkt in der Eventbewerbung."
      };
    }
    if (action === "undo-registration" && result === "canceled") {
      return {
        tone: "warning",
        text: "Die Bewerbung wurde zurückgezogen."
      };
    }
  }

  if (action === "confirm-partner" && result === "confirmed") {
    return { tone: "success", text: "Invitation confirmed. Your status for this event has been updated." };
  }
  if (action === "confirm-partner" && result === "profile-required") {
    return { tone: "warning", text: "Invitation confirmed. Please sign in with the same email and complete your community profile so the application can be completed." };
  }
  if (action === "reject-partner" && result === "rejected") {
    return { tone: "warning", text: "Invitation declined. The organizer team will see the updated status in the event application." };
  }
  if (action === "undo-registration" && result === "canceled") {
    return { tone: "warning", text: "The application has been withdrawn." };
  }
  return null;
}

function renderRegistrationActionNotice() {
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  const action = params.get("registrationAction");
  const result = params.get("registrationResult");
  const message = actionResultMessage(action, result);
  const existing = document.querySelector("#registration-action-notice");
  if (existing) existing.remove();
  if (!message) return;

  const note = document.createElement("div");
  note.id = "registration-action-notice";
  note.className = `action-notice action-notice--${message.tone}`;
  note.innerHTML = `<strong>${escapeHtml(lang() === "de" ? "Bewerbungsstatus" : "Application status")}</strong><span>${escapeHtml(message.text)}</span>`;
  form.insertAdjacentElement("beforebegin", note);

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("registrationAction");
  cleanUrl.searchParams.delete("registrationResult");
  window.history.replaceState({}, "", cleanUrl.toString());
}

function loadStoredAdminSimulation() {
  try {
    const raw = localStorage.getItem(ADMIN_SIMULATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistAdminSimulation() {
  if (!authState.impersonation) {
    localStorage.removeItem(ADMIN_SIMULATION_KEY);
    return;
  }
  localStorage.setItem(ADMIN_SIMULATION_KEY, JSON.stringify(authState.impersonation));
}

function setAdminSimulation(simulation) {
  authState.impersonation = simulation && simulation.email ? {
    email: String(simulation.email).trim().toLowerCase(),
    displayName: String(simulation.displayName || "").trim(),
    eventFunction: String(simulation.eventFunction || "").trim()
  } : null;
  persistAdminSimulation();
  renderAdminFlyout();
  renderSimulationNotice();
  applySimulationToEventForm();
}

function resetAdminSimulation() {
  setAdminSimulation(null);
}

function renderSimulationNotice() {
  const existing = document.querySelector("#admin-simulation-notice");
  if (existing) existing.remove();
  if (!form || !adminSimulationActive()) return;

  const simulation = authState.impersonation;
  const note = document.createElement("div");
  note.id = "admin-simulation-notice";
  note.className = "admin-simulation-note";
  note.innerHTML = `
    <strong>Admin-Simulation aktiv</strong>
    <span>${escapeHtml(simulation.displayName || simulation.email)} \u00b7 ${escapeHtml(simulation.email)} \u00b7 ${escapeHtml(simulation.eventFunction || "open")}</span>
  `;
  form.insertAdjacentElement("beforebegin", note);
}

function applySimulationToEventForm() {
  if (!form) return;
  syncEventApplicantFields();
  if (adminSimulationActive() && form.elements.eventFunction && authState.impersonation?.eventFunction) {
    form.elements.eventFunction.value = authState.impersonation.eventFunction;
  }
}

function renderAdminFlyout() {
  const flyout = document.querySelector("#global-admin-flyout");
  if (!flyout) return;

  const baseEmail = authState.adminBaseEmail || (isGmailAddress(authState.profile?.email) ? authState.profile.email : "");
  const presets = simulationPresets(baseEmail);
  const activeEmail = authState.impersonation?.email || "";

  flyout.innerHTML = `
    <button class="admin-flyout__toggle" type="button" id="admin-flyout-toggle" aria-expanded="false">Admin</button>
    <div class="admin-flyout__panel" id="admin-flyout-panel" hidden>
      <div class="admin-flyout__head">
        <strong>Admin Tools</strong>
        <span>${escapeHtml(authState.profile?.email || "")}</span>
      </div>
      <label>
        <span>Gmail-Basis für virtuelle Eventnutzer</span>
        <input id="admin-flyout-base-email" type="email" value="${escapeHtml(baseEmail)}" placeholder="deinname@gmail.com">
      </label>
      <div class="admin-flyout__presets">
        ${presets.length
          ? presets.map((preset) => `<button class="button ${activeEmail === preset.email ? "button--primary" : "button--ghost"}" type="button" data-admin-sim-email="${escapeHtml(preset.email)}" data-admin-sim-name="${escapeHtml(preset.displayName)}" data-admin-sim-role="${escapeHtml(preset.eventFunction)}">${escapeHtml(preset.label)}</button>`).join("")
          : `<p>Für Plus-Alias-Simulation bitte eine Gmail-Adresse verwenden.</p>`}
      </div>
      <div class="admin-flyout__current">
        <strong>${adminSimulationActive() ? "Aktive Simulation" : "Keine aktive Simulation"}</strong>
        <span>${adminSimulationActive() ? `${escapeHtml(authState.impersonation.displayName || "")} \u00b7 ${escapeHtml(authState.impersonation.email)}` : "Normale Nutzeransicht"}</span>
      </div>
      <label class="checkbox">
        <input id="admin-flyout-create-profiles" type="checkbox" checked>
        <span>Invite-Profile mit anlegen</span>
      </label>
      <label class="checkbox">
        <input id="admin-flyout-send-mails" type="checkbox">
        <span>Mails wirklich senden</span>
      </label>
      <div class="admin-row__actions">
        <button class="button button--ghost" type="button" id="admin-flyout-clear">Simulation beenden</button>
        <a class="button button--ghost" href="account.html#admin-panel">Account-Admin</a>
      </div>
    </div>
  `;

  const toggle = flyout.querySelector("#admin-flyout-toggle");
  const panel = flyout.querySelector("#admin-flyout-panel");
  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    panel.hidden = open;
  });

  const baseInput = flyout.querySelector("#admin-flyout-base-email");
  baseInput?.addEventListener("change", () => {
    authState.adminBaseEmail = baseInput.value.trim().toLowerCase();
    localStorage.setItem(ADMIN_BASE_EMAIL_KEY, authState.adminBaseEmail);
    renderAdminFlyout();
  });

  flyout.querySelectorAll("[data-admin-sim-email]").forEach((button) => {
    button.addEventListener("click", () => {
      setAdminSimulation({
        email: button.dataset.adminSimEmail,
        displayName: button.dataset.adminSimName,
        eventFunction: button.dataset.adminSimRole
      });
    });
  });

  flyout.querySelector("#admin-flyout-clear")?.addEventListener("click", () => {
    resetAdminSimulation();
  });
}

function ensureAdminFlyout() {
  if (!authState.isAdmin) return;
  let flyout = document.querySelector("#global-admin-flyout");
  if (!flyout) {
    flyout = document.createElement("aside");
    flyout.id = "global-admin-flyout";
    flyout.className = "admin-flyout";
    document.body.append(flyout);
  }
  renderAdminFlyout();
}

function removeAdminFlyout() {
  document.querySelector("#global-admin-flyout")?.remove();
}

function renderMailPreviews(previews, target = adminDemoOutput) {
  if (!target) return;
  if (!previews?.length) {
    target.innerHTML = "";
    return;
  }

  target.innerHTML = previews.map((preview) => `
    <article class="admin-mail-preview">
      <div>
        <strong>${escapeHtml(preview.kind)} \u00b7 ${escapeHtml(preview.to)}</strong>
        <span>${escapeHtml(preview.subject)}</span>
      </div>
      <pre>${escapeHtml(preview.text)}</pre>
      <div class="admin-row__actions">
        ${(preview.links || []).map((link) => `<a class="button button--ghost" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`).join("")}
      </div>
    </article>
  `).join("");
}

async function loadEvents() {
  const fallback = await fetch("data/events.json").then((response) => response.json());

  try {
    const response = await fetch(`${API_BASE}/api/events`);
    if (!response.ok) return fallback.events;
    const payload = await response.json();
    return payload.events || fallback.events;
  } catch {
    return fallback.events;
  }
}

function eventStatus(event) {
  if (event.status === "completed") return t("statusCompleted");
  if (event.status === "interest") return t("statusInterest");
  return t("statusPlanning");
}

function eventCard(event) {
  return `
    <article class="event-card">
      <div class="event-card__top">
        <span class="badge">${escapeHtml(event.type)}</span>
        <small>${escapeHtml(eventStatus(event))}</small>
      </div>
      <div>
        <h3>${escapeHtml(localized(event.title))}</h3>
        <p>${escapeHtml(localized(event.summary))}</p>
      </div>
      <p>${escapeHtml(localized(event.format))}</p>
      <ul>
        <li>${escapeHtml(localized(event.dateLabel))}, ${escapeHtml(localized(event.timeLabel))}</li>
        <li>${escapeHtml(localized(event.location))}</li>
        <li>${escapeHtml(localized(event.cost))}</li>
      </ul>
      ${event.detailUrl ? `<a class="button button--ghost event-card__link" href="${escapeHtml(event.detailUrl)}">${escapeHtml(t("eventDetails"))}</a>` : ""}
    </article>
  `;
}

function renderEvents(events) {
  eventsCache = events;
  const upcoming = events.filter((event) => event.group !== "past");
  const past = events.filter((event) => event.group === "past");

  if (upcomingEventGrid) {
    upcomingEventGrid.innerHTML = upcoming.map(eventCard).join("");
  }

  if (pastEventGrid) {
    pastEventGrid.innerHTML = past.map(eventCard).join("");
  }

  if (eventSelect) {
    eventSelect.innerHTML = [
      `<option value="">${escapeHtml(t("eventSelectPlaceholder"))}</option>`,
      ...upcoming.map((event) => `<option value="${escapeHtml(event.id)}">${escapeHtml(localized(event.title))} - ${escapeHtml(localized(event.dateLabel))}</option>`)
    ].join("");
  }
}

function initMenu() {
  if (!menuToggle || !topbar) return;

  menuToggle.addEventListener("click", () => {
    const isOpen = topbar.dataset.menuOpen === "true";
    topbar.dataset.menuOpen = isOpen ? "false" : "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  topbar.querySelectorAll(".nav a").forEach((link) => {
    link.addEventListener("click", () => {
      topbar.dataset.menuOpen = "false";
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

function closeAccountMenu() {
  if (!accountToggle || !accountPanel) return;
  accountPanel.hidden = true;
  accountToggle.setAttribute("aria-expanded", "false");
}

function initAccountMenu() {
  if (!accountMenu || !accountToggle || !accountPanel) return;

  accountPanel.hidden = true;
  accountToggle.setAttribute("aria-expanded", "false");

  accountToggle.addEventListener("click", () => {
    const isOpen = accountToggle.getAttribute("aria-expanded") === "true";
    accountPanel.hidden = isOpen;
    accountToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  accountPanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  accountProfileLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!link.getAttribute("href")?.includes("#profile-form")) return;
      event.preventDefault();
      openProfileFormSection();
    });
  });

  document.addEventListener("click", (event) => {
    if (!accountMenu.contains(event.target)) closeAccountMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAccountMenu();
  });
}

function initContactFlyout() {
  const flyout = document.querySelector("#contact-flyout");
  const flyoutImage = document.querySelector("#contact-flyout-image");
  const flyoutName = document.querySelector("#contact-flyout-name");
  const flyoutInfo = document.querySelector("#contact-flyout-info");
  const contactCards = Array.from(document.querySelectorAll("[data-contact-card]"));
  if (!flyout || !flyoutImage || !flyoutName || !flyoutInfo || !contactCards.length) return;

  const closeButtons = Array.from(flyout.querySelectorAll("[data-contact-close]"));

  function closeFlyout() {
    flyout.hidden = true;
    document.body.style.overflow = "";
  }

  function openFlyout(card) {
    const portrait = card.querySelector(".contact-card__portrait");
    const name = card.querySelector(".contact-card__name");
    const body = card.querySelector(".contact-card__body");
    if (!portrait || !name || !body) return;

    flyoutImage.src = card.dataset.flyoutImage || portrait.currentSrc || portrait.src;
    flyoutImage.alt = portrait.alt || "";
    flyoutName.innerHTML = name.innerHTML;
    flyoutInfo.innerHTML = Array.from(body.querySelectorAll("p"))
      .filter((paragraph) => !paragraph.classList.contains("contact-card__name"))
      .map((paragraph) => paragraph.outerHTML)
      .join("");

    flyout.hidden = false;
    document.body.style.overflow = "hidden";
  }

  contactCards.forEach((card) => {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", card.querySelector(".contact-card__name strong")?.textContent || t("contactTitle"));
    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      openFlyout(card);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openFlyout(card);
    });
  });

  closeButtons.forEach((button) => button.addEventListener("click", closeFlyout));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !flyout.hidden) closeFlyout();
  });
}

function setStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#ffb4a8" : "rgba(255, 255, 255, .72)";
}

async function loadAuthConfig() {
  try {
    const response = await fetch(`${API_BASE}/api/config`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function authProviderLabel(providerId) {
  switch (providerId) {
    case "google":
    case "google.com":
      return "Google";
    case "microsoft":
    case "microsoft.com":
      return "Microsoft";
    case "password":
      return lang() === "de" ? "E-Mail und Passwort" : "email and password";
    default:
      return providerId || (lang() === "de" ? "diesem Login-Anbieter" : "this sign-in provider");
  }
}

function authMethodList(methods) {
  return (methods || []).map(authProviderLabel).filter(Boolean).join(", ");
}

function setAuthError(message) {
  setStatus(authStatus, message, true);
  setStatus(topbarAuthStatus, message, true);
}

function logAuthError(context, error, extra = {}) {
  console.groupCollapsed(`[BCB auth] ${context}${error?.code ? `: ${error.code}` : ""}`);
  console.error({
    code: error?.code || "",
    message: error?.message || "",
    email: error?.customData?.email || error?.email || "",
    providerId: error?.customData?.providerId || "",
    stack: error?.stack || "",
    extra
  });
  console.groupEnd();
}

function authMessageForError(error, provider) {
  switch (error?.code) {
    case "auth/popup-closed-by-user":
      return t("authPopupClosed");
    case "auth/popup-blocked":
      return t("authPopupBlocked");
    case "auth/cancelled-popup-request":
      return t("authPopupCancelled");
    case "auth/network-request-failed":
      return t("authNetworkError");
    case "auth/unauthorized-domain":
      return t("authUnauthorizedDomain");
    case "auth/operation-not-allowed":
      return t("authOperationNotAllowed");
    default:
      return provider === "microsoft" ? t("authMicrosoftError") : t("authGenericAuthError");
  }
}

async function finalizePendingAuthLink(user, linkWithCredential) {
  const pending = authState.pendingAuthLink;
  if (!pending?.credential || !user?.email) return;
  if (pending.email !== user.email.toLowerCase()) return;

  try {
    const alreadyLinked = user.providerData?.some((entry) => entry.providerId === pending.providerId);
    if (alreadyLinked) {
      authState.pendingAuthLink = null;
      setStatus(authStatus, t("authProviderAlreadyLinked"));
      return;
    }

    await linkWithCredential(user, pending.credential);
    authState.pendingAuthLink = null;
    authState.idToken = await user.getIdToken(true);
    setStatus(authStatus, t("authLinkSuccess"));
  } catch (error) {
    logAuthError("linkWithCredential", error, {
      pendingProviderId: pending.providerId,
      pendingEmail: pending.email
    });
    setStatus(authStatus, t("authLinkFailed"), true);
  }
}

async function handleProviderSignInError(error, provider, fetchSignInMethodsForEmail) {
  logAuthError("signInWithPopup", error, { provider });

  if (error?.code === "auth/account-exists-with-different-credential") {
    try {
      const email = (error.customData?.email || error.email || "").toLowerCase();
      const methods = email ? await fetchSignInMethodsForEmail(authState.auth, email) : [];
      const credential = provider === "microsoft" ? authState.providers.microsoftClass?.credentialFromError(error) : null;

      authState.pendingAuthLink = credential ? {
        email,
        providerId: credential.providerId || "microsoft.com",
        providerName: authProviderLabel(provider),
        credential,
        methods
      } : null;

      if (provider === "microsoft" && methods.includes("google.com")) {
        setAuthError(t("authMicrosoftConflictGoogle"));
        return;
      }

      if (provider === "microsoft" && methods.length === 0) {
        setAuthError(t("authMicrosoftConflictUnknown"));
        return;
      }

      if (methods.length) {
        const message = lang() === "de"
          ? `Diese E-Mail existiert bereits mit ${authMethodList(methods)}. Bitte zuerst damit einloggen und danach ${authProviderLabel(provider)} verknüpfen.`
          : `This email already exists with ${authMethodList(methods)}. Please sign in with that method first, then link ${authProviderLabel(provider)}.`;
        setAuthError(message);
        return;
      }
    } catch (resolverError) {
      logAuthError("fetchSignInMethodsForEmail", resolverError, { provider });
    }
  }

  setAuthError(authMessageForError(error, provider));
}

async function loadUserSummary() {
  if (!authState.idToken) {
    authState.userSummary = null;
    renderUserSummary();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/summary`, {
      headers: { Authorization: `Bearer ${authState.idToken}` }
    });
    if (!response.ok) throw new Error("summary_failed");
    authState.userSummary = await response.json();
  } catch {
    authState.userSummary = null;
  }
  renderUserSummary();
  refreshEventApplicationUi();
}

function ensureUserSummaryHost() {
  let host = document.querySelector("#member-summary-panel");
  if (host) return host;

  if (isAccountPage()) {
    const anchor = document.querySelector(".auth-panel");
    if (!anchor) return null;
    host = document.createElement("section");
    host.id = "member-summary-panel";
    host.className = "summary-panel";
    anchor.insertAdjacentElement("afterend", host);
    return host;
  }

  if (form) {
    host = document.createElement("section");
    host.id = "member-summary-panel";
    host.className = "summary-panel";
    form.insertAdjacentElement("afterend", host);
    return host;
  }

  return null;
}

function renderUserSummary() {
  const host = ensureUserSummaryHost();
  if (!host) return;
  if (!authState.idToken && !authState.isAdmin) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }

  const eventId = currentEventId();
  const registrations = Array.isArray(authState.userSummary?.registrations) ? authState.userSummary.registrations : [];
  const visibleRegistrations = eventId ? registrations.filter((item) => item.eventId === eventId) : registrations;
  const adminRegistrations = eventId ? authState.adminRegistrations.filter((item) => item.eventId === eventId) : [];
  const adminMembers = [];
  const isAdminOverview = isAccountPage() && authState.isAdmin;
  const openAdminCount = (authState.adminRegistrations || []).filter((item) => item.status === "pending_review").length;
  const incompleteCount = (authState.adminRegistrations || []).filter((item) => (item.invitees || []).some((invitee) => invitee.status !== "confirmed")).length;

  host.hidden = false;
  host.innerHTML = `
    <div class="section__heading section__heading--compact">
      <h3>${isAdminOverview ? (lang() === "de" ? "Orga-Übersicht" : "Organizer overview") : (lang() === "de" ? "Dein Status" : "Your status")}</h3>
      <p>${isAdminOverview ? (lang() === "de"
        ? `${openAdminCount} Bewerbungen warten auf Admin-Freigabe, ${incompleteCount} Bewerbungen haben offene Invites/Profile.`
        : `${openAdminCount} applications await admin approval, ${incompleteCount} applications have open invites/profiles.`) : (authState.userSummary?.member ? (lang() === "de"
        ? `Aktuell registrierte andere Nutzer im System: ${Number(authState.userSummary.otherRegisteredCount || 0)}`
        : `Currently registered other users in the system: ${Number(authState.userSummary.otherRegisteredCount || 0)}`) : (lang() === "de" ? "Admin-Sicht auf die aktuelle Teilnehmerliste." : "Admin view of the current participant list."))}</p>
    </div>
    <div class="summary-list">
      ${visibleRegistrations.length
        ? visibleRegistrations.map((item) => `
          <article class="summary-row">
            <strong>${eventDetailUrl(item.eventId) ? `<a href="${escapeHtml(eventDetailUrl(item.eventId))}">${escapeHtml(item.eventLabel || item.eventId)}</a>` : escapeHtml(item.eventLabel || item.eventId)}</strong>
            <span>${escapeHtml(item.role || "")} \u00b7 ${escapeHtml(registrationStatusLabel(item.registrationStatus || ""))}${item.simulated ? " \u00b7 Simulation" : ""}</span>
            ${item.applicant && item.invitees?.length
              ? item.invitees.map((invitee, index) => inviteLine(invitee, index, item.registrationId, item.applicant)).join("")
              : (item.inviteeStatus ? `<span>${lang() === "de" ? "Dein Invite-Status" : "Your invite status"} \u00b7 ${escapeHtml(inviteStatusLabel(item.inviteeStatus))}</span>` : "")}
            ${item.adminStatus && authState.isAdmin ? `<span>Admin \u00b7 ${escapeHtml(item.adminStatus)}</span>` : ""}
            ${(item.canWithdraw || item.canRespondInvite) ? `
              <div class="admin-row__actions">
                ${item.canWithdraw ? `<button class="button button--ghost" type="button" data-user-action="withdraw-registration" data-registration-id="${escapeHtml(item.registrationId)}">${lang() === "de" ? "Bewerbung zurückziehen" : "Withdraw application"}</button>` : ""}
                ${item.canRespondInvite && (item.inviteeStatus === "pending" || item.inviteeStatus === "confirmed_profile_required") ? `<button class="button button--ghost" type="button" data-user-action="confirm-invite" data-registration-id="${escapeHtml(item.registrationId)}">${lang() === "de" ? "Einladung bestätigen" : "Confirm invitation"}</button>` : ""}
                ${item.canRespondInvite && item.inviteeStatus === "pending" ? `<button class="button button--ghost" type="button" data-user-action="reject-invite" data-registration-id="${escapeHtml(item.registrationId)}">${lang() === "de" ? "Einladung ablehnen" : "Decline invitation"}</button>` : ""}
              </div>
            ` : ""}
            ${lateInviteOptions(item).length ? `
              <form class="inline-invite-form" data-add-late-invite data-registration-id="${escapeHtml(item.registrationId)}">
                <input name="email" type="email" placeholder="email@example.com" required>
                <select name="role" required>
                  ${lateInviteOptions(item).map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}
                </select>
                <button class="button button--ghost" type="submit">${lang() === "de" ? "Invite hinzufügen" : "Add invite"}</button>
              </form>
            ` : ""}
          </article>
        `).join("")
        : `<p>${lang() === "de" ? "Noch keine sichtbaren Eventstatus-Einträge." : "No visible event status entries yet."}</p>`}
      ${isAccountPage() && authState.isAdmin ? `
        <div class="section__heading section__heading--compact">
          <h3>${lang() === "de" ? "Registrierte Nutzer" : "Registered users"}</h3>
        </div>
        ${adminMembers.length ? adminMembers.map((member) => `
          <article class="summary-row">
            <strong>${escapeHtml(member.name || member.email)}</strong>
            <span>${escapeHtml(member.email)} · ${escapeHtml(member.role || "")} · ${escapeHtml(member.status || "")}</span>
          </article>
        `).join("") : `<p>${lang() === "de" ? "Keine Nutzer gefunden." : "No users found."}</p>`}
        <div class="admin-member-tools">
          <input type="search" data-admin-member-search placeholder="${lang() === "de" ? "Nutzer suchen" : "Search users"}" value="${escapeHtml(authState.adminMemberSearch)}">
          <div><button class="button button--ghost" type="button" data-admin-member-page="prev">‹</button><span data-admin-member-page-label></span><button class="button button--ghost" type="button" data-admin-member-page="next">›</button></div>
        </div>
        <div class="admin-member-table-wrap"><table class="admin-member-table"><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th></tr></thead><tbody data-admin-member-body></tbody></table></div>
      ` : ""}
      ${authState.isAdmin && adminRegistrations.length ? `
        <div id="event-admin-mount"></div>
      ` : ""}
      ${authState.isAdmin ? `<div class="admin-demo-output" id="event-admin-preview"></div>` : ""}
      <p id="event-user-status" role="status"></p>
    </div>
  `;
  const adminMount = document.querySelector("#event-admin-mount");
  if (adminMount) adminMount.outerHTML = renderEventAdminList(adminRegistrations);
  renderAdminMemberTable();
}

function renderEventAdminList(registrations) {
  return `
    <section class="summary-panel summary-panel--admin">
      <div class="section__heading section__heading--compact">
        <h3>${lang() === "de" ? "Teilnehmerliste" : "Participant list"}</h3>
      </div>
      <div class="summary-list">
        ${registrations.map((item) => {
          const completion = registrationCompletionMeta(item);
          return `
            <article class="summary-row">
              <strong>${escapeHtml(item.name || item.email)}${item.simulated ? " \u00b7 Simulation" : ""}</strong>
              <span>${escapeHtml(item.role || "")} \u00b7 ${escapeHtml(registrationStatusLabel(item.status || ""))}</span>
              <span class="summary-row__completion ${completion.complete ? "is-complete" : "is-incomplete"}">${escapeHtml(completion.label)}</span>
              ${item.invitees?.map((invitee, index) => inviteLine(invitee, index, item.id, true)).join("") || ""}
              ${item.adminStatus ? `<span>Admin \u00b7 ${escapeHtml(item.adminStatus)}</span>` : ""}
              <div class="admin-row__actions">
                <button class="button button--ghost" type="button" data-admin-action="confirm" data-registration-id="${escapeHtml(item.id)}" ${completion.complete ? "" : "disabled"}>${escapeHtml(t("adminConfirm"))}</button>
                <button class="button button--ghost" type="button" data-admin-action="reject" data-registration-id="${escapeHtml(item.id)}">${escapeHtml(t("adminReject"))}</button>
                <button class="button button--ghost" type="button" data-admin-action="undo" data-registration-id="${escapeHtml(item.id)}">${escapeHtml(t("adminUndo"))}</button>
                <button class="button button--ghost" type="button" data-admin-action="delete" data-registration-id="${escapeHtml(item.id)}">Delete</button>
              </div>
            </article>
          `;
        }).join("")}
        <p id="event-admin-status" role="status"></p>
      </div>
    </section>
  `;
}

function renderAdminMemberTable() {
  const body = document.querySelector("[data-admin-member-body]");
  if (!body) return;
  const tools = document.querySelector(".admin-member-tools");
  const oldEmpty = tools?.previousElementSibling;
  if (oldEmpty?.tagName === "P") oldEmpty.remove();
  const pageSize = 10;
  const query = normalizeEmail(authState.adminMemberSearch);
  const members = (authState.adminMembers || []).filter((member) => {
    const haystack = `${member.name || ""} ${member.email || ""} ${member.role || ""} ${member.status || ""}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(members.length / pageSize));
  authState.adminMemberPage = Math.min(authState.adminMemberPage, pageCount - 1);
  const page = members.slice(authState.adminMemberPage * pageSize, (authState.adminMemberPage + 1) * pageSize);
  body.innerHTML = page.length ? page.map((member) => `
    <tr><td>${escapeHtml(member.name || member.email)}</td><td>${escapeHtml(member.email)}</td><td>${escapeHtml(member.role || "")}</td><td>${escapeHtml(member.status || "")}</td></tr>
  `).join("") : `<tr><td colspan="4">${escapeHtml(lang() === "de" ? "Keine Nutzer gefunden." : "No users found.")}</td></tr>`;
  const label = document.querySelector("[data-admin-member-page-label]");
  if (label) label.textContent = `${authState.adminMemberPage + 1}/${pageCount} · ${members.length}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function syncGrabowseeRoleChoices() {
  if (!form || currentEventId() !== "heilstaette-grabowsee-2026-07-04") return;
  const selects = [
    form.elements.eventFunction,
    ...Array.from(form.querySelectorAll('select[name="inviteFunction"]'))
  ].filter(Boolean);
  const selectedPhotographer = selects.find((select) => select.value === "photographer");
  const addButton = document.querySelector("[data-add-invitee]");
  selects.forEach((select) => {
    const modelCountExcludingCurrent = selects.filter((item) => item !== select && item.value === "model").length;
    const photographerOption = Array.from(select.options).find((option) => option.value === "photographer");
    const modelOption = Array.from(select.options).find((option) => option.value === "model");
    const placeholderOption = Array.from(select.options).find((option) => option.value === "");
    const canBePhotographer = Boolean(photographerOption) && !(selectedPhotographer && selectedPhotographer !== select);
    const canBeModel = Boolean(modelOption) && modelCountExcludingCurrent < 3;
    if (photographerOption) photographerOption.disabled = !canBePhotographer;
    if (modelOption) modelOption.disabled = !canBeModel;
    if (placeholderOption) placeholderOption.disabled = canBePhotographer !== canBeModel;
    if (!canBePhotographer && canBeModel) {
      select.value = "model";
      return;
    }
    if (canBePhotographer && !canBeModel) {
      select.value = "photographer";
      return;
    }
    if ((select.value === "photographer" && !canBePhotographer) || (select.value === "model" && !canBeModel)) {
      select.value = canBeModel ? "model" : (canBePhotographer ? "photographer" : "");
    }
  });
  if (addButton) {
    const cards = Array.from(form.querySelectorAll("[data-invitee-card]"));
    addButton.disabled = cards.length >= 3;
  }
}

function clientEventValidation(payload) {
  const emails = [normalizeEmail(payload.email), ...payload.invitedParticipants.map((participant) => normalizeEmail(participant.email))].filter(Boolean);
  if (new Set(emails).size !== emails.length) {
    return lang() === "de" ? "Dieselbe Mailadresse darf in einer Bewerbung nur einmal vorkommen." : "The same email address may only appear once in an application.";
  }

  if (payload.eventId === "heilstaette-grabowsee-2026-07-04") {
    const roles = [payload.eventFunction, ...payload.invitedParticipants.map((participant) => participant.eventFunction)].filter(Boolean);
    const photographerCount = roles.filter((role) => role === "photographer").length;
    const modelCount = roles.filter((role) => role === "model").length;
    if (payload.invitedParticipants.length > 3) {
      return lang() === "de" ? "F\u00fcr Grabowsee sind neben der bewerbenden Person h\u00f6chstens drei weitere Personen m\u00f6glich." : "Grabowsee allows at most three additional participants besides the applicant.";
    }
    if (photographerCount !== 1) {
      return lang() === "de" ? "F\u00fcr Grabowsee ist genau ein:e Fotograf:in erlaubt." : "Grabowsee requires exactly one photographer.";
    }
    if (modelCount < 1 || modelCount > 3) {
      return lang() === "de" ? "F\u00fcr Grabowsee sind genau ein:e Fotograf:in und ein bis drei Models m\u00f6glich." : "Grabowsee requires exactly one photographer and one to three models.";
    }
  }

  const existingRows = authState.isAdmin
    ? authState.adminRegistrations.filter((item) => item.eventId === payload.eventId)
    : (authState.userSummary?.registrations || []).filter((item) => item.eventId === payload.eventId);
  const existingEmails = new Set(existingRows.flatMap((item) => [
    normalizeEmail(item.email),
    ...(item.invitees || []).map((invitee) => normalizeEmail(invitee.email))
  ]).filter(Boolean));
  if (emails.some((email) => existingEmails.has(email))) {
    return lang() === "de" ? "Mindestens eine Mailadresse ist f\u00fcr dieses Event bereits registriert." : "At least one email address is already registered for this event.";
  }

  return "";
}

async function handleFirebaseUser(user) {
  authState.idToken = await user.getIdToken();
  authState.profile = {
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || "",
    provider: user.providerData[0]?.providerId || ""
  };
  authState.member = await loadMemberProfile();
  authState.profileComplete = Boolean(authState.member);

  if (form) {
    syncEventApplicantFields();
  }
  if (authState.member) {
    applyMemberProfile(authState.member);
    localStorage.setItem(profileStorageKey(authState.profile.uid), "true");
  } else if (profileForm?.elements.displayName && !profileForm.elements.displayName.value) {
    profileForm.elements.displayName.value = authState.profile.name || "";
  }
  authState.adminBaseEmail = localStorage.getItem(ADMIN_BASE_EMAIL_KEY) || (isGmailAddress(authState.profile.email) ? authState.profile.email : "");
  authState.impersonation = loadStoredAdminSimulation();
  refreshAuthUi();
  await loadAdminPanel();
  await loadUserSummary();
  await finalizePendingAuthLink(user, authState.firebaseHelpers?.linkWithCredential);
  renderSimulationNotice();
  applySimulationToEventForm();

  if (isAccountPage() && authState.profileComplete) {
    const nextTarget = accountNextTarget();
    if (nextTarget) {
      window.location.href = nextTarget;
      return;
    }
  }

  if (!authState.profileComplete && !adminSimulationActive() && !isAccountPage()) {
    window.location.href = "account.html#profile-form";
  }
}

function handleSignedOutState() {
  authState.idToken = "";
  authState.profile = null;
  authState.member = null;
  authState.userSummary = null;
  authState.profileComplete = false;
  authState.isAdmin = false;

  if (profileForm) {
    profileForm.hidden = true;
  }
  if (profileLocked) {
    profileLocked.hidden = false;
  }

  authState.pendingAuthLink = null;
  refreshAuthUi();
  renderUserSummary();
  removeAdminFlyout();
  if (adminPanel) adminPanel.hidden = true;
  syncAccountAdminTab();
  setAdminAccessNote("", false);
}

function renderAdminRegistrations(registrations) {
  if (!adminList) return;
  if (isAccountPage()) {
    adminList.innerHTML = `<p>${escapeHtml(lang() === "de" ? "Bewerbungen werden direkt auf der jeweiligen Eventseite verwaltet." : "Applications are managed directly on the corresponding event page.")}</p>`;
    return;
  }
  if (!registrations.length) {
    adminList.innerHTML = `<p>${escapeHtml(t("adminNoRegistrations"))}</p>`;
    return;
  }

  adminList.innerHTML = registrations.map((item) => `
    <article class="admin-row">
      <div>
        <strong>${escapeHtml(item.name || item.email)}</strong>
        <span>${escapeHtml(item.eventId)} \u00b7 ${escapeHtml(item.role)} \u00b7 ${escapeHtml(item.status)}</span>
        ${item.invitees?.length
          ? item.invitees.map((invitee) => `<span>Invite: ${escapeHtml(invitee.name || invitee.email)} \u00b7 ${escapeHtml(invitee.role || "open")} \u00b7 ${escapeHtml(invitee.status || "pending")}</span>`).join("")
          : (item.partnerEmail ? `<span>Partner: ${escapeHtml(item.partnerName || item.partnerEmail)} \u00b7 ${escapeHtml(item.partnerStatus || "pending")}</span>` : "")}
      </div>
      <div class="admin-row__actions">
        <button class="button button--ghost" type="button" data-admin-action="confirm" data-registration-id="${escapeHtml(item.id)}">${escapeHtml(t("adminConfirm"))}</button>
        <button class="button button--ghost" type="button" data-admin-action="reject" data-registration-id="${escapeHtml(item.id)}">${escapeHtml(t("adminReject"))}</button>
        <button class="button button--ghost" type="button" data-admin-action="undo" data-registration-id="${escapeHtml(item.id)}">${escapeHtml(t("adminUndo"))}</button>
        <button class="button button--ghost" type="button" data-admin-action="delete" data-registration-id="${escapeHtml(item.id)}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderDemoMailPreviews(previews, target = adminDemoOutput) {
  if (!target) return;
  if (!previews?.length) {
    target.innerHTML = "";
    return;
  }

  target.innerHTML = previews.map((preview) => `
    <article class="admin-mail-preview">
      <div>
        <strong>${escapeHtml(preview.kind)} \u00b7 ${escapeHtml(preview.to)}</strong>
        <span>${escapeHtml(preview.subject)}</span>
      </div>
      <pre>${escapeHtml(preview.text)}</pre>
      <div class="admin-row__actions">
        ${(preview.links || []).map((link) => `<a class="button button--ghost" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`).join("")}
      </div>
    </article>
  `).join("");
}

function setAdminAccessNote(message, visible = true) {
  if (!adminAccessNote || !adminAccessCopy) return;
  adminAccessCopy.textContent = message;
  adminAccessNote.hidden = !visible;
}

function currentAdminStatusTarget(trigger) {
  return trigger?.closest("#member-summary-panel")?.querySelector("#event-admin-status") || adminStatus;
}

async function adminPost(payload) {
  const response = await fetch(`${API_BASE}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, idToken: authState.idToken })
  });
  if (!response.ok) throw new Error("admin_failed");
  return response.json();
}

async function userSummaryPost(payload) {
  const response = await fetch(`${API_BASE}/api/summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authState.idToken}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "summary_action_failed");
    error.payload = result;
    throw error;
  }
  return result;
}

async function loadAdminPanel() {
  if (!authState.idToken) return;

  try {
    const response = await fetch(`${API_BASE}/api/admin`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${authState.idToken}` }
    });
    if (response.status === 403) {
      authState.isAdmin = false;
      if (adminPanel) adminPanel.hidden = true;
      removeAdminFlyout();
      syncAccountAdminTab();
      setAdminAccessNote(`Angemeldet als ${authState.profile?.email || "unbekannt"}, aber diese Adresse ist serverseitig nicht in ADMIN_EMAILS freigeschaltet.`);
      return;
    }
    if (!response.ok) {
      authState.isAdmin = false;
      if (adminPanel) adminPanel.hidden = true;
      removeAdminFlyout();
      syncAccountAdminTab();
      setAdminAccessNote("Admin-Status konnte nicht geladen werden. Prüfe API-Domain, Deployment und ADMIN_EMAILS.");
      return;
    }
    const payload = await response.json();
    authState.isAdmin = Boolean(payload.admin);
    authState.adminRegistrations = payload.registrations || [];
    authState.adminMembers = payload.members || [];
    if (adminPanel) adminPanel.hidden = !payload.admin;
    setAdminAccessNote("", false);
    syncAccountAdminTab();
    renderAdminRegistrations(payload.registrations || []);
    ensureAdminFlyout();
    renderUserSummary();
  } catch {
    authState.isAdmin = false;
    authState.adminRegistrations = [];
    if (adminPanel) adminPanel.hidden = true;
    removeAdminFlyout();
    syncAccountAdminTab();
    setAdminAccessNote("Admin-Status konnte nicht geladen werden. Prüfe API-Erreichbarkeit und Deployment.");
  }
}

function refreshAuthUi() {
  const isSignedIn = Boolean(authState.profile?.email);
  const email = authState.profile?.email || "";
  const signedInMessage = isSignedIn ? `${t("signedInAs")} ${email}` : t("authFlyoutSignedOut");
  const memberStatus = !isSignedIn
    ? ""
    : (authState.profileComplete ? t("memberStatusRegistered") : t("memberStatusNeedsProfile"));
  const profileMessage = isSignedIn
    ? (authState.profileComplete ? t("accountFlowComplete") : t("accountFlowIncomplete"))
    : t("accountFlowCopy");

  setStatus(topbarAuthStatus, signedInMessage);
  setStatus(authStatus, isSignedIn ? profileMessage : t("authFlyoutSignedOut"));
  if (topbarMemberStatus) {
    topbarMemberStatus.hidden = !memberStatus;
    topbarMemberStatus.textContent = memberStatus;
  }

  logoutButtons.forEach((button) => {
    button.hidden = !isSignedIn;
  });

  authButtons.forEach((button) => {
    button.hidden = isSignedIn;
  });
  authButtonSections.forEach((section) => {
    section.hidden = isSignedIn;
  });

  accountProfileLinks.forEach((link) => {
    link.textContent = isSignedIn
      ? (authState.profileComplete ? t("accountFlyoutProfile") : t("accountFlyoutCompleteProfile"))
      : t("accountFlyoutRegister");
    link.classList.toggle("button--primary", isSignedIn && !authState.profileComplete);
    link.classList.toggle("button--ghost", !isSignedIn || authState.profileComplete);
    link.href = isSignedIn && !authState.profileComplete ? "account.html#profile-form" : "account.html";
  });

  accountStages.forEach((stage) => {
    const name = stage.dataset.accountStage;
    let state = "locked";
    if (name === "profile") state = isSignedIn && !authState.profileComplete ? "current" : (authState.profileComplete ? "done" : "locked");
    if (name === "registered") state = authState.profileComplete ? "current" : "locked";
    if (name === "confirmed") state = "locked";
    stage.dataset.state = state;
  });

  if (profileForm) {
    profileForm.hidden = !isSignedIn;
  }
  if (profileLocked) {
    profileLocked.hidden = isSignedIn;
  }

  refreshLandingCtas();
  refreshEventApplicationUi();
}

async function initFirebaseLogin() {
  if (!authButtons.length) {
    return;
  }

  authState.config = await loadAuthConfig();
  const firebaseConfig = authState.config?.firebase || {};
  const hasFirebaseConfig = firebaseConfig.apiKey
    && firebaseConfig.authDomain
    && firebaseConfig.projectId
    && firebaseConfig.appId;

  if (!hasFirebaseConfig) {
    authButtons.forEach((button) => { button.disabled = true; });
    setStatus(topbarAuthStatus, t("authUnavailable"), true);
    setStatus(authStatus, t("authUnavailable"), true);
    return;
  }

  try {
    const [{ initializeApp }, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
    ]);
    const {
      fetchSignInMethodsForEmail,
      getAuth,
      GoogleAuthProvider,
      linkWithCredential,
      OAuthProvider,
      onAuthStateChanged,
      signOut,
      signInWithPopup
    } = authModule;

    const app = initializeApp(firebaseConfig);
    authState.auth = getAuth(app);
    authState.firebaseHelpers = { linkWithCredential };
    authState.providers = {
      google: new GoogleAuthProvider(),
      microsoft: new OAuthProvider("microsoft.com"),
      microsoftClass: OAuthProvider
    };

    const enabledProviders = authState.config.authProviders || [];
    authButtons.forEach((button) => {
      const provider = button.dataset.authProvider;
      button.disabled = !enabledProviders.includes(provider);
      button.addEventListener("click", async () => {
        try {
          const result = await signInWithPopup(authState.auth, authState.providers[provider]);
          await handleFirebaseUser(result.user);
          closeAccountMenu();
        } catch (error) {
          await handleProviderSignInError(error, provider, fetchSignInMethodsForEmail);
        }
      });
    });

    logoutButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await signOut(authState.auth);
          closeAccountMenu();
        } catch (error) {
          logAuthError("signOut", error);
          setStatus(topbarAuthStatus, t("authSignOutError"), true);
        }
      });
    });

    onAuthStateChanged(authState.auth, async (user) => {
      if (user) {
        await handleFirebaseUser(user);
        return;
      }
      handleSignedOutState();
    });

    refreshAuthUi();
  } catch (error) {
    logAuthError("initFirebaseLogin", error);
    authButtons.forEach((button) => { button.disabled = true; });
    setStatus(topbarAuthStatus, t("authUnavailable"), true);
    setStatus(authStatus, t("authUnavailable"), true);
  }
}

function payloadFromProfileForm(formElement) {
  const data = new FormData(formElement);
  return {
    idToken: authState.idToken,
    displayName: data.get("displayName"),
    functions: data.getAll("functions"),
    instagram: data.get("instagram"),
    portfolio: data.get("portfolio"),
    futureUpdates: data.get("futureUpdates") === "on",
    lobbyInfo: data.get("lobbyInfo") === "on",
    discoverable: data.get("discoverable") === "on",
    discoverableName: data.get("discoverableName"),
    discoverableIntro: data.get("discoverableIntro"),
    communityConsent: data.get("communityConsent") === "on",
    communityPrivacy: data.get("communityPrivacy") === "on"
  };
}

function hasSelectedProfileFunction(formElement) {
  return formElement.querySelectorAll('input[name="functions"]:checked').length > 0;
}

function inviteesFromEventForm(formElement) {
  return Array.from(formElement.querySelectorAll("[data-invitee-card]"))
    .map((card) => ({
      name: "",
      email: card.querySelector('[name="inviteEmail"]')?.value || "",
      instagram: "",
      eventFunction: card.querySelector('[name="inviteFunction"]')?.value || ""
    }))
    .filter((invitee) => invitee.email || invitee.eventFunction);
}

function payloadFromEventForm(formElement) {
  const data = new FormData(formElement);
  const invitedParticipants = inviteesFromEventForm(formElement);
  const applicant = currentApplicantData();
  return {
    idToken: authState.idToken,
    eventId: data.get("eventId"),
    eventFunction: data.get("eventFunction"),
    name: applicant.name,
    email: applicant.email,
    instagram: applicant.instagram,
    portfolio: applicant.portfolio,
    partnerName: invitedParticipants[0]?.name || "",
    partnerEmail: invitedParticipants[0]?.email || "",
    partnerInstagram: invitedParticipants[0]?.instagram || "",
    partnerFunction: invitedParticipants[0]?.eventFunction || "",
    invitedParticipants,
    pairing: data.get("pairing"),
    notes: data.get("notes"),
    website: data.get("website"),
    consent: data.get("consent") === "on",
    privacy: data.get("privacy") === "on",
    partnerNotice: data.get("partnerNotice") === "on",
    whatsappIntent: true
  };
}

function initInviteeControls() {
  const list = document.querySelector("[data-invitee-list]");
  const addButton = document.querySelector("[data-add-invitee]");
  const firstCard = document.querySelector("[data-invitee-card]");
  if (!list || !addButton || !firstCard) return;

  function updateRemoveButtons() {
    const cards = Array.from(list.querySelectorAll("[data-invitee-card]"));
    cards.forEach((card) => {
      const button = card.querySelector("[data-remove-invitee]");
      if (button) button.hidden = cards.length === 1;
    });
    addButton.disabled = currentEventId() === "heilstaette-grabowsee-2026-07-04" ? cards.length >= 3 : cards.length >= 6;
    syncGrabowseeRoleChoices();
  }

  addButton.addEventListener("click", () => {
    const clone = firstCard.cloneNode(true);
    clone.querySelectorAll("input").forEach((input) => { input.value = ""; });
    clone.querySelectorAll("select").forEach((select) => { select.selectedIndex = 0; });
    list.insertBefore(clone, addButton);
    updateRemoveButtons();
  });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-invitee]");
    if (!button) return;
    const cards = Array.from(list.querySelectorAll("[data-invitee-card]"));
    if (cards.length <= 1) return;
    button.closest("[data-invitee-card]")?.remove();
    updateRemoveButtons();
  });

  list.addEventListener("change", syncGrabowseeRoleChoices);
  form?.elements?.eventFunction?.addEventListener("change", syncGrabowseeRoleChoices);

  updateRemoveButtons();
}

function resetInviteeControls() {
  const cards = Array.from(document.querySelectorAll("[data-invitee-card]"));
  cards.slice(1).forEach((card) => card.remove());
  cards[0]?.querySelector("[data-remove-invitee]")?.setAttribute("hidden", "");
  const addButton = document.querySelector("[data-add-invitee]");
  if (addButton) addButton.disabled = false;
  syncGrabowseeRoleChoices();
}

function eventPreviewTarget() {
  return document.querySelector("#event-admin-preview");
}

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!authState.idToken) {
    setStatus(profileStatus, t("mustLogin"), true);
    return;
  }

  if (!profileForm.checkValidity()) {
    profileForm.reportValidity();
    return;
  }

  if (!hasSelectedProfileFunction(profileForm)) {
    setStatus(profileStatus, t("functionsRequired"), true);
    return;
  }

  const submitButton = profileForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  setStatus(profileStatus, t("sending"));

  try {
    const response = await fetch(`${API_BASE}/api/member`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromProfileForm(profileForm))
    });

    if (!response.ok) throw new Error("member_failed");
    authState.member = payloadFromProfileForm(profileForm);
    if (authState.profile?.uid) {
      localStorage.setItem(profileStorageKey(authState.profile.uid), "true");
      authState.profileComplete = true;
      refreshAuthUi();
    }
    setStatus(profileStatus, t("profileSaved"));
    const nextTarget = accountNextTarget();
    if (nextTarget) {
      window.location.href = nextTarget;
      return;
    }
  } catch {
    setStatus(profileStatus, t("signupError"), true);
  } finally {
    submitButton.disabled = false;
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!authState.idToken) {
    setStatus(formStatus, t("mustLogin"), true);
    return;
  }

  if (!adminSimulationActive() && !authState.profileComplete) {
    setStatus(formStatus, t("accountFlowIncomplete"), true);
    if (!isAccountPage()) window.location.href = "account.html#profile-form";
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  setStatus(formStatus, t("sending"));

  try {
    const formPayload = payloadFromEventForm(form);
    const clientError = clientEventValidation(formPayload);
    if (clientError) {
      setStatus(formStatus, clientError, true);
      return;
    }
    let payload;

    if (adminSimulationActive()) {
      payload = await adminPost({
        action: "create-simulated-registration",
        payload: formPayload,
        simulation: authState.impersonation,
        createProfiles: document.querySelector("#admin-flyout-create-profiles")?.checked === true,
        sendDemoMail: document.querySelector("#admin-flyout-send-mails")?.checked === true
      });
      renderDemoMailPreviews(payload.simulation?.previews || [], eventPreviewTarget());
    } else {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload)
      });
      payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "registration_failed");
      }
    }

    form.reset();
    resetInviteeControls();
    if (adminSimulationActive()) {
      applySimulationToEventForm();
      setStatus(formStatus, `Admin-Simulation erstellt: ${payload.simulation?.id || ""}`);
    } else if (authState.profile) {
      syncEventApplicantFields();
      setStatus(formStatus, `${t("signupSuccess")} Referenz: ${payload.registrationId}`);
    }
    await loadAdminPanel();
    await loadUserSummary();
  } catch {
    setStatus(formStatus, t("signupError"), true);
  } finally {
    submitButton.disabled = false;
  }
});

document.addEventListener("submit", async (event) => {
  const correctionForm = event.target.closest("[data-update-invite-email]");
  if (correctionForm) {
    event.preventDefault();
    const button = correctionForm.querySelector("button[type='submit']");
    button.disabled = true;
    const statusTarget = document.querySelector("#event-user-status") || formStatus;
    setStatus(statusTarget, t("sending"));
    try {
      const result = await userSummaryPost({
        action: "update-invite-email",
        registrationId: correctionForm.dataset.registrationId,
        inviteIndex: correctionForm.dataset.inviteIndex,
        email: correctionForm.elements.email.value
      });
      setStatus(statusTarget, userActionStatusMessage("update-invite-email", result.status) || "OK");
      await loadUserSummary();
      await loadAdminPanel();
    } catch {
      setStatus(statusTarget, t("signupError"), true);
    } finally {
      button.disabled = false;
    }
    return;
  }

  const inviteForm = event.target.closest("[data-add-late-invite]");
  if (!inviteForm) return;
  event.preventDefault();
  const button = inviteForm.querySelector("button[type='submit']");
  button.disabled = true;
  const statusTarget = document.querySelector("#event-user-status") || formStatus;
  setStatus(statusTarget, t("sending"));
  try {
    const result = await userSummaryPost({
      action: "add-invite",
      registrationId: inviteForm.dataset.registrationId,
      email: inviteForm.elements.email.value,
      role: inviteForm.elements.role.value
    });
    setStatus(statusTarget, userActionStatusMessage("add-invite", result.status) || "OK");
    await loadUserSummary();
    await loadAdminPanel();
  } catch {
    setStatus(statusTarget, t("signupError"), true);
  } finally {
    button.disabled = false;
  }
});

document.addEventListener("input", (event) => {
  const input = event.target.closest("[data-admin-member-search]");
  if (!input) return;
  authState.adminMemberSearch = input.value;
  authState.adminMemberPage = 0;
  renderAdminMemberTable();
});

document.addEventListener("click", async (event) => {
  const pageButton = event.target.closest("[data-admin-member-page]");
  if (pageButton) {
    authState.adminMemberPage += pageButton.dataset.adminMemberPage === "next" ? 1 : -1;
    if (authState.adminMemberPage < 0) authState.adminMemberPage = 0;
    renderAdminMemberTable();
    return;
  }

  const userButton = event.target.closest("[data-user-action]");
  if (userButton) {
    userButton.disabled = true;
    const statusTarget = document.querySelector("#event-user-status") || formStatus;
    setStatus(statusTarget, t("sending"));
    try {
      const result = await userSummaryPost({
        action: userButton.dataset.userAction,
        registrationId: userButton.dataset.registrationId
      });
      setStatus(statusTarget, userActionStatusMessage(userButton.dataset.userAction, result.status) || (lang() === "de" ? "Status aktualisiert." : "Status updated."));
      await loadUserSummary();
      await loadAdminPanel();
    } catch {
      setStatus(statusTarget, t("signupError"), true);
    } finally {
      userButton.disabled = false;
    }
    return;
  }

  const button = event.target.closest("[data-admin-action]");
  if (!button) return;

  button.disabled = true;
  const statusTarget = currentAdminStatusTarget(button);
  setStatus(statusTarget, t("sending"));
  try {
    await adminPost({
      action: button.dataset.adminAction,
      registrationId: button.dataset.registrationId
    });
    setStatus(statusTarget, t("adminSaved"));
    await loadAdminPanel();
    await loadUserSummary();
  } catch {
    setStatus(statusTarget, t("signupError"), true);
  } finally {
    button.disabled = false;
  }
});

adminDeleteMember?.addEventListener("click", async () => {
  if (!adminDeleteEmail?.value) return;

  adminDeleteMember.disabled = true;
  setStatus(adminStatus, t("sending"));
  try {
    await adminPost({
      action: "delete-member",
      email: adminDeleteEmail.value
    });
    adminDeleteEmail.value = "";
    setStatus(adminStatus, t("adminSaved"));
  } catch {
    setStatus(adminStatus, t("signupError"), true);
  } finally {
    adminDeleteMember.disabled = false;
  }
});

adminCreateDemo?.addEventListener("click", async () => {
  if (!adminDemoEmail?.value) return;

  adminCreateDemo.disabled = true;
  setStatus(adminStatus, t("sending"));
  try {
    const payload = await adminPost({
      action: "create-demo-registration",
      baseEmail: adminDemoEmail.value,
      inviteCount: adminDemoCount?.value || 2,
      createProfiles: adminDemoProfiles?.checked === true,
      sendDemoMail: adminDemoSend?.checked === true,
      eventId: "heilstaette-grabowsee-2026-07-04"
    });
    renderDemoMailPreviews(payload.demo?.previews || []);
    renderDemoMailPreviews(payload.demo?.previews || [], eventPreviewTarget());
    setStatus(adminStatus, `Test-Eventregistrierung erstellt: ${payload.demo?.id || ""}`);
    await loadAdminPanel();
    renderUserSummary();
  } catch {
    setStatus(adminStatus, t("signupError"), true);
  } finally {
    adminCreateDemo.disabled = false;
  }
});

window.addEventListener("bcb:languagechange", () => {
  if (eventsCache.length) renderEvents(eventsCache);
  syncAccountTabLabels();
  refreshAuthUi();
  renderUserSummary();
  renderAdminFlyout();
  renderSimulationNotice();
});

initMenu();
initAccountMenu();
initContactFlyout();
initAccountTabs();
initInviteeControls();
loadEvents().then(renderEvents);
initFirebaseLogin();
renderRegistrationActionNotice();

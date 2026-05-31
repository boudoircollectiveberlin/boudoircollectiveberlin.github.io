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

let eventsCache = [];
let authState = {
  idToken: "",
  profile: null,
  member: null,
  config: null,
  auth: null,
  providers: {},
  profileComplete: false
};

function isAccountPage() {
  return window.location.pathname.endsWith("/account.html") || window.location.pathname.endsWith("account.html");
}

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
    form.elements.email.value = authState.profile.email || "";
    form.elements.name.value = authState.profile.name || "";
  }
  if (authState.member) {
    applyMemberProfile(authState.member);
    localStorage.setItem(profileStorageKey(authState.profile.uid), "true");
  } else if (profileForm?.elements.displayName && !profileForm.elements.displayName.value) {
    profileForm.elements.displayName.value = authState.profile.name || "";
  }
  refreshAuthUi();
  loadAdminPanel();

  if (!authState.profileComplete && !isAccountPage()) {
    window.location.href = "account.html#profile-form";
  }
}

function handleSignedOutState() {
  authState.idToken = "";
  authState.profile = null;
  authState.member = null;
  authState.profileComplete = false;

  if (profileForm) {
    profileForm.hidden = true;
  }
  if (profileLocked) {
    profileLocked.hidden = false;
  }

  refreshAuthUi();
  if (adminPanel) adminPanel.hidden = true;
  setAdminAccessNote("", false);
}

function renderAdminRegistrations(registrations) {
  if (!adminList) return;
  if (!registrations.length) {
    adminList.innerHTML = `<p>${escapeHtml(t("adminNoRegistrations"))}</p>`;
    return;
  }

  adminList.innerHTML = registrations.map((item) => `
    <article class="admin-row">
      <div>
        <strong>${escapeHtml(item.name || item.email)}</strong>
        <span>${escapeHtml(item.eventId)} · ${escapeHtml(item.role)} · ${escapeHtml(item.status)}</span>
        ${item.invitees?.length
          ? item.invitees.map((invitee) => `<span>Invite: ${escapeHtml(invitee.name || invitee.email)} · ${escapeHtml(invitee.role || "open")} · ${escapeHtml(invitee.status || "pending")}</span>`).join("")
          : (item.partnerEmail ? `<span>Partner: ${escapeHtml(item.partnerName || item.partnerEmail)} · ${escapeHtml(item.partnerStatus || "pending")}</span>` : "")}
      </div>
      <div class="admin-row__actions">
        <button class="button button--ghost" type="button" data-admin-action="confirm" data-registration-id="${escapeHtml(item.id)}">${escapeHtml(t("adminConfirm"))}</button>
        <button class="button button--ghost" type="button" data-admin-action="reject" data-registration-id="${escapeHtml(item.id)}">${escapeHtml(t("adminReject"))}</button>
        <button class="button button--ghost" type="button" data-admin-action="undo" data-registration-id="${escapeHtml(item.id)}">${escapeHtml(t("adminUndo"))}</button>
      </div>
    </article>
  `).join("");
}

function renderDemoMailPreviews(previews) {
  if (!adminDemoOutput) return;
  if (!previews?.length) {
    adminDemoOutput.innerHTML = "";
    return;
  }

  adminDemoOutput.innerHTML = previews.map((preview) => `
    <article class="admin-mail-preview">
      <div>
        <strong>${escapeHtml(preview.kind)} · ${escapeHtml(preview.to)}</strong>
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

async function adminPost(payload) {
  const response = await fetch(`${API_BASE}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, idToken: authState.idToken })
  });
  if (!response.ok) throw new Error("admin_failed");
  return response.json();
}

async function loadAdminPanel() {
  if (!adminPanel || !authState.idToken) return;

  try {
    const response = await fetch(`${API_BASE}/api/admin`, {
      headers: { Authorization: `Bearer ${authState.idToken}` }
    });
    if (response.status === 403) {
      adminPanel.hidden = true;
      setAdminAccessNote(`Angemeldet als ${authState.profile?.email || "unbekannt"}, aber diese Adresse ist serverseitig nicht in ADMIN_EMAILS freigeschaltet.`);
      return;
    }
    if (!response.ok) {
      adminPanel.hidden = true;
      setAdminAccessNote("Admin-Status konnte nicht geladen werden. Pruefe API-Domain, Deployment und ADMIN_EMAILS.");
      return;
    }
    const payload = await response.json();
    adminPanel.hidden = !payload.admin;
    setAdminAccessNote("", false);
    renderAdminRegistrations(payload.registrations || []);
  } catch {
    adminPanel.hidden = true;
    setAdminAccessNote("Admin-Status konnte nicht geladen werden. Pruefe API-Erreichbarkeit und Deployment.");
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
      getAuth,
      GithubAuthProvider,
      GoogleAuthProvider,
      OAuthProvider,
      onAuthStateChanged,
      signOut,
      signInWithPopup
    } = authModule;

    const app = initializeApp(firebaseConfig);
    authState.auth = getAuth(app);
    authState.providers = {
      google: new GoogleAuthProvider(),
      microsoft: new OAuthProvider("microsoft.com"),
      github: new GithubAuthProvider()
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
        } catch {
          setStatus(authStatus, t("signupError"), true);
          setStatus(topbarAuthStatus, t("signupError"), true);
        }
      });
    });

    logoutButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await signOut(authState.auth);
          closeAccountMenu();
        } catch {
          setStatus(topbarAuthStatus, t("signupError"), true);
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
  } catch {
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
  return {
    idToken: authState.idToken,
    eventId: data.get("eventId"),
    eventFunction: data.get("eventFunction"),
    name: data.get("name"),
    email: data.get("email"),
    instagram: data.get("instagram"),
    portfolio: data.get("portfolio"),
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
    addButton.disabled = cards.length >= 6;
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

  updateRemoveButtons();
}

function resetInviteeControls() {
  const cards = Array.from(document.querySelectorAll("[data-invitee-card]"));
  cards.slice(1).forEach((card) => card.remove());
  cards[0]?.querySelector("[data-remove-invitee]")?.setAttribute("hidden", "");
  const addButton = document.querySelector("[data-add-invitee]");
  if (addButton) addButton.disabled = false;
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

  if (!authState.profileComplete) {
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
    const response = await fetch(`${API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromEventForm(form))
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "registration_failed");
    }

    form.reset();
    resetInviteeControls();
    if (authState.profile) {
      form.elements.email.value = authState.profile.email || "";
      form.elements.name.value = authState.profile.name || "";
    }
    setStatus(formStatus, `${t("signupSuccess")} Referenz: ${payload.registrationId}`);
  } catch {
    setStatus(formStatus, t("signupError"), true);
  } finally {
    submitButton.disabled = false;
  }
});

adminList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;

  button.disabled = true;
  setStatus(adminStatus, t("sending"));
  try {
    await adminPost({
      action: button.dataset.adminAction,
      registrationId: button.dataset.registrationId
    });
    setStatus(adminStatus, t("adminSaved"));
    await loadAdminPanel();
  } catch {
    setStatus(adminStatus, t("signupError"), true);
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
    setStatus(adminStatus, `Demo erstellt: ${payload.demo?.id || ""}`);
    await loadAdminPanel();
  } catch {
    setStatus(adminStatus, t("signupError"), true);
  } finally {
    adminCreateDemo.disabled = false;
  }
});

window.addEventListener("bcb:languagechange", () => {
  if (eventsCache.length) renderEvents(eventsCache);
  refreshAuthUi();
});

initMenu();
initAccountMenu();
initContactFlyout();
initInviteeControls();
loadEvents().then(renderEvents);
initFirebaseLogin();

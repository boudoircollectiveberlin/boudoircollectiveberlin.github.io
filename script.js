const API_BASE = window.BCB_API_BASE || "";

const upcomingEventGrid = document.querySelector("#upcoming-event-grid");
const pastEventGrid = document.querySelector("#past-event-grid");
const eventSelect = document.querySelector("#event-select");
const form = document.querySelector("#register-form");
const profileForm = document.querySelector("#profile-form");
const formStatus = document.querySelector("#form-status");
const profileStatus = document.querySelector("#profile-status");
const authStatus = document.querySelector("#auth-status");
const authButtons = Array.from(document.querySelectorAll("[data-auth-provider]"));
const menuToggle = document.querySelector("[data-menu-toggle]");
const topbar = document.querySelector(".topbar");

let eventsCache = [];
let authState = {
  idToken: "",
  profile: null,
  config: null,
  auth: null,
  providers: {}
};

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

  if (form) {
    form.elements.email.value = authState.profile.email || "";
    form.elements.name.value = authState.profile.name || "";
  }
  if (profileForm?.elements.displayName && !profileForm.elements.displayName.value) {
    profileForm.elements.displayName.value = authState.profile.name || "";
  }
  setStatus(authStatus, `${t("signedInAs")} ${authState.profile.email}`);
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
        } catch {
          setStatus(authStatus, t("signupError"), true);
        }
      });
    });

    onAuthStateChanged(authState.auth, async (user) => {
      if (user) await handleFirebaseUser(user);
    });

    setStatus(authStatus, "");
  } catch {
    authButtons.forEach((button) => { button.disabled = true; });
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
    communityConsent: data.get("communityConsent") === "on",
    communityPrivacy: data.get("communityPrivacy") === "on"
  };
}

function hasSelectedProfileFunction(formElement) {
  return formElement.querySelectorAll('input[name="functions"]:checked').length > 0;
}

function payloadFromEventForm(formElement) {
  const data = new FormData(formElement);
  return {
    idToken: authState.idToken,
    eventId: data.get("eventId"),
    eventFunction: data.get("eventFunction"),
    name: data.get("name"),
    email: data.get("email"),
    instagram: data.get("instagram"),
    portfolio: data.get("portfolio"),
    partnerName: data.get("partnerName"),
    partnerEmail: data.get("partnerEmail"),
    partnerInstagram: data.get("partnerInstagram"),
    partnerFunction: data.get("partnerFunction"),
    pairing: data.get("pairing"),
    notes: data.get("notes"),
    website: data.get("website"),
    consent: data.get("consent") === "on",
    privacy: data.get("privacy") === "on",
    partnerNotice: data.get("partnerNotice") === "on",
    whatsappIntent: true
  };
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

window.addEventListener("bcb:languagechange", () => {
  if (eventsCache.length) renderEvents(eventsCache);
});

initMenu();
initContactFlyout();
loadEvents().then(renderEvents);
initFirebaseLogin();

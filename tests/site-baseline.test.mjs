import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { validate } from "../api/register.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(join(root, file), "utf8");

test("all tracked public routes retain their primary structures and locale controls", async () => {
  const routes = [
    ["index.html", ["id=\"events\"", "id=\"codex\"", "id=\"contact\""]],
    ["account.html", ["id=\"profile-form\"", "data-account-tab=\"admin\"", "data-auth-provider=\"google\""]],
    ["event-grabowsee.html", ["id=\"application\"", "id=\"location-reference\"", "id=\"register-form\""]],
    ["event-wrodow.html", ["id=\"application\"", "id=\"location-reference\"", "id=\"register-form\""]],
    ["legal.html", ["id=\"imprint\"", "id=\"privacy\""]],
  ];

  for (const [route, requiredContent] of routes) {
    const html = await read(route);
    assert.match(html, /^<!doctype html>/i, `${route} remains a complete HTML document`);
    assert.match(html, /<html lang="de">/i, `${route} has a German default locale`);
    assert.match(html, /<h1\b/i, `${route} has a primary heading`);
    assert.match(html, /data-lang="de"/, `${route} can select German`);
    assert.match(html, /data-lang="en"/, `${route} can select English`);
    for (const marker of requiredContent)
      assert.ok(html.includes(marker), `${route} retains ${marker}`);
  }
});

test("public event records resolve to preserved localized detail routes", async () => {
  const { events } = JSON.parse(await read("data/events.json"));
  assert.ok(Array.isArray(events));
  for (const event of events) {
    assert.ok(event.id, "event has a stable ID");
    assert.ok(event.title?.de && event.title?.en, `${event.id} has bilingual titles`);
    assert.ok(event.summary?.de && event.summary?.en, `${event.id} has bilingual summaries`);
    if (!event.detailUrl) continue;
    const detail = await read(event.detailUrl);
    assert.match(detail, /<h1\b/i);
    assert.match(detail, /id="application"/);
    assert.match(detail, /id="register-form"/);
  }
});

test("German and English dictionaries contain the same keys", async () => {
  const source = await read("i18n.js");
  const window = { dispatchEvent() {} };
  const document = {
    documentElement: { lang: "de" },
    addEventListener() {},
    querySelectorAll() { return []; },
  };
  const context = {
    window,
    document,
    localStorage: { getItem() { return null; }, setItem() {} },
    CustomEvent: class {},
  };
  vm.runInNewContext(source, context, { filename: "i18n.js" });
  const translations = window.BCB_I18N.translations;
  assert.deepEqual(
    Object.keys(translations.de).sort(),
    Object.keys(translations.en).sort(),
  );
});

test("event registration enforces identity profile consent and the required role mix", () => {
  const valid = {
    eventId: "heilstaette-grabowsee-2026-07-04",
    eventFunction: "photographer",
    name: "Test Applicant",
    email: "applicant@example.test",
    consent: true,
    privacy: true,
    partnerNotice: true,
    invitedParticipants: [{
      name: "Test Model",
      email: "model@example.test",
      eventFunction: "model",
    }],
  };

  assert.equal(validate(valid).ok, true);
  assert.equal(validate({ ...valid, consent: false }).errors.consent, "codex_required");
  assert.equal(validate({ ...valid, privacy: false }).errors.privacy, "privacy_required");
  assert.equal(
    validate({
      ...valid,
      eventFunction: "model",
      invitedParticipants: [{
        name: "Another Model",
        email: "model@example.test",
        eventFunction: "model",
      }],
    }).errors.roleMix,
    "grabowsee_one_photographer_required",
  );
});

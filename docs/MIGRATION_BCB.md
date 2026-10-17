# Boudoir Collective Berlin: migration inventory

Status: initial source inventory on `preview`, 17 October 2026. Findings below
describe repository code and documentation; production behavior has not been
re-tested and no live deployment was changed.

## Functional parity matrix

| Area | Present in source | Migration treatment / status |
|---|---|---|
| Public home | `index.html`, `styles.css`, `script.js`; intro, community principles, events, codex, contact and account entry points | Port to Astro first; retain section anchors and current public copy/links |
| Event detail pages | `event-grabowsee.html`, `event-wrodow.html`; localized descriptions, location imagery, application entry points | Preserve `.html` URLs and event query/action links |
| Account and profile | `account.html`; Firebase sign-in, private profile, privacy preferences, event application and account tabs | Keep Firebase identity; port UI separately from private operational data |
| Admin | Account admin tab plus `/api/admin`; application review, invite actions, member deletion and demo/simulation actions | Server authorization remains mandatory; currently controlled by configured admin e-mail allowlist |
| Public events | `data/events.json` and `GET /api/events` | Public event metadata can be Git-managed; validate schema and route rendering |
| Private event workflows | `/api/register`, `/api/member`, `/api/summary`, `/api/registration-action`; profile, application, invite confirmation/rejection and withdrawal | Keep private data outside static output; initially preserve Google Sheets and token flows |
| Authentication/config | `/api/config`, Firebase ID-token verification in `api/_google.js`; Google and Microsoft UI buttons. Config can name GitHub as a provider, but current HTML does not expose a GitHub login button | Verify provider parity before moving endpoints; do not broaden scopes |
| Email | `api/_mail.js`; Resend or Microsoft Graph configuration, invitation/action links | HTTP integrations are portable in principle; verify delivery and callback domains only in isolated staging |
| Language | `i18n.js`; German and English dictionaries used by pages/forms/status | Extract translations without dropping either locale; preserve language switch/storage |
| Legal/privacy | `legal.html`; localized imprint and privacy sections | Preserve the current route and content; review canonical/host metadata separately |
| Calendar/scheduling | No calendar/ICS implementation found in the route/API inventory. `docs/event-scheduling-architecture.md` describes future public and participant-only calendars | Planned, not parity baseline; do not represent it as currently working or expose participant data |
| SEO/URL controls | Page titles/descriptions and Open Graph metadata exist in HTML. No sitemap/robots source appeared in the root inventory | Audit generated metadata and hosting behavior during Astro routing; add only after URL inventory |
| Alternate site draft | `index-DSPro9.html`, `script-DSPro9.js`, `styles-DSPro9.css` are untracked in the starting worktree | Existing local work, not treated as approved source or overwritten |

Existing API modules: `events`, `config`, `register`, `member`, `admin`,
`registration-action`, `summary`; `_google` and `_mail` are shared helpers.
`npm run check` passed for all modules at the original inventory. Automated tests
have since been added; the shared-event checkpoint documents 29 passing tests,
the static build and targeted browser verification. This still does not establish
complete production end-to-end parity.

## Dependency and migration order

Event content, translation roles and cache boundaries are now audited separately
in [event-content-and-cache-architecture.md](event-content-and-cache-architecture.md).
It records the current repository-backed event API and proposes static public
publication with separate private operational APIs. This remains a proposal;
no Cloudflare deployment or database migration has been performed.

Implemented checkpoint (18 October 2026): the shared public event model and
renderer now feed Astro output, the local editor and the retained event API.
The browser uses an embedded catalog or one local legacy JSON read. See
[shared-event-model.md](shared-event-model.md) for scope and validation; operative
registration rules and production hosting remain unchanged.

1. Freeze the route/content/API inventory and baseline (current step); preserve
   old source and keep production DNS/deploy configuration unchanged.
2. Establish Astro static build and port public pages/assets, starting with
   home and legal pages; then port event details and the account shell.
3. Port structured public event content and bilingual UI, keeping current
   `.html` links/anchors stable.
4. Move API handlers only after frontend parity: Firebase verification,
   Google Sheets writes, role checks, email delivery, token actions and CORS
   must each have isolated compatibility tests.
5. Add contribution RBAC/CI and event content management after content
   entities and trusted ownership data have a stable schema.
6. Test isolated preview and explicitly approve any later production cutover.

Dependency map: page routes depend on translation keys, styles, media and
`data/events.json`; account UI depends on Firebase Auth and the API config/
member/summary/register/admin endpoints; registration depends on verified
Firebase identity, event validation, private Sheets storage, invite tokens
and optional mail; admin actions depend on server-side email allowlisting and
private Sheets; calendar/scheduling is future work, not an existing dependency.

## Verified discrepancies and open evidence

- `docs/event-scheduling-architecture.md` says event detail pages are not
  implemented, but both event detail HTML files and registration handling
  exist in this checkout. The page routes are implemented; calendar views,
  ICS, participant scheduling and partner-confirmation mail are documented as
  not implemented.
- `README.md` still describes event detail applications as future work. Current
  code includes detail-page application forms and token-based invite actions.
- Existing untracked draft files and user changes were preserved. This
  inventory does not validate their publication/readiness status.
- Authentication, Google Sheets, email delivery, admin permissions, external
  callbacks, mobile behavior and production URL behavior require staging
  integration tests; syntax checks alone do not prove them.

## Status Astro-Frontend (preview)

- Seiten sind als Astro-Shells in src/pages mit HTML-Fragmenten in src/content/pages portiert (scripts/split-pages.mjs war der einmalige Splitter). Layout: src/layouts/Layout.astro.
- npm run build erzeugt dist/*.html (gleiche URLs); Assets werden per scripts/sync-public.mjs nach public/ gespiegelt (git-ignoriert).
- tests/astro-parity.test.mjs vergleicht i18n-Hooks, IDs, Links und Skripte mit den Legacy-Seiten.
- Lokaler Editor unter `/__editor/` bearbeitet fünf bestehende Seitenfragmente und DE/EN-Übersetzungen. Die Strukturübersicht zeigt redaktionelle Abschnitte statt jedes HTML-Elements; Verschieben, Duplizieren und Entfernen sind auf semantische Abschnitte begrenzt. Neue Inhalte entstehen aus drei geprüften Layoutvorlagen (zweispaltiger Inhaltsabschnitt, Drei-Kachel-Gruppe, Statement). Ihre Textfelder erhalten eigene Übersetzungsschlüssel; unbekannte Layoutmarker werden beim lokalen Speichern abgewiesen. Doppelklick/Inline-Bearbeitung einzelner Bestandstexte bleibt möglich. Die Bestandsseiten sind weiterhin HTML-Fragmente, noch nicht vollständig in ein typisiertes Seitendokument migriert. Eventbereiche und Formulare bleiben geschützte Strukturen. Undo/Redo, WebP-Medien, Navigation, Metadaten und Gerätevorschau bleiben erhalten; Speichern ändert nur lokale Dateien. Eventtexte nutzen das gemeinsame öffentliche Eventmodell und einen getrennten Prüfstand für Übersetzungen. Kontextmenüs werden anhand ihrer tatsächlichen Größe im Fenster gehalten; modale Dialoge sind in der Höhe begrenzt und scrollbar.
- Editor ist im Development-Server auf Loopback beschränkt und wird nicht im statischen Build ausgeliefert. `suess_boudoir` wurde nicht verändert.
- Offen: BCB-RBAC/Contributor-Workflow, Cloudflare-Backend, Deploy-Konfiguration.

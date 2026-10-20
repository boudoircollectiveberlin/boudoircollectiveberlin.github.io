# Boudoir Collective Berlin

Community- und Eventseite für `@boudoircollectiveberlin`.

Die Seite ist als statisches Frontend mit optionaler Vercel-API aufgebaut:

- öffentliche Events: gemeinsames Modell in `data/events.json`; Astro rendert und bettet den Katalog statisch ein, `GET /api/events` bleibt als kompatibler Leser erhalten
- Eventdetailseiten: `event-grabowsee.html` und `event-wrodow.html`
- zweisprachige Oberfläche: `i18n.js`
- Login/privates Community-Profil: Firebase Auth + `POST /api/member`
- Eventbewerbungen aus den Eventdetailseiten: `POST /api/register`
- Account-/Community-Profil liegt auf `account.html`
- optionale Mit-Anmeldung anderer Personen ohne öffentliche Mitgliederliste
- geplante Kalender-/Scheduling-Architektur: `docs/event-scheduling-architecture.md`
- privates Organisations-Backend: Google Sheets über Service Account
- keine Google-Kalender-Scopes im Browser
- keine PII im Repository

## Einrichtung

Die vollständige Reihenfolge für GitHub, Vercel, Firebase und Google Sheets steht in:

- `docs/setup-runbook.md`
- `docs/registration-architecture.md`
- [Astro-Migrationsinventar und Abhängigkeitskarte](docs/MIGRATION_BCB.md)

## Lokal starten

```bash
npm install
npm run check
npm run serve
```

### Lokaler Inhaltseditor und Preview (VS Code)

- Ohne VS Code: `npm run dev:astro`, anschließend die ausgegebene lokale Adresse mit `/__editor/` öffnen.
- Task ausführen: `Terminal -> Run Task -> Preview: Start local webserver`
- Alternativ im Debug-Panel: `Preview: Local Webserver`
- Der Editor öffnet unter `http://127.0.0.1:4321/__editor/` (Port ggf. abweichend).

Der Editor bietet einen rekursiven Seitenaufbau, Komponenten-Inventar mit Drag & Drop, Kontextaktionen, direkte DE-/EN-Bearbeitung, Textdialoge, Undo/Redo, WebP-Bildersetzung, Navigation, Metadaten und responsive Vorschau. Seiteninhalte liegen in `src/content/pages`, allgemeine Übersetzungen in `i18n.js` und öffentliche Eventtexte in `data/events.json`. Website und Editor verwenden denselben Eventrenderer. Er läuft nur auf localhost und wird nicht in den statischen Build aufgenommen; produktives RBAC ist noch nicht implementiert.

Details: [Redaktionsfunktionen, Vorschau, Freigabe und Policies](docs/editor-transfer-suess.md), [gemeinsames Eventmodell](docs/shared-event-model.md), [Übersetzungsprüfung für Eventtexte](docs/event-translation-reviews.md), [Eventredaktion, RBAC und Cloudflare-Caching](docs/event-content-and-cache-architecture.md), [lokaler Prüfstand und Fortsetzung](docs/local-validation.md).

Für API-Tests mit Environment Variables:

```bash
cp .env.example .env
npm run dev
```

Wenn das Frontend über GitHub Pages läuft und die API auf Vercel liegt, muss in `site-config.js` die Vercel API-Basis gesetzt werden:

```js
window.BCB_API_BASE = "https://dein-vercel-projekt.vercel.app";
```

Wenn Frontend und API gemeinsam über Vercel laufen, bleibt der Wert leer.

## Deployment-Hinweis

Für `https://boudoircollectiveberlin.github.io` muss das GitHub-Repository im Account oder der Organisation `boudoircollectiveberlin` exakt `boudoircollectiveberlin.github.io` heißen. Dieses lokale Repo zeigt aktuell auf `boudoircollectiveberlin/boudoircollective.github.io`; das funktioniert als Project Page, aber nicht als User/Org Root Page unter diesem Hostnamen.

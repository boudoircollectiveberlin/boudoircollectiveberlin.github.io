# Boudoir Collective Berlin

Community- und Eventseite für `@boudoircollectiveberlin`.

Die Seite ist als statisches Frontend mit optionaler Vercel-API aufgebaut:

- öffentliche Events: `data/events.json` und `GET /api/events`
- zweisprachige Oberfläche: `i18n.js`
- Login/privates Community-Profil: Firebase Auth + `POST /api/member`
- Eventinteresse später aus Eventdetailseiten: `POST /api/register`
- Account-/Community-Profil liegt auf `account.html`, Eventinteresse soll später aus Eventdetailseiten heraus erfolgen
- optionale Mit-Anmeldung anderer Personen ohne öffentliche Mitgliederliste
- zukünftige Event-/Scheduling-Architektur: `docs/event-scheduling-architecture.md`
- privates Organisations-Backend: Google Sheets über Service Account
- keine Google-Kalender-Scopes im Browser
- keine PII im Repository

## Einrichtung

Die vollständige Reihenfolge für GitHub, Vercel, Firebase und Google Sheets steht in:

- `docs/setup-runbook.md`
- `docs/registration-architecture.md`

## Lokal starten

```bash
npm install
npm run check
npm run serve
```

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

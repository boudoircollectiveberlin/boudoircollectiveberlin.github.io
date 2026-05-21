# Setup Runbook

Ziel: Das Projekt so konfigurieren, dass

- GitHub Pages oder Vercel das Frontend ausliefert
- Vercel die API Functions hostet
- Firebase Authentication den Login bereitstellt
- Google Sheets das private Orga-Backend bleibt
- keine Secrets ins Repository gelangen

Diese Anleitung ist technische Hilfestellung, keine Rechtsberatung.

## 1. GitHub vorbereiten

1. Repository-Name prüfen.
   Für `https://boudoircollectiveberlin.github.io` muss das Repo im Account oder in der Organisation `boudoircollectiveberlin` exakt `boudoircollectiveberlin.github.io` heißen.
2. Code einchecken.
   Einchecken dürfen:
   - `index.html`
   - `account.html`
   - `styles.css`
   - `script.js`
   - `i18n.js`
   - `site-config.js`
   - `data/events.json`
   - `api/*`
   - `docs/*`
   - `vercel.json`
   - `.env.example`
3. Nicht einchecken:
   - `.env`
   - `.vercel`
   - `service-account*.json`
   - echte Firebase Keys außerhalb der öffentlichen Web-App-Config
   - echte Google Service Account JSON-Dateien

## 2. Deployment-Modell festlegen

Es gibt zwei sinnvolle Varianten:

1. GitHub Pages + Vercel API
   Vorteil: Frontend bleibt auf GitHub Pages, API läuft separat.
   Dann muss `site-config.js` auf die Vercel-Domain zeigen.

2. Alles auf Vercel
   Vorteil: weniger Moving Parts, kein Cross-Origin zwischen Frontend und API.
   Dann bleibt `window.BCB_API_BASE = ""`.

Empfehlung für dieses Projekt:
`GitHub Pages + Vercel API`, wenn die Root-Domain bewusst GitHub Pages bleiben soll.

## 3. Vercel Projekt anlegen

1. In Vercel ein neues Projekt aus dem GitHub-Repository importieren.
2. Framework Preset auf `Other` lassen.
3. Root Directory leer lassen.
4. Build Command leer lassen.
5. Output Directory leer lassen.
6. Nach dem ersten Import die Projekt-Domain notieren:
   Beispiel: `https://boudoircollectiveberlin.vercel.app`

## 4. Firebase Projekt anlegen

1. In Firebase ein Projekt anlegen oder ein bestehendes Projekt verwenden.
2. Unter `Project settings` eine Web App anlegen.
3. Diese Werte notieren:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`
4. Unter `Authentication > Sign-in method` die gewünschten Provider aktivieren:
   - Google
   - Microsoft
   - GitHub
5. Unter `Authentication > Settings > Authorized domains` hinzufügen:
   - `localhost`
   - eure Vercel-Domain
   - `boudoircollectiveberlin.github.io`

## 5. Microsoft und GitHub Provider vervollständigen

### Microsoft

1. In Microsoft Entra eine App Registration anlegen.
2. Die Redirect URI aus dem Firebase-Microsoft-Setup eintragen.
3. Private Accounts zulassen, wenn nicht nur Organisationskonten gewünscht sind.
4. Client ID und Client Secret in Firebase beim Microsoft Provider hinterlegen.

### GitHub

1. In GitHub eine OAuth App anlegen.
2. Die Callback URL aus dem Firebase-GitHub-Setup eintragen.
3. Client ID und Client Secret in Firebase beim GitHub Provider hinterlegen.

## 6. Google Cloud und Google Sheets vorbereiten

1. Im zugehörigen Google Cloud Projekt die Google Sheets API aktivieren.
2. Einen Service Account anlegen.
3. Einen JSON Key für diesen Service Account erzeugen.
4. Ein Google Sheet anlegen.
5. Zwei Tabs anlegen:
   - `Members`
   - `Registrations`
6. Das Sheet mit der `client_email` des Service Accounts teilen, Rolle `Editor`.
7. Die Spreadsheet-ID aus der URL kopieren.

Empfohlene Header:

`Members`

```text
timestamp | firebase_uid | verified_email | display_name | provider | functions | instagram | portfolio | future_updates | lobby_info | community_consent | community_privacy | member_status | private_profile_visibility | community_profile_visibility
```

`Registrations`

```text
timestamp | registration_id | event_id | firebase_uid | provider | event_function | name | verified_email | instagram | partner_name | partner_email | partner_instagram | partner_function | partner_consent_status | pairing | portfolio | whatsapp_intent | notes
```

## 7. Environment Variables in Vercel setzen

Diese Werte in Vercel unter `Project Settings > Environment Variables` anlegen:

```text
GOOGLE_SERVICE_ACCOUNT_KEY
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_APP_ID
AUTH_PROVIDERS
REGISTRATION_SHEET_ID
REGISTRATION_SHEET_RANGE
MEMBER_SHEET_RANGE
ALLOWED_ORIGINS
```

Empfohlene Werte:

```text
AUTH_PROVIDERS=google,microsoft,github
REGISTRATION_SHEET_RANGE=Registrations!A:Z
MEMBER_SHEET_RANGE=Members!A:Z
ALLOWED_ORIGINS=https://boudoircollectiveberlin.github.io,https://<projekt>.vercel.app
```

`GOOGLE_SERVICE_ACCOUNT_KEY` wird als vollständiges JSON eingefügt.

## 8. Frontend mit API verbinden

Wenn GitHub Pages das Frontend ausliefert:

In `site-config.js` eintragen:

```js
window.BCB_API_BASE = "https://<projekt>.vercel.app";
```

Wenn alles über Vercel läuft:

```js
window.BCB_API_BASE = "";
```

## 9. Lokal testen

1. Dependencies installieren:

```bash
npm install
```

2. `.env.example` nach `.env` kopieren und mit echten Testwerten füllen.
3. Syntax prüfen:

```bash
npm run check
```

4. API lokal über Vercel testen:

```bash
npm run dev
```

5. Statisches Frontend separat testen:

```bash
npm run serve -- --listen 4173
```

## 10. Launch-Check

Vor Livegang prüfen:

1. Login mit Google funktioniert.
2. Login mit Microsoft funktioniert.
3. Login mit GitHub funktioniert.
4. Community-Profil schreibt eine Zeile in `Members`.
5. Eingeloggte Personen ohne gespeichertes privates Profil werden zur Profilanlage geführt.
6. Lösch-/Auskunftsanfrage ist im Account und Datenschutztext auffindbar.
7. `data/events.json` wird öffentlich geladen.
8. `GET /api/config` liefert Firebase Config.
9. CORS funktioniert von GitHub Pages zur Vercel-Domain.
10. Footer/Header/Instagram/WhatsApp-Links zeigen korrekt.
11. Impressum und Datenschutz final prüfen.

## 11. Was ins Repo gehört

Einchecken:

- alle HTML/CSS/JS-Dateien
- `api/*`
- `data/events.json`
- `docs/*`
- `vercel.json`
- `.gitignore`
- `.env.example`

Nicht einchecken:

- `.env`
- echte Service-Account-Dateien
- echte Secret-Werte
- `.vercel`

## 12. Empfohlene Reihenfolge

1. GitHub Repo-Namen final festziehen
2. Vercel Projekt importieren
3. Firebase Web App + Auth Provider anlegen
4. Google Sheets API + Service Account + Sheet anlegen
5. Vercel Environment Variables setzen
6. `site-config.js` je nach Deployment-Modell setzen
7. lokal testen
8. deployen
9. Live-Profil speichern und Sheet prüfen

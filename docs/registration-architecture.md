# Registrierungsarchitektur

Ziel: Login, Community-Profil und Anmeldung für mehrere Events, ohne kostenpflichtige Dienste und ohne die alten Chrome-/OAuth-Probleme aus der Kalenderimplementierung.

## Grundsatz

Das Frontend nutzt Firebase Authentication nur zur Bestätigung der Identität. Je nach Konfiguration können Google, Microsoft und GitHub als Login-Provider angeboten werden. Es werden keine Kalender-, Drive- oder Kontakt-Scopes angefragt. Profil und Event-Anmeldung werden an Vercel Functions geschickt. Diese Functions verifizieren den Firebase ID Token serverseitig und schreiben die validierten Daten mit einem Google Service Account in ein privates Google Sheet.

Dadurch müssen Teilnehmende:

- keinen Google Account verwenden
- keine Kalenderberechtigungen freigeben
- nicht vorab in Kalendern eingetragen werden
- nicht Chrome benutzen

## Datenfluss

1. Öffentliche Eventdaten liegen in `data/events.json`.
2. Wenn Frontend und API auf unterschiedlichen Hosts laufen, setzt `site-config.js` `window.BCB_API_BASE` auf die Vercel Domain. Bei gemeinsamem Vercel-Deployment bleibt der Wert leer.
3. `GET /api/config` liefert die öffentliche Firebase Web App Konfiguration und die aktivierten Provider.
4. Firebase Auth meldet Nutzer:innen per Google, Microsoft oder GitHub an.
5. Der Browser sendet den Firebase ID Token an `POST /api/member` oder `POST /api/register`.
6. Die Vercel Function verifiziert den Token anhand der öffentlichen Firebase-Zertifikate und der Firebase Project ID.
7. `POST /api/member` schreibt privates Community-Profil, kreative Bereiche, Codex-/Datenschutzbestätigung und Update-Wunsch in `Members`.
8. Eventinteresse entsteht später aus der jeweiligen Eventdetailseite heraus. `POST /api/register` validiert dann Eventdaten, Honeypot, Codex-/Datenschutz-Checkboxen und optionale mitangemeldete Personen und schreibt in `Registrations`.
9. Die Orga prüft im Sheet und verschickt Bestätigung, Zahlungsinfos und WhatsApp-Lobby/Community-Infos manuell oder später automatisiert.

## Google Setup

1. Firebase Projekt erstellen oder ein bestehendes Google Cloud/Firebase Projekt nutzen.
2. In Firebase Console unter `Authentication` die gewünschten Sign-in Provider aktivieren:
   - Google
   - Microsoft
   - GitHub
3. Für Microsoft und GitHub die Provider-spezifischen OAuth Apps anlegen und die in Firebase angezeigten Redirect URIs dort eintragen.
4. In Firebase unter `Project settings` eine Web App erstellen und die Web App Config notieren.
5. In Firebase Authentication unter `Settings > Authorized domains` die späteren Domains eintragen:
   - `localhost` für lokale Tests
   - die Vercel Domain
   - `boudoircollectiveberlin.github.io`, falls die Seite direkt über GitHub Pages geladen wird
6. Google Sheets API im zugrunde liegenden Google Cloud Project aktivieren.
7. Service Account für Google Sheets erstellen.
8. JSON-Key erstellen und sicher aufbewahren.
9. Google Sheet anlegen, Tabs `Members` und `Registrations` erstellen.
10. Sheet mit der `client_email` des Service Accounts teilen, Rolle `Editor`.
11. In Vercel Environment Variables setzen:

```text
GOOGLE_SERVICE_ACCOUNT_KEY
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_APP_ID
AUTH_PROVIDERS=google,microsoft,github
REGISTRATION_SHEET_ID
REGISTRATION_SHEET_RANGE=Registrations!A:Z
MEMBER_SHEET_RANGE=Members!A:Z
ALLOWED_ORIGINS=https://boudoircollectiveberlin.github.io,https://<projekt>.vercel.app
```

12. Wenn die öffentliche Seite über GitHub Pages geladen wird, `site-config.js` auf die Vercel Domain setzen:

```js
window.BCB_API_BASE = "https://<projekt>.vercel.app";
```

Bei einem vollständigen Vercel Deployment bleibt `window.BCB_API_BASE = ""`.

Für die Firebase Token-Verifikation wird kein Firebase Admin Service Account benötigt. Das Backend prüft Signatur, `aud`, `iss`, Ablaufzeit und E-Mail-Verifikation anhand der öffentlichen Firebase-Zertifikate. Der Service Account wird nur für Google Sheets benötigt.

## Firebase Provider Setup

### Google

In Firebase Authentication den Google Provider aktivieren. Für den einfachen Community-Login sind keine zusätzlichen Google API Scopes nötig.

### Microsoft

1. In Microsoft Entra / Azure Portal eine App Registration erstellen.
2. Redirect URI aus Firebase Microsoft Provider Setup eintragen.
3. Client ID und Client Secret in Firebase beim Microsoft Provider hinterlegen.
4. Unterstützte Account-Typen so wählen, dass private Microsoft Accounts erlaubt sind, wenn nicht nur Organisationskonten zugelassen werden sollen.

### GitHub

1. In GitHub eine OAuth App erstellen.
2. Authorization callback URL aus Firebase GitHub Provider Setup eintragen.
3. Client ID und Client Secret in Firebase beim GitHub Provider hinterlegen.

## Datenschutz-Logik

PII wird nicht in GitHub gespeichert. Vercel verarbeitet die Anfrage transitiv; dauerhaft landet sie im privaten Google Sheet. Die Seite nutzt keine Tracking-Skripte. Firebase Authentication wird ausschließlich für Login/Identität genutzt.

Für DSGVO-Konformität sollten vor Launch ergänzt werden:

- vollständiges Impressum
- konkrete Verantwortliche
- Löschfrist für Interessensbekundungen
- Empfänger und Zugriffsberechtigte
- Hinweis auf Vercel, Firebase Authentication und Google Sheets als eingesetzte Dienstleister

Der Accountbereich enthält bereits eine E-Mail-Aktion für Auskunft, Korrektur und Löschung. Vor Livegang muss daraus ein verbindlicher Orga-Prozess werden: Identität prüfen, betroffene Zeilen in `Members`/`Registrations` finden, nicht mehr benötigte Daten löschen oder anonymisieren, gesetzliche Aufbewahrungspflichten dokumentieren.

Das ist technische Vorarbeit, keine Rechtsberatung.

## Profilmodell

Community-Profile sind vorerst nicht öffentlich. Das erste Pflichtprofil ist ein privates Orga-Profil und dient nur der internen Prüfung, Eventorganisation und gewünschten Updates. Bereits bei der Community-Registrierung müssen Name bzw. Community-Name, Codex und Datenverarbeitung bestätigt werden. Statt einer exklusiven Rolle wird gespeichert, in welchen Bereichen sich eine Person bewegt:

- `model`
- `photographer`
- `mua`

Mehrfachauswahl ist ausdrücklich erlaubt, weil Personen im Boudoir-Kontext mehrere Funktionen einnehmen können.

Statuslogik:

- `needs_profile`: Firebase Login vorhanden, aber privates Profil noch nicht gespeichert; keine Eventbewerbung.
- `registered`: privates Profil gespeichert; Updates und Eventbewerbungen möglich; Orga-Prüfung offen.
- `confirmed`: spätere Ausbaustufe für bestätigte Community-Mitglieder.

Ein späteres community-sichtbares Profil soll separat per Opt-in entstehen, nur für `confirmed` Mitglieder sichtbar sein und jederzeit deaktivierbar bzw. löschbar sein. Es wird bewusst nicht automatisch aus dem privaten Orga-Profil veröffentlicht.

## Eventmodell

Die Events sind bewusst nicht als reine 1:1-Pairings modelliert. Ein Event kann Rollenlimits, Team-Anmeldungen und kleine Gruppensets abbilden. Die Orga entscheidet nach Anmeldung, welche Kombination bestätigt wird.

Eventinteresse ist nur für registrierte Accounts mit gespeichertem privatem Profil möglich und soll nicht aus der allgemeinen Community-Registrierung heraus angeboten werden, sondern aus der jeweiligen Eventdetailseite. Daraus entsteht noch keine Teilnahme. Ablauf:

1. Community-Validierung über Lobby/Profil.
2. Eventinteresse über Eventdetailseite.
3. Prüfung von Rahmenbedingungen, Rollenmix, Kapazität und ggf. Partnerdaten.
4. Zahlungsoption wird verschickt.
5. Aufnahme in das Event erst nach Zahlungseingang.

Eine eingeloggte Person kann optional eine weitere Person mit anmelden. Diese zweite Person wird nicht aus einer öffentlichen Mitgliederliste ausgewählt, sondern über Name/E-Mail erfasst. Wenn später E-Mail-Versand ergänzt wird, sollte diese Person eine Benachrichtigung mit Bestätigen-/Ablehnen-Link erhalten. Bei Ablehnung wird der zugehörige Partner-Datensatz gelöscht oder als abgelehnt markiert.

Empfohlenes Sheet-Header-Set:

```text
timestamp | registration_id | event_id | event_function | name | email | instagram | partner_name | partner_email | partner_instagram | partner_function | partner_consent_status | pairing | portfolio | whatsapp_intent | notes
```

Aktuelles `Registrations`-Set:

```text
timestamp | registration_id | event_id | firebase_uid | provider | event_function | name | verified_email | instagram | partner_name | partner_email | partner_instagram | partner_function | partner_consent_status | pairing | portfolio | whatsapp_intent | notes
```

Empfohlenes `Members`-Set:

```text
timestamp | firebase_uid | verified_email | display_name | provider | functions | instagram | portfolio | future_updates | lobby_info | community_consent | community_privacy | member_status | private_profile_visibility | community_profile_visibility
```

## Partner-Bestätigung

Aktuell wird die mitangemeldete Person mit `partner_consent_status=pending` gespeichert, sobald eine Partner-E-Mail angegeben ist. Für die nächste Ausbaustufe ist vorgesehen:

1. Nach Event-Anmeldung erzeugt die API einen zufälligen Bestätigungs-Token.
2. Die API sendet an `partner_email` eine kurze Mail: wer hat dich für welches Event mitangemeldet?
3. Link `confirm` setzt `partner_consent_status=confirmed`.
4. Link `reject` setzt `partner_consent_status=rejected` oder entfernt die Partnerfelder aus dem Datensatz.
5. Ohne Bestätigung bleibt die Anmeldung organisatorisch unvollständig.

Das benötigt einen Mailprovider oder Google Workspace/Gmail API mit zusätzlicher Dokumentation und Datenschutztext.

## Offizielle Referenzen

## Aktuelle Erweiterung: Mail, Admin und Grabowsee

- `POST /api/register` speichert inzwischen `registration_status`, `applicant_action_hash`, `partner_action_hash`, `admin_status` und `updated_at` hinter den bisherigen Registrierungsfeldern.
- Es werden nur Hashes der Aktionstoken gespeichert. Der Klartext-Token steht nur im Mail-Link.
- Wenn `RESEND_API_KEY` gesetzt ist, erhalten Bewerber:innen eine Registrierungsbestätigung mit "this was not me"-Undo-Link.
- Wenn eine Partner-E-Mail angegeben ist, erhält die vorgeschlagene Person eine Partner-Mail mit Bestätigen-/Ablehnen-Link. Bis zur Bestätigung bleibt die Bewerbung `pending_partner`.
- `GET /api/registration-action` verarbeitet Undo, Partner-Bestätigung und Partner-Ablehnung.
- `ADMIN_EMAILS` ist die Vercel-basierte Admin-Definition. `GET/POST /api/admin` ist nur für diese Firebase-verifizierten E-Mail-Adressen nutzbar.
- Admin-Aktionen: Eventbewerbung bestätigen, ablehnen, zurücksetzen; Mitglied per E-Mail anonymisieren.
- Mitgliederprofile speichern jetzt ein separates Discoverability-Opt-in mit Anzeigename und kurzem Profiltext. Es gibt noch keine öffentliche Mitgliederliste.
- Neue Vercel-Variablen:

```text
ADMIN_EMAILS=admin@example.com
PUBLIC_SITE_URL=https://boudoircollectiveberlin.github.io
RESEND_API_KEY=optional-resend-api-key
MAIL_FROM="Boudoir Collective Berlin <noreply@example.com>"
```

- Firebase ID Tokens serverseitig verifizieren, inkl. Public-Key/JWT-Variante: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Firebase Microsoft Provider für Web: https://firebase.google.com/docs/auth/web/microsoft-oauth
- Firebase Auth Admin SDK: https://firebase.google.com/docs/auth/admin

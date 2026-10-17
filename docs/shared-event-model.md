# Gemeinsames Eventmodell und Darstellung

Implementierter Meilenstein vom 18.10.2026, Branch `preview`.

## Eine Quelle für öffentliche Eventinhalte

`data/events.json` enthält die öffentlichen Eventfelder und die bisher in
`i18n.js` gepflegten redaktionellen Detailtexte. 97 bestehende Textschlüssel
wurden ohne neue Eventfakten übernommen. Titel und Kosten haben gemeinsame
Felder für Karten und Detailseiten. Zusätzliche Detailtexte, Bildbeschreibungen,
Attributionen und Eventmetadaten liegen unter `content` am jeweiligen Event.

Die stabilen Event-IDs, bestehenden Gruppen, Status, Preise und Anmelderegeln
wurden nicht geändert. Vorhandene Datumslabels und zusammengesetzte Texte bleiben
redaktionell verfasste Inhalte; es wurden keine unbekannten Startzeiten oder
Zeitzonen ergänzt. Eine spätere strukturierte Fakten-/Policy-Migration bleibt
ein eigener Schritt.

`shared/event-content.mjs` bietet:

- Schema-/Pfadprüfung und explizite öffentliche Feldprojektion;
- DE-/EN-Auflösung mit Fallback;
- einen gemeinsamen Kartenrenderer;
- gemeinsame Datenbindungen für Detailtexte und Attribute;
- Begrenzung erlaubter Rich-Text-Tags und Linkattribute;
- sichere JSON-Einbettung in statisches HTML.

Unbekannte Top-Level-Felder und nicht zugelassene `content`-Felder gelangen nicht
in die öffentliche Projektion. Neue öffentliche Felder müssen bewusst im Modell
freigegeben werden. Private Anmeldungen oder Berechtigungen gehören nicht in
diese Datei.

`shared/read-events.mjs` ist der Node-Leseadapter für Build, lokale Editor-API
und bestehende Event-API. Die öffentliche Projektion erhält eine inhaltsbasierte
SHA-256-Revision. Sie ist ein Veröffentlichungsfingerabdruck, kein bereits
implementierter Schreibkonflikt- oder Freigabemechanismus.

## Website und Backendzugriffe

Das Astro-Layout rendert Eventkarten und Detailbindungen beim Build und bettet
denselben öffentlichen Katalog einschließlich beider Sprachen ein. `script.js`
verwendet diese Einbettung für Darstellung und Sprachwechsel. Hierfür entstehen
keine zusätzlichen Event-JSON-/Event-API-Abrufe.

Die weiterhin vorhandenen Legacy-HTML-Dateien können ohne Astro betrieben
werden: Dort lädt der Browser genau einmal die gleichnamige lokale JSON-Datei.
Der frühere zweite Abruf von `${API_BASE}/api/events` entfällt. Die API bleibt
als kompatibler öffentlicher Leser erhalten und nutzt dasselbe Modell.

Firebase-/Profilinitialisierung und private operative APIs wurden dadurch nicht
abgeschaltet oder migriert. Eine Seite kann deshalb weiterhin andere, fachlich
notwendige API-Anfragen ausführen.

## Editor

Der Editor liest denselben Katalog und verwendet denselben Kartenrenderer wie
die Website. Auf den Detailseiten binden `data-event-id`, `data-event-field`
und `data-event-attrs` Texte, Bildbeschreibungen und Metadaten an das Event.

- Direktes Bearbeiten verwendet die aktive Sprache.
- Doppelklick oder Rechtsklick öffnet den Textdialog, ohne zusätzliche Buttons
  auf jedem Feld.
- Die visuelle Fehlstellenmarkierung betrifft ausschließlich die andere Sprache
  und verschwindet in der Vorschau.
- Änderungen an Karten und Detailtexten werden als Evententwürfe gesammelt und
  mit dem Haupt-Speichern in die lokale Eventdatei geschrieben.
- Die gespeicherten Seitenfragmente behalten ihre kanonischen Bindungen;
  Editorattribute und die aktuelle Sprachprojektion werden nicht eingebrannt.
- Eventmetadaten werden aus dem Eventmodell gelesen und dorthin gespeichert.
  Operative Login-/Validierungsnachrichten bleiben in der allgemeinen Sprachdatei.

Der lokale Editor hat weiterhin keine produktive RBAC- oder Cloudflare-
Schreibanbindung. Freigaben und Rechte werden im nächsten Architekturabschnitt
ergänzt, nicht durch eine lokale Editorsitzung ersetzt.

## Geprüft

29 automatisierte Tests, statischer Build und Syntaxprüfungen sind erfolgreich.
Die neuen Tests decken insbesondere öffentliche Feldprojektion, stabile
Revisionen, gemeinsame Titel-/Kostenbindung, Detailtexte, Pfad-/Rich-Text-
Validierung, statische Einbettung und die tatsächliche Browser-Ladefunktion ab.

Browserprüfung: englische Eventdetailseite, Textdialog, Speichern eines lokalen
Testtitels und Anzeige desselben Titels in der Eventliste. Die Testdateien wurden
anschließend aus exakten Sicherungen wiederhergestellt und per Hash verglichen.

## Weiterer Plan

1. Quellrevisionen und den Zustand veralteter Übersetzungen ergänzen.
2. Redaktionelle Rollen, Event-/Sprachzuweisungen und Freigaben einer konkreten
   Revision serverseitig modellieren.
3. Cloudflare-Gateway mit getrennten öffentlichen/geschützten Read-Caches und
   gezielter Invalidierung aufbauen; circa eine Stunde Edge-TTL als Standard.
4. Operative Teilnehmeraktionen unabhängig davon direkt über die autorisierte
   API ausführen, ohne GitHub-Schritt oder Website-Build.

Hosting, Cachekonfiguration und produktives Backend sind noch nicht umgestellt.
Details: [Event-, RBAC- und Cachearchitektur](event-content-and-cache-architecture.md).

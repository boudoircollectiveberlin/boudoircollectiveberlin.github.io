# Lokaler Prüfstand und Fortsetzung

Branch: `preview`. Keine Veröffentlichung und kein Push durchgeführt.

## Gesicherte Meilensteine

- `8b777dc`: Astro-/Editor-Grundlage, gemeinsames Eventmodell und Darstellung.
- `9d5e0ec`: Architektur und Caching-Anforderungen dokumentiert.
- `772c74f`: Eventübersetzungsprüfung anhand von Quell- und Zielfingerprints.
- `a57d732`: Kontextmenüs bleiben im sichtbaren Fenster; modale Dialoge sind begrenzt und scrollbar.

## Wiederholbare Prüfung

PowerShell:

```powershell
$env:ASTRO_TELEMETRY_DISABLED='1'
npm run build
npm test
npm run check
Get-ChildItem editor -Filter *.mjs | ForEach-Object { node --check $_.FullName }
node --check editor/client.js
```

Der Build muss vor den Tests vorhanden sein: Einige Tests prüfen die gebauten Seiten. Telemetrie bleibt beim lokalen Build deaktiviert, damit Astro keine Benutzerkonfiguration außerhalb des Projekts schreiben muss.

Letzter geprüfter Funktionsstand: 32 Tests, fünf statische Seiten und Syntaxprüfungen erfolgreich. Browserprüfung: DE/EN-Eventdialog, Bestätigung speichern/erneut öffnen, Quelländerung setzt Prüfhinweis. Teständerungen bytegenau zurückgesetzt. Rechtsklick auf den untersten Footer-Link öffnet ein vollständig sichtbares Menü; der anschließende Textdialog bleibt im Fenster. Keine Teilnehmeraktionen oder externen Schreibzugriffe ausgeführt.

## Bereinigung und Fortsetzung

`public/`, `dist/` und `.astro/` sind erzeugte, ignorierte Arbeitsdateien. `public/` und `dist/` werden beim Build neu erzeugt; sie sind keine zweite Inhaltsquelle. `node_modules/` bleibt für die lokale Arbeit erhalten. Einmalige Migrationsskripte bleiben als dokumentierte Werkzeuge erhalten; `scripts/split-pages.mjs` nicht zur normalen Regeneration ausführen.

Vorhandene DSPro9-Entwürfe, VS-Code-Konfiguration, Projekt-Skills, AGENTS.md und die lokale Registrierungsvorlage wurden weder gelöscht noch pauschal committed. Historische Handovers bleiben erhalten. Keine Test-Backups sind für die weitere Arbeit erforderlich.

Das veraltete `.codex/local-server-4175.log` wurde entfernt und der eigene Testserver beendet. Der Editor lässt sich mit `npm run dev:astro` erneut starten.

Nächster Arbeitsschritt: optimistische Speicherkonflikte für Seiten, Wörterbuch und Eventdaten; danach Rollen-/Event-/Sprachrechte und Freigabe konkreter Revisionen. Eventprüfung gilt derzeit für Deutsch als Quelle; allgemeine Wörterbuchtexte und wählbare Quellsprache folgen separat. Operative Teilnehmeraktionen bleiben unabhängig vom Git- und Veröffentlichungsprozess. Cloudflare-Gateway, Cache-Invalidierung und Backendmigration sind weiterhin geplant.

Verdichtetes, versioniertes Handover: [HANDOVER.md](HANDOVER.md). Lokale Kopien: `.codex/handovers/latest.md` und die timestamped Handovers (bewusst Git-ignoriert). Dieser Prüfstand liegt versioniert im Projekt, damit die Fortsetzung auch ohne lokale Chatdateien nachvollziehbar bleibt.

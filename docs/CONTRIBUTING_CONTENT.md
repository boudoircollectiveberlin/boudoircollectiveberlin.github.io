# Inhalte beitragen – Schritt für Schritt

## Vor dem ersten Beitrag

Eine verantwortliche Person muss dich mit deinem GitHub-Benutzernamen auf dem Zielbranch freischalten. Du erhältst zugewiesene Seiten und Sprachen. Für Beiträge brauchst du keine Teilnehmerdaten, Firebase-Schlüssel oder Mailzugänge. Veröffentlichen darf nur die dafür zuständige Redaktion.

Der Migrationsstand muss zuerst auf GitHub bereitgestellt sein; er ist derzeit lokal vorbereitet. Diese Anleitung beschreibt den vorgesehenen und lokal geprüften Ablauf. Der erste reale Codespaces-/PR-Durchlauf steht noch aus.

## Einmal die Umgebung öffnen

Direkteinstieg: [Codespace für preview erstellen](https://codespaces.new/boudoircollectiveberlin/boudoircollectiveberlin.github.io/tree/preview). Damit wird direkt der Redaktionsbranch ausgewählt. Ein von `main` gestarteter Codespace verwendet dessen eigene Konfiguration; die Einrichtung aus `preview` ist dort erst nach Übernahme der Devcontainer-Konfiguration verfügbar. Bestehende Arbeitsbranches werden nicht automatisch gewechselt.

Nach Einrichtung oder erneutem Start startet der Editor automatisch mit der bestätigten GitHub-Identität und deren Zuweisungen. Port4321 bleibt privat. Fehlt die Zuweisung oder Anmeldung, startet kein Ersatzprofil. Das Startprotokoll liegt unter `/tmp/bcb-editor-<Codespace-Name>/server.log`. Nach einer Änderung der Devcontainer-Konfiguration einen bestehenden Codespace über **Codespaces: Rebuild Container** aktualisieren.

Die Umgebung installiert die aktuelle Node22-Version (mindestens22.22.0). Bei älteren Codespaces kann Port4321 bereits angezeigt werden, obwohl Astro wegen einer veralteten Node-Version beendet wurde. Dann zuerst den neuesten `preview`-Stand holen und den Container neu bauen; die Portanzeige allein bestätigt keinen laufenden Editor.

1. Öffne das BCB-Repository auf GitHub und wähle den vom Maintainer genannten Zielbranch.
2. Öffne **Code → Codespaces → Create codespace**. Die vorbereitete Umgebung installiert die Projektabhängigkeiten.
3. Prüfe unter **Ports**, dass Port **4321 privat** ist. Nicht auf öffentlich oder Organisation umstellen.
4. Öffne ein Terminal und führe `npm run validate` aus. Bei Fehlern nicht weiter veröffentlichen, sondern das Fehlerprotokoll an die verantwortliche Person geben.
5. Der Editor wird automatisch gestartet. Für einen manuellen Start nach Beenden des bisherigen Prozesses: `npm run dev:editor:contribute`. Deine GitHub-Identität wird über GitHubs `/user`-Endpunkt bestätigt. Die erlaubten Seiten und Sprachen kommen aus der Zuweisungsdatei. Fehlt die Zuweisung, stoppt der Start.
6. Öffne im Ports-Fenster die Adresse von Port4321 und hänge `/__editor/` an. Verwende die weitergeleitete HTTPS-Adresse, nicht die localhost-Adresse deines Computers.

Nur zum Ausprobieren ohne echten Account-Mapping: `npm run dev:editor:test`. Die Oberfläche zeigt ausdrücklich **Testbeitragender · Journal**. Das ist eine lokale Testidentität, kein angelegtes GitHub-Konto. Sie darf Journalentwürfe ändern und neue eigene Artikel anlegen, aber weder Startseite, gemeinsame Navigation, Events noch Freigaben verändern. Aus dem Testprofil erzeugte neue Artikel sind nicht als echter Autorenbeitrag einzureichen.

## Einen vorhandenen Text bearbeiten

1. Wähle **Bereich → Journal → Artikel**. Wähle deine Bearbeitungssprache DE oder EN.
2. Klicke den Text an und schreibe direkt. Doppelklick öffnet den Dialog mit beiden Sprachen. Ändere ausschließlich deine zugewiesenen Sprachfassungen.
3. Klicke **Speichern**. Das speichert einen Entwurf und veröffentlicht nichts.
4. Wechsle über **Vorschau** zur Darstellung ohne Bearbeitungsmarkierungen. Über **Website-Vorschau & Freigabe → Gespeicherte Website ansehen** prüfst du zusätzlich Journalübersicht, Menü und Startseitenteaser mit Entwürfen.
5. Für die Rückkehr enthält die separate Vorschau **Im Editor bearbeiten**. Sie öffnet genau denselben Artikel.
6. Bei einem Speicherkonflikt bleiben deine Eingaben erhalten. Vergleiche die Fassungen und sichere deinen Entwurf als Datei, bevor du bewusst neu lädst.

## Einen Artikel neu anlegen

1. Klicke **Seite / Artikel anlegen**, wähle **Artikel** und gib eine kurze Adresse sowie Titel/Kurzbeschreibung an. Im Beitragsprofil sind neue Artikel ohne direkte Änderungen des Hauptmenüs erlaubt.
2. Füge die verfügbaren Abschnittsvorlagen ein und ersetze alle Platzhalter. Titel und Kurzbeschreibung erscheinen automatisch auch in der Journalübersicht.
3. Speichere und prüfe DE/EN und die Vorschau. Fehlende Übersetzungen bleiben sichtbar als fehlend; nicht stillschweigend kopieren.
4. Der Artikel wird als dein eigener GitHub-Beitrag geführt. Niemals Eigentümer- oder Rechtefelder manuell umschreiben.

## Den Beitrag zur Prüfung abgeben

1. Speichere alle Änderungen. Bei manuellem Start kannst du den Editor mit Strg+C beenden; der automatisch gestartete Editor läuft im Hintergrund bis zum Stoppen des Codespaces weiter.
2. Öffne **Source Control** in VS Code und lege einen neuen Branch an, z.B. `content/mein-artikel`.
3. Prüfe die Änderungen. Zum Content-Beitrag gehören ausschließlich die betroffenen Artikeldateien unter `src/content/pages/redaktion-*.html`, `i18n.js` und bei neuen Artikeln `content/site-pages.json`. Keine generierten Ordner, Policies, Workflows, Secrets, Quellskripte oder Freigabedateien hinzufügen.
4. Committe die ausgewählten Dateien mit einer kurzen Beschreibung, z.B. „Journal: Text zu … ergänzen“.
5. Verwende **Publish Branch** und erstelle einen Pull Request gegen den genannten Zielbranch. Falls du keine Schreibrechte hast, nutze den von GitHub vorgeschlagenen Fork. Ein Fork hält den Beitrag zur Prüfung, nicht dauerhaft unveröffentlichte Website-Inhalte.
6. Beschreibe im PR: welche Seiten/Sprachen geändert wurden, wie du die Vorschau geprüft hast und welche Übersetzungen fehlen.
7. Der Content-Check verwendet deine tatsächliche GitHub-PR-Identität und die Zuweisungen des Zielbranches. Bei einer Ablehnung keine Schutzdateien im Beitrag ändern; zuständige Person fragen.
8. Nach der fachlichen Prüfung übernimmt ein Maintainer den Beitrag. Eine zuständige Person prüft und veröffentlicht anschließend den konkreten Website-Stand. **PR-Merge und Inhaltsspeicherung sind keine automatische Publikationsfreigabe.**

## Für Maintainer

`policy/contributors.json` liegt auf dem vertrauenswürdigen Zielbranch. Lokal vorbereitete Zuweisung für den benannten Testaccount `BCB-Dominik` (Login wird kleingeschrieben normalisiert):

```json
{
  "version": 1,
  "contributors": {
    "bcb-dominik": {
      "documents": ["redaktion-journal", "redaktion-lorem-ipsum"],
      "languages": ["de", "en"]
    }
  }
}
```

Die Zuweisung ist lokal vorbereitet. Sie greift auf GitHub erst nach Übernahme in den vertrauenswürdigen Zielbranch; die echte Codespaces-/PR-Abnahme steht aus. Keine Passwörter oder Tokens eintragen. Der Bootstrap ist ein eigener vertrauenswürdiger Maintainer-Schritt; ein Beitrag kann sich nicht selbst freischalten. Zusätzliche Event-, Prüf- oder Veröffentlichungsrechte sind nicht Teil dieses Prozesses.

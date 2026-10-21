# Inhalte beitragen – Schritt für Schritt

## Vor dem ersten Beitrag

Beiträge beginnen im eigenen Fork – auch für aufgenommene Beitragende. Für die automatische Content-Prüfung weist die Redaktion deinen GitHub-Namen auf dem BCB-Zielbranch bestimmten Seiten und Sprachen zu. Externe ohne Zuweisung können ebenfalls PRs zur manuellen Prüfung einreichen. Veröffentlichen darf nur die zuständige Redaktion. Teilnehmerdaten, Firebase-Schlüssel und Mailzugänge werden für Beiträge nicht benötigt.

Der Migrationsstand liegt auf BCB `preview`. Automatischer Codespaces-Start und Editorzugriff wurden real geprüft. Der vollständige externe Fork-/PR-Prozess und die Cloudflare-Vorschau stehen noch zur Abnahme aus. Die [README](../README.md) enthält die vollständigen Befehle für Fork, lokale Installation, Commit und Push.

## Fork und Beitragsbranch

1. Im BCB-Repository **Fork** wählen; **Copy the main branch only** deaktivieren, damit `preview` enthalten ist.
2. Im eigenen Fork `preview` mit BCB synchronisieren und davon z.B. `content/mein-artikel` anlegen. Fehlt der Branch, die `upstream/preview`-Befehle aus der README verwenden.
3. Codespace auf diesem Branch **im eigenen Fork** erstellen oder den Fork lokal klonen. Für jeden neuen Beitrag einen neuen Branch vom aktuellen BCB-`preview` verwenden.
4. Registrierung und Eigentümerschaft des Forks sind unabhängig: Ein Fork braucht keine BCB-Schreibrechte; seine lokale Policy ist keine BCB-Freigabe.

## Einmal die Umgebung öffnen

**Normaler Einstieg:** Codespace öffnen, Einrichtung abwarten, der Editor öffnet automatisch im Browser. Falls der Browser den Tab nicht zeigt, unter **Ports → 4321 → In Browser öffnen** klicken. Auch die reine Portadresse führt jetzt direkt zur Redaktion. Zum Wiederkommen einen vorhandenen Codespace unter [Deine Codespaces](https://github.com/codespaces) öffnen; nicht für jede Sitzung einen neuen anlegen.

Beim ersten Öffnen kann VS Code **„Ordner vertrauen und fortfahren“** fragen. Prüfe, dass du das BCB-Repository geöffnet hast, und bestätige dies nur, wenn du dessen Autoren vertraust. Die Startskripte dürfen dann in diesem Codespace laufen. Browser-Tabs können von deinem Browser blockiert werden; der Einstieg über **Ports** bleibt verfügbar. Nach Löschen eines Codespaces funktioniert dessen alte Portadresse nicht mehr. Erstelle dann einen neuen Codespace über den Direkteinstieg und verwende seine neue Adresse.

Zum Beitragen den Codespace über **Code → Codespaces** auf deinem Beitragsbranch im eigenen Fork erstellen. Der [Direkteinstieg im BCB-Repository](https://codespaces.new/boudoircollectiveberlin/boudoircollectiveberlin.github.io/tree/preview) dient der Maintainer-/Testumgebung; er erstellt keinen Fork. Ein von `main` gestarteter Codespace verwendet dessen eigene Konfiguration. Bestehende Arbeitsbranches werden nicht automatisch gewechselt.

Nach Einrichtung oder erneutem Start startet der Editor automatisch mit der bestätigten GitHub-Identität und deren Zuweisungen. Port4321 bleibt privat. Fehlt die Zuweisung oder Anmeldung, startet kein Ersatzprofil. Das Startprotokoll liegt unter `/tmp/bcb-editor-<Codespace-Name>/server.log`. Nach einer Änderung der Devcontainer-Konfiguration einen bestehenden Codespace über **Codespaces: Rebuild Container** aktualisieren.

Die Umgebung installiert die aktuelle Node22-Version (mindestens22.22.0). Bei älteren Codespaces kann Port4321 bereits angezeigt werden, obwohl Astro wegen einer veralteten Node-Version beendet wurde. Dann zuerst den neuesten `preview`-Stand holen und den Container neu bauen; die Portanzeige allein bestätigt keinen laufenden Editor.

1. Öffne deinen Fork auf GitHub und wähle deinen von BCB `preview` abgeleiteten Beitragsbranch.
2. Öffne **Code → Codespaces → Create codespace**. Die vorbereitete Umgebung installiert die Projektabhängigkeiten.
3. Prüfe unter **Ports**, dass Port **4321 privat** ist. Nicht auf öffentlich oder Organisation umstellen.
4. Öffne ein Terminal und führe `npm run validate` aus. Bei Fehlern nicht weiter veröffentlichen, sondern das Fehlerprotokoll an die verantwortliche Person geben.
5. Der Editor wird automatisch gestartet. Für einen manuellen Start nach Beenden des bisherigen Prozesses: `npm run dev:editor:contribute`. Deine GitHub-Identität wird über GitHubs `/user`-Endpunkt bestätigt. Die erlaubten Seiten und Sprachen kommen aus der Zuweisungsdatei. Fehlt die Zuweisung, stoppt der Start.
6. Der Browser öffnet die private Portadresse automatisch. Falls nötig unter **Ports → 4321 → In Browser öffnen** nachholen. Die Portadresse leitet direkt zur Redaktion weiter. Verwende die weitergeleitete HTTPS-Adresse, nicht die localhost-Adresse deines Computers.

Nur zum Ausprobieren ohne echten Account-Mapping: `npm run dev:editor:test`. Die Oberfläche zeigt ausdrücklich **Testbeitragender · Journal**. Das ist eine lokale Testidentität, kein angelegtes GitHub-Konto. Sie darf Journalentwürfe ändern und neue eigene Artikel anlegen, aber weder Startseite, gemeinsame Navigation, Events noch Freigaben verändern. Aus dem Testprofil erzeugte neue Artikel sind nicht als echter Autorenbeitrag einzureichen.

## Lokal mit bestätigter GitHub-Identität arbeiten

Die README beschreibt Installation und den einfachen lokalen Betreiberstart. Für registrierte Beiträge mit korrekter Autorenidentität zusätzlich die offizielle [GitHub CLI](https://cli.github.com/) installieren und einmal `gh auth login` ausführen. Der Login muss zur Zuweisung in deiner Arbeitskopie passen. Danach den bisherigen Editor mit Strg+C beenden und in einem eigenen Terminal starten:

**Windows / PowerShell:**

```powershell
$previousToken = $env:GH_TOKEN
try {
  $env:GH_TOKEN = gh auth token
  if ($LASTEXITCODE -ne 0) { throw 'GitHub-Anmeldung fehlt.' }
  npm run dev:editor:contribute
} finally {
  if ($null -eq $previousToken) { Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue }
  else { $env:GH_TOKEN = $previousToken }
}
```

**macOS / Linux / Bash:**

```sh
(
  GH_TOKEN="$(gh auth token)" || exit 1
  export GH_TOKEN
  npm run dev:editor:contribute
)
```

Öffne `http://127.0.0.1:4321/__editor/`. Der Token wird nur an den gestarteten Prozess weitergegeben; nicht ausgeben, in Dateien schreiben oder committen. Codespaces stellt seine GitHub-Anmeldung bereits bereit; dort sind diese lokalen Anmeldebefehle nicht nötig. Aufgenommene Beitragende holen ihre Zuweisung von BCB `preview`; Externe können für den eigenen Fork eine eigene Zuweisung ergänzen.

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
4. Beim bestätigten GitHub-Start wird der Artikel mit deiner Autorenidentität angelegt. Beim lokalen Betreiber-/Teststart muss die Redaktion vor manueller Übernahme die Autoren-/Eigentumszuordnung prüfen; diese Profile sind keine bestätigte PR-Identität.

## Den Beitrag zur Prüfung abgeben

1. Speichere alle Änderungen. Bei manuellem Start kannst du den Editor mit Strg+C beenden; der automatisch gestartete Editor läuft im Hintergrund bis zum Stoppen des Codespaces weiter.
2. Prüfe unter **Source Control**, dass dein Beitragsbranch im eigenen Fork ausgewählt ist, z.B. `content/mein-artikel`.
3. Prüfe die Änderungen. Zum Content-Beitrag gehören ausschließlich die betroffenen Artikeldateien unter `src/content/pages/redaktion-*.html`, `i18n.js` und bei neuen Artikeln `content/site-pages.json`. Keine generierten Ordner, Policies, Workflows, Secrets, Quellskripte oder Freigabedateien hinzufügen.
4. Committe die ausgewählten Dateien mit einer kurzen Beschreibung, z.B. „Journal: Text zu … ergänzen“.
5. Verwende **Publish Branch**, um in deinen Fork zu pushen. Erstelle einen PR mit **base repository** `boudoircollectiveberlin/boudoircollectiveberlin.github.io`, **base** `preview`, **head repository** dein Fork, **compare** dein Beitragsbranch. Ggf. **compare across forks** wählen. Ein öffentlicher Fork ist kein privater Entwurfsspeicher.
6. Beschreibe im PR: welche Seiten/Sprachen geändert wurden, wie du die Vorschau geprüft hast und welche Übersetzungen fehlen.
7. Der Content-Check verwendet deine tatsächliche GitHub-PR-Identität und die Zuweisungen des BCB-Zielbranches. Externe ohne Zuweisung und Code-/Policybeiträge benötigen den manuellen Prüfweg unten. Änderungen am eigenen Fork-Check ändern nicht den BCB-Check.
8. Nach manuellem Review wird der geprüfte Beitrag in BCB `preview` integriert. Die Redaktion verifiziert anschließend den integrierten Commit in der Vorschau. Cloudflare-Preview-Links sind geplant; aktuell einen privaten Codespace-/lokalen Prüfnachweis dokumentieren. Eine private Codespace-Adresse ist für andere Reviewer nicht automatisch nutzbar.
9. Ein Maintainer eröffnet danach den Release-PR **BCB `preview` → BCB `main`**, mit geprüftem Commit und Vorschau-Nachweis. Nach Änderungen erneut prüfen; finales manuelles Approval und erforderliche Release-Prüfungen vor dem Merge. **PR-Merge und Inhaltsspeicherung sind keine automatische Publikationsfreigabe:** Der derzeitige Inhaltssnapshot braucht eine ausdrückliche Redaktionsfreigabe. Fiktiven Lorem-ipsum-Text nicht versehentlich einschließen.

## Rechte und manuelle Prüfung

`policy/contributors.json` im vertrauenswürdigen BCB-Zielbranch bestimmt die automatisch prüfbaren Zuweisungen. Dort ist `BCB-Dominik` für den Journaltest eingetragen. Für den eigenen Fork kann eine externe Person dasselbe Format mit ihrem eigenen kleingeschriebenen GitHub-Login und den benötigten Seiten verwenden (Beispiel ersetzen, bestehende Einträge erhalten):

```json
{
  "version": 1,
  "contributors": {
    "dein-github-login": {
      "documents": ["redaktion-journal", "redaktion-lorem-ipsum"],
      "languages": ["de", "en"]
    }
  }
}
```

Eigene Fork-Policies dürfen angepasst werden; das gilt auch für aufgenommene Beitragende. Solche Änderungen wirken nur in der eigenen Umgebung. Lokale Zuweisungen nicht in einen reinen Inhalts-PR aufnehmen. Absichtliche Policy-/Codeänderungen separat beschreiben und zur manuellen Prüfung stellen. Keine Passwörter oder Tokens eintragen. Der Starthook kann nach der Anpassung mit `bash .devcontainer/start-editor.sh` erneut gestartet werden, sofern noch kein Server läuft.

Der derzeitige automatische Content-Check lehnt unbekannte Autoren, unzulässige Dokumente/Sprachen sowie Code-/Policyänderungen ab. Externe PRs bleiben als Vorschlag zur manuellen Übernahme möglich. Ein Approval allein überstimmt keinen erforderlichen fehlgeschlagenen Check. Maintainer prüfen den externen Diff und übernehmen nur freigegebene Änderungen in einen eigenen Integrationsbranch, oder ergänzen eine geeignete Zuweisung in einem getrennten vertrauenswürdigen Schritt und lassen den PR neu prüfen. Code-/Policybeiträge und Release-PRs benötigen einen eigenen Maintainer-Prüfweg; der Content-Check ist dafür nicht geeignet. Keine untrusted PR-Skripte mit Produktionssecrets ausführen. Endgültiger Branchschutz und dieser manuelle Integrationsweg sind noch abzunehmen.

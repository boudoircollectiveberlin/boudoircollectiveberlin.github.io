# Boudoir Collective Berlin

Zweisprachige Community- und Eventwebsite mit integriertem Editor für Seiten und Journal. Beiträge zu Texten, Übersetzungen, Gestaltung und Code sind willkommen – auch ohne Aufnahme in das Redaktionsteam.

## Vom Beitrag zur Veröffentlichung

**Eigener Fork → Beitragsbranch → PR nach BCB `preview` → manuelles Review → integrierte Vorschau prüfen → Release-PR von BCB `preview` nach BCB `main`.**

Auch aufgenommene Beitragende arbeiten vorzugsweise im eigenen Fork. Externe benötigen keine Schreibrechte im BCB-Repository, um einen PR einzureichen. Speichern, ein erfolgreicher Check und das Erstellen eines PR veröffentlichen noch nichts.

| Stand | Zweck |
| --- | --- |
| Eigener Fork / Beitragsbranch | Bearbeiten und persönliche Vorschau |
| BCB `preview` | Gemeinsame Integration und abschließende Vorschau |
| BCB `main` | Durch Release-PR freigegebener Stand |

**Aktuell:** Editor und Codespaces-Konfiguration liegen auf [`preview`](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/tree/preview). Die automatische Cloudflare-Vorschau ist **geplant, noch nicht eingerichtet**. Bis dahin dokumentiert die Redaktion eine lokale oder private Codespaces-Vorschau des konkreten Integrationscommits. Ein allgemeiner Cloudflare-Preview-Link existiert noch nicht.

## 1. Eigenen Fork vorbereiten

1. Öffne [das BCB-Repository](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io) und klicke **Fork**.
2. Wähle deinen Account. Deaktiviere **Copy the main branch only**, damit auch `preview` übernommen wird. Erstelle den Fork.
3. Öffne **deinen Fork**, wähle **`preview`** und gleiche diesen Branch vor jedem neuen Beitrag mit BCB ab (**Sync fork**).
4. Erstelle davon einen Beitragsbranch, z.B. `content/mein-artikel`. Ändere weder `main` noch deinen Synchronisationsbranch `preview` direkt.

Falls `preview` fehlt oder der Browser keinen passenden Abgleich anbietet, verwende die lokalen Befehle unten: Sie holen ausdrücklich BCB `upstream/preview`.

## 2a. Im Browser mit Codespaces arbeiten

1. Öffne **deinen Fork und deinen Beitragsbranch**. Wähle **Code → Codespaces → Create codespace on …**. Prüfe den Branch; GitHub zeigt an, wer die Nutzung bezahlt.
2. Warte auf die Einrichtung. Bei **„Ordner vertrauen und fortfahren“** prüfe das Repository und bestätige nur, wenn du dessen Autoren vertraust.
3. Der Editor startet mit deiner GitHub-Identität und öffnet sich automatisch im Browser. Falls kein Tab erscheint: **Ports → 4321 → In Browser öffnen**. Die Portadresse führt direkt zum Editor; Port **privat** belassen.
4. Bei **„Kein freigeschalteter GitHub-Beitragender“** ergänze die Zuweisung nur in deinem Fork wie unten beschrieben. Danach im Terminal `bash .devcontainer/start-editor.sh` ausführen. Es startet kein Administratorprofil als Ersatz.
5. Bearbeite Inhalte, klicke **Speichern** und prüfe DE/EN sowie **Vorschau**. Die [Beitragsanleitung](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/CONTRIBUTING_CONTENT.md) erklärt neue Artikel und Übersetzungen.
6. Führe vor dem Einreichen im Terminal `npm run validate` aus. Danach weiter mit „Pull Request einreichen“.
7. Nach der Sitzung **Strg+Umschalt+P → Codespaces: Stop Current Codespace**. Nur den Tab zu schließen stoppt ihn nicht sofort. Später unter [Deine Codespaces](https://github.com/codespaces) fortsetzen.

Ein bestehender Codespace holt neue Projektstände nicht automatisch. Erst eigene Änderungen sichern/committen, den Branch aktualisieren und bei geänderter Devcontainer-Konfiguration **Codespaces: Rebuild Container** ausführen. Nach Löschen eines Codespaces ist seine alte Portadresse ungültig.

## 2b. Lokal arbeiten – Windows, macOS und Linux

Voraussetzungen: Git und **Node.js 22 ab Version 22.22.0** inklusive npm. Prüfe `git --version`, `node --version` und `npm --version`. Ersetze `DEIN-ACCOUNT` und ggf. den Fork-Namen in der HTTPS-Adresse. Diese Befehle funktionieren in PowerShell und einer Unix-Shell.

```sh
git clone https://github.com/DEIN-ACCOUNT/boudoircollectiveberlin.github.io.git
cd boudoircollectiveberlin.github.io
git remote add upstream https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io.git
git fetch upstream
git switch -c content/mein-artikel upstream/preview
npm ci
npm run dev:editor
```

Öffne **http://127.0.0.1:4321/__editor/**. Dieser lokale Start verwendet das Betreiberprofil deiner eigenen Arbeitskopie und verleiht keine BCB-Rechte. Bei neuen Artikeln prüft die Redaktion die Autoren-/Eigentumszuordnung vor der manuellen Übernahme. Für automatisch geprüfte registrierte Beiträge nutze die [bestätigte GitHub-Identität](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/CONTRIBUTING_CONTENT.md#lokal-mit-bestätigter-github-identität-arbeiten).

Bearbeite und speichere deine Inhalte, prüfe DE/EN und die Vorschau. Beende den Server mit **Strg+C**, dann:

```sh
npm run validate
git status --short
git add src/content/pages/redaktion-mein-artikel.html i18n.js content/site-pages.json
git diff --cached
git commit -m "Journal: meinen Artikel ergänzen"
git push -u origin content/mein-artikel
```

Passe die Dateiliste hinter `git add` an: nur tatsächlich vorhandene, bewusst geänderte Inhaltsdateien auswählen. Bei bestehenden Artikeln entfällt die Registry oft. Keine generierten Ordner, Zugangsdaten oder versehentlichen lokalen Policy-Anpassungen hinzufügen. Bei Codebeiträgen die betroffenen Quelldateien auswählen und den PR als Codeänderung kennzeichnen.

## Rechte im Fork und externe Beiträge

Dein Fork gehört dir: Dort kannst du Editor-Policies und Seitenzuweisungen anpassen. Ergänze für den Codespaces-Editor in `policy/contributors.json` deinen kleingeschriebenen GitHub-Login mit den benötigten Dokumenten und Sprachen. Das [konkrete Format](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/CONTRIBUTING_CONTENT.md#rechte-und-manuelle-prüfung) steht in der Anleitung. Registrierte Beitragende synchronisieren ihre bereits in BCB vergebenen Zuweisungen.

**Änderungen im Fork erteilen keine Rechte im BCB-Repository.** Der automatische Content-Check verwendet PR-Autor, Policy und Zuweisungen des BCB-Zielbranches. Er weist nicht zugewiesene Beiträge sowie Policy-/Codeänderungen zurück. Auch registrierte Beitragende benötigen ein manuelles Review.

Externe PRs sind trotzdem zur **manuellen Übernahme** willkommen. Die Redaktion prüft sie separat und kann freigegebene Inhalte in einen eigenen Integrationsbranch übernehmen oder in einem getrennten Schritt eine passende Zuweisung ergänzen. Lokale Freischaltungen nicht versehentlich mitsenden; beabsichtigte Policy-/Codeänderungen ausdrücklich zur Prüfung stellen. Ein Review macht einen fehlgeschlagenen erforderlichen Check nicht automatisch grün. Branchschutz und der vollständige externe PR-Prozess sind noch nicht abgenommen.

## 3. Pull Request einreichen und veröffentlichen

1. Im eigenen Fork **Compare & pull request**, ggf. **compare across forks** öffnen.
2. Ziele prüfen: **base repository:** `boudoircollectiveberlin/boudoircollectiveberlin.github.io`, **base:** `preview`; **head repository:** dein Fork, **compare:** dein Beitragsbranch.
3. Beschreibe Seiten, Sprachen, Änderungen, fehlende Übersetzungen und deine Prüfung. Ergänze Screenshots oder einen zugänglichen Vorschau-Link. Private Codespace-Adressen sind für Reviewer nicht automatisch erreichbar; Ports dafür nicht öffentlich schalten. Externe/manuelle Prüfung und lokale Policy-Anpassungen ausdrücklich nennen.
4. Die Redaktion prüft den konkreten Commit und übernimmt ihn nach Zustimmung in BCB `preview`.
5. Die Redaktion verifiziert die **integrierte Vorschau**: Seiten, Journal, Navigation, DE/EN und mobile Ansicht. Vorschau-Adresse oder Prüfnachweis und Commit im Release-PR festhalten. Nach weiteren Änderungen erneut prüfen.
6. Ein Maintainer eröffnet den **Release-PR BCB `preview` → BCB `main`**. Erst nach finalem manuellem Approval und erforderlichen Release-Prüfungen mergen. Der Content-Beitragscheck ist kein allgemeiner Release- oder Codecheck.

Der Website-Build verwendet derzeit einen getrennten freigegebenen Inhaltssnapshot. Ein Merge aktualisiert ihn nicht automatisch: Die zuständige Redaktion muss die gewünschten Inhalte ausdrücklich prüfen/freigeben. Den fiktiven Lorem-ipsum-Artikel nicht versehentlich veröffentlichen. Cloudflare-Vorschau, Deployment aus `dist` und endgültige Release-Gates bleiben Teil der [Migration](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/MIGRATION_PLAN.md).

## Technik und weitere Anleitungen

Astro rendert statische Seiten mit HTML, CSS und Vanilla JS. Bearbeitbare Seiten: `src/content/pages`; Übersetzungen: `i18n.js`; öffentliche Events: `data/events.json`. Operative Aktionen wie Teilnehmerannahmen bleiben unabhängig von Git und Redaktions-PRs.

Optionale bestehende Integrationen: Firebase Auth für Community-Profile, Vercel-APIs und Google Sheets für private Organisation. Content-Beiträge benötigen keine Teilnehmerdaten, Firebase-/Mailzugänge oder Produktionssecrets. Öffentliche Forks und Git-Historie sind kein privater Entwurfsspeicher.

- [Ausführliche Beitragsanleitung](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/CONTRIBUTING_CONTENT.md)
- [Migration und offene Abnahmen](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/MIGRATION_PLAN.md) · [Codespaces-Prüfprotokoll](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/CODESPACES_ACCEPTANCE.md)
- [Editor, Vorschau, Freigaben und RBAC](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/editor-transfer-suess.md)
- [Optionale Integrationen einrichten](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/setup-runbook.md) · [Registrierungsarchitektur](https://github.com/boudoircollectiveberlin/boudoircollectiveberlin.github.io/blob/preview/docs/registration-architecture.md)
- GitHub: [Fork erstellen](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo?tool=webui), [Fork synchronisieren](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork), [PR aus einem Fork](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork)

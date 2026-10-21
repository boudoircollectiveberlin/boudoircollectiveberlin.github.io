# BCB-Migration: Arbeitsplan und Abnahme

Stand: 21.10.2026. Ziel: vollständig migrierte statische Website mit integrierter Redaktion, überprüfbaren Rollen und einem einfachen Beitragsprozess. Der folgende Stand ist eine lokale Vorbereitung, keine bereits abgenommene Cloud-Migration.

| Schritt | Status | Ergebnis / Abnahmekriterium |
| --- | --- | --- |
| 1. Astro + gemeinsames Eventmodell | erledigt | Bestehende fünf öffentliche Seiten behalten URLs, Inhalte, Eventdarstellung und Sprachwechsel. |
| 2. Journal in Website und Editor | erledigt als Entwurf | Übersicht, Artikel, Hauptmenü und Startseitenteaser verwenden zentrale Metadaten; Entwurfsschalter wirkt auf alle Einbindungen. Einspaltiger DE/EN-Testartikel vorhanden. |
| 3. Prüfung, Freigabe und Konflikte | lokal geprüft | Speichern verändert keine Freigabe; exakter Stand wird geprüft/freigegeben; spätere Änderungen bleiben Entwurf; Rücknahme und Zwei-Sitzungs-Konflikt getestet. |
| 4. Codespaces-/Testprofil vorbereiten | implementiert, Cloud-Abnahme offen | Devcontainer mit Node22, Port4321 und begrenzter Testidentität; Host-/Origin-Prüfung nur für den konkreten Codespace; kein Administratorprofil in Codespaces. |
| 5. Vertrauenswürdiger Beitragscheck | implementiert, GitHub-Bootstrap offen | PR-Autor und Zielbranch-Policy bestimmen Rechte; Kandidat wird nur als Git-Daten gelesen. Sprachtexte, Eigentum und erlaubte Pfade werden geprüft. Kein Ausführen von PR-Code. |
| 6. Erster echter Beitrag in Codespaces | offen – nächster Abnahmeschritt | Code zuerst in vertrauenswürdigen Zielbranch übernehmen; lokale Zuweisung für BCB-Dominik übernehmen; privater Codespace; Artikel bearbeiten/anlegen; PR gegen den Zielbranch; erlaubter Beitrag grün, unerlaubte Navigation/Freigabe/Codeänderung rot. |
| 7. Redaktionsfreigabe je Beitrag verfeinern | offen | Auswahl einzelner Artikel/Sprachen für Veröffentlichung; Testartikel darf keine echte Veröffentlichung erzwingen. Derzeit umfasst die Freigabe die ganze Website. |
| 8. Operative Integration auf Staging abnehmen | offen | Firebase-Identität, Profile, Eventinteresse, Einladungen, Rollenmix, Annahme/Zahlung/Mail mit isolierten Testdaten prüfen; keine Git-Abhängigkeit dieser Aktionen. |
| 9. Cloudflare-Gateway und Caches | offen | Autoritative Auth/Writes; öffentliche und autorisierte interne Readmodels getrennt, ca.1h TTL und gezielte Invalidierung; private Browserantworten no-store; Entzug von Rechten sofort wirksam. |
| 10. Deployment ausschließlich aus dist | offen | Vorschau zuerst; keine Entwürfe/Editor-/Policydateien im Artefakt. Alte Repository-Root-Veröffentlichung ersetzen. DNS/Produktivfreigabe und Rückrollplan separat bestätigen. |
| 11. Ende-zu-Ende-Abnahme und Übergabe | offen | Neue dritte Person kann die Anleitung ohne Hilfe durchlaufen. Zweiter Account kann nicht veröffentlichen; Reviewer/Publisher getrennt. Mobile/DE/EN, Zugriffsentzug, konkurrierende Bearbeitung, Cache-Invalidierung und Rücknahme nachweisen. |

## Nächste Sitzung: konkrete Reihenfolge

1. Testbeitragender ist `BCB-Dominik`; lokal sind Journalübersicht, Testartikel und DE/EN zugewiesen. Echte GitHub-Identität und Cloud-Ablauf noch prüfen.
2. Lokal geprüften Migrationscode inklusive Workflow in einen vertrauenswürdigen Zielbranch übernehmen. Aktuell wurde nichts gepusht. Kein vorgeschlagenes Beitragsskript als Sicherheitscheck aus dem PR-Branch starten.
3. Maintainer übernimmt die lokal vorbereitete Zuweisung für `bcb-dominik` auf diesen Zielbranch in `policy/contributors.json`: Login → Dokumente und Sprachen. Für den ersten Test: `redaktion-journal`, `redaktion-lorem-ipsum`, `de`, `en`.
4. Codespace von genau diesem Branch starten, Port4321 **privat** belassen. `npm run validate` und `npm run dev:editor:test` prüfen.
5. Danach `npm run dev:editor:contribute` mit tatsächlich bestätigtem GitHub-Account testen; Journaltext ändern und neuen Artikel anlegen. Workflow prüft den tatsächlichen PR-Autor, keine Formularrolle.
6. Positiv- und Negativ-PRs durchführen; Logs und PR-/Commit-IDs im Prüfprotokoll festhalten, keine Token speichern. Die Testidentität allein ersetzt diesen Nachweis nicht.

## Sicherheits- und Betriebsgrenzen

- Jeder eigene Codespace ist eine Entwicklungsumgebung unter Kontrolle seines Eigentümers. Dieser kann lokale Dateien und Server ändern. Die eigentliche Beitragsgrenze ist daher die Prüfung gegen die Policy des vertrauenswürdigen Zielbranches plus Maintainer-Review, nicht die lokal angezeigte Rolle.
- Private Codespaces-Ports erfordern GitHub-Authentifizierung, sind aber kein allgemeiner Mehrbenutzer-Login für diesen Editor. Keine öffentlichen Ports, keine Produktionssecrets, keine Teilnehmerdaten in Beitrags-Codespaces.
- Der vorbereitete `pull_request_target`-Workflow verwendet ausschließlich Zielbranch-Code und einen read-only Repository-Token. Kandidaten werden nur gefetcht/gelesen. Er darf niemals auf Kandidaten umchecken oder deren Build/Installationsskripte ausführen. Vor Aktivierung als required check muss der vertrauenswürdige Bootstrap tatsächlich vorhanden sein. Code-Migrations-PRs benötigen einen eigenen Maintainer-Prozess; dieser Check ist ausschließlich für Content-Beiträge gedacht und weist Codeänderungen absichtlich zurück.
- Codespaces-Instanzen, Accounts, Repositoryschutz und Deployment wurden noch nicht extern angelegt oder geändert. Das ist ein explizit offener Teil der Abnahme.

Anleitungen: [Beitragende](CONTRIBUTING_CONTENT.md), [Testprotokoll](CODESPACES_ACCEPTANCE.md).

Quellen: [GitHub Codespaces-Sicherheit](https://docs.github.com/en/codespaces/reference/security-in-github-codespaces), [Portweiterleitung](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).

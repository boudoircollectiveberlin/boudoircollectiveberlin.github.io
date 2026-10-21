# Codespaces-Abnahmeprotokoll

Stand: 21.10.2026: echter Codespace mit BCB-Dominik geprüft; echte Positiv-/Negativ-PR-Abnahme weiterhin offen.

Ergänzende Einstiegsabnahme: alter Codespace vom Nutzer gelöscht (GitHub-Liste leer, alte Adresse ungültig). Neuer 2-Core-Codespace ausdrücklich freigegeben; BCB-Ordnervertrauen separat vom Nutzer bestätigt. Ersteinrichtung deckte Abbruch des Hintergrundservers nach Hook-Ende auf. Korrektur8203630: eigene Sitzung via setsid, idempotenter postAttach-Wiederanlauf. Nach echtem Rebuild startete der Server ohne manuellen Befehl; GitHub öffnete automatisch einen neuen privaten Browsertab, Port-Root leitete ins Journal, Identität bcb-dominik und DE/EN erfolgreich. Screenshot bcb-codespaces-autostart.png. Keine Inhalte gespeichert, keine Produktionszugriffe. Automatischer Einstieg nach Rebuild damit bestätigt; neue Drittpersonen-/PR-Abnahme bleibt offen.

| Nachweis | Lokal | Echter Codespace |
| --- | --- | --- |
| Node22 / npm ci / Build / Tests | Projektprüfungen | Node22.23.4, Container-Rebuild, Build, 49 Tests und Syntaxchecks erfolgreich |
| Private Port4321-Weiterleitung / exakter Origin / fremder Host abgelehnt | automatisierte Host-/Origin-Tests | offen |
| Oberfläche zeigt begrenzte Identität, nur Journal zugewiesen | Browser und lokale HTTP-Prüfung erfolgreich | GitHub-Beitragender bcb-dominik, genau zwei Journal-Einträge, DE/EN-Wechsel geprüft |
| Erlaubter DE/EN-Journaltext speicherbar | automatisiert | offen |
| Startseite, fremdes Event, globale Navigation, Freigabe verweigert | automatisiert | offen |
| Nur eigenes/zugewiesenes Sprachmaterial im Beitrag zulässig | automatisiert | offen |
| GitHub-Identität über authentifizierten /user-Endpunkt | isolierte API-Tests | echter Start erfolgreich als bcb-dominik |
| PR-Autor aus vertrauenswürdigen Metadaten / Zielbranch-Policy | Validator-/Negativtests | offen |
| Echte Git-Blob-Kandidaten: erlaubter Beitrag akzeptiert, eingeschleuster Code abgelehnt | temporäres Git-Repository geprüft, Kandidat nie ausgeführt | offen |
| Code-, Policy-, Release-, Symlink- und aktive Sprachdateiänderungen abgelehnt | automatisiert | offen |
| Entwürfe fehlen im öffentlichen Build | bestehende Journal-/Buildtests | Build und Tests im Codespace erfolgreich |
| Anleitung von einer neuen dritten Person durchlaufen | offen | offen |

Nach echtem Test ergänzen: Zielbranch und Bootstrap-Commit, Testaccount, Datum, Codespace-Port-Sichtbarkeit, Positiv-/Negativ-PR-Links, Check-Ergebnisse, Browserbefunde, verbleibende Fehler. Keine Tokens, Cookies, Teilnehmerdaten oder vollständigen privaten URLs mit Zugangsdaten speichern.

Lokale Befehle:

Lokaler HTTP-Nachweis am 21.10.2026: Journalzuweisung und Testidentität sichtbar; Zugriff auf Startseite sowie Schreibversuche auf Navigation, gemeinsame Menütexte und Veröffentlichung jeweils403. Keine Quelldateien dadurch geändert. Screenshot `bcb-test-contributor.png` im Chat-Artefaktordner. Server läuft auf4321 im Testprofil.

```sh
npm run validate
npm run dev:editor:test
# Nach Maintainer-Zuweisung und in authentifiziertem Codespace:
npm run dev:editor:contribute
```

Der Codespaces-Test darf keine produktiven APIs oder Mailaktionen verwenden. Vor einer tatsächlichen Website-Freigabe muss der fiktive Lorem-ipsum-Beitrag ersetzt oder aus dem Freigabeumfang entfernt werden; die aktuelle Freigabe umfasst die gesamte Website.

Browserabnahme 21.10.2026: preview bis 6fb0394, Port4321 privat; Editor über weitergeleitete HTTPS-Adresse erreichbar, Profil bcb-dominik, Journal DE/EN und deaktivierte Freigabebuttons geprüft. Lokaler und weitergeleiteter Host jeweils HTTP200. Codespaces-Starthook nach gezieltem Beenden des Astro-Prozesses erneut ausgeführt: Bereitschaftsmeldung und HTTP200 erfolgreich, doppelter Aufruf erzeugt keinen zweiten Server. Vollständiger Stop/Resume mit dem zuletzt geänderten Hook noch separat offen. Keine Inhalte gespeichert/geändert und keine Produktiv-APIs ausgelöst. Screenshots bcb-codespaces-validated.png. Ursprüngliche Ursache: Image Node22.16.0 zu alt für Astro; jetzt offizielle Node22-Featureinstallation. Echte Content-PRs und cloudseitige Schreib-Negativtests bleiben offen.

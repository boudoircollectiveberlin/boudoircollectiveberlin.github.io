# Codespaces-Abnahmeprotokoll

Stand: lokal vorbereitet, **noch kein echter Codespaces-/GitHub-PR-Durchlauf**.

| Nachweis | Lokal | Echter Codespace |
| --- | --- | --- |
| Node22 / npm ci / Build / Tests | Projektprüfungen | offen |
| Private Port4321-Weiterleitung / exakter Origin / fremder Host abgelehnt | automatisierte Host-/Origin-Tests | offen |
| Oberfläche zeigt begrenzte Testidentität, nur Journal zugewiesen | Browser und lokale HTTP-Prüfung erfolgreich | offen |
| Erlaubter DE/EN-Journaltext speicherbar | automatisiert | offen |
| Startseite, fremdes Event, globale Navigation, Freigabe verweigert | automatisiert | offen |
| Nur eigenes/zugewiesenes Sprachmaterial im Beitrag zulässig | automatisiert | offen |
| GitHub-Identität über authentifizierten /user-Endpunkt | isolierte API-Tests | offen |
| PR-Autor aus vertrauenswürdigen Metadaten / Zielbranch-Policy | Validator-/Negativtests | offen |
| Echte Git-Blob-Kandidaten: erlaubter Beitrag akzeptiert, eingeschleuster Code abgelehnt | temporäres Git-Repository geprüft, Kandidat nie ausgeführt | offen |
| Code-, Policy-, Release-, Symlink- und aktive Sprachdateiänderungen abgelehnt | automatisiert | offen |
| Entwürfe fehlen im öffentlichen Build | bestehende Journal-/Buildtests | offen |
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

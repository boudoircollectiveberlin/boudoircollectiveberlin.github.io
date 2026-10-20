# Übernahme der Redaktionsfunktionen aus suess_boudoir

Geprüft am 20.10.2026: Chat „Redaktionssektion vorbereiten“ sowie die tatsächlichen Module für Seitenauswahl, Redaktion, Freigabe und Policy-Auswertung. Das Referenzprojekt wurde nicht verändert.

## Für BCB übernommen

- Bereich → Seite/Artikel mit Suche nach Titel und Adresse. Bereichswechsel und Suche öffnen keine andere Seite und verwerfen keinen Entwurf. Die Suche ist mit 150 Artikeln getestet.
- Inhaltsseiten und Artikel entstehen direkt im normalen Editor, mit denselben Abschnittsvorlagen, DE/EN-Textdialogen, Medien und Undo/Redo. Struktur ist Vorlage; Titel und Vorspann sind bearbeitbare Inhalte.
- Zentrale Titel und Kurztexte der Detailseite speisen zusätzliche Navigationslinks und Artikelteaser. Ohne freigegebene Artikel gibt es keine öffentlichen Artikelrouten oder Artikelteaser. Ein Navigationslink ist je neuer Seite optional.
- Sofortvorschau zeigt den aktuellen, auch ungespeicherten Entwurf. „Gespeicherte Website ansehen“ öffnet eine separate, schreibgeschützte lokale Website-Vorschau; der Haken entscheidet zwischen gespeicherten Entwürfen und freigegebenem Stand. Er gilt gemeinsam für Seite, Navigation, Teaser, Texte und Events. Vorschauparameter beeinflussen keinen öffentlichen Build.
- Speichern, Prüfen und Freigeben sind getrennt. Die Prüfung ist an den exakten gespeicherten Stand gebunden; erst die Freigabe übernimmt ihn für kommende statische Builds. Änderungen lassen den bisherigen freigegebenen Stand unverändert. Die letzte Website-Freigabe lässt sich auf den vorherigen Stand zurücknehmen; Entwürfe bleiben erhalten.
- Optimistischer Konfliktschutz für alle lokalen Schreibwege. Bei Konflikten bleiben Eingaben erhalten; der Hauptspeicherweg bietet Vergleichsansicht, lokale Entwurfsdatei und bestätigtes Neuladen.

## BCB-spezifische Rechte

`policy/content-rbac.json` und `editor/policy.mjs` definieren Ressourcen und Aktionen. Fehlende Rechte verweigern den Zugriff. Serverprüfungen umfassen bestehende Speicher-, Metadaten-, Navigations-, Medien- und Übersetzungswege sowie neue Seiten und Freigaben. Rollen und Eigentümerschaft werden nicht aus dem Request übernommen.

| Rolle | Umfang |
| --- | --- |
| Lokaler Betreiber | Vollständige lokale Redaktion, Prüfung und Freigabe |
| Redaktion | Zugewiesene/eigene Seiten; zugewiesene Events in zugewiesenen Sprachen; keine Website-Freigabe |
| Übersetzung | Zugewiesene Seiten lesen, Sprachtexte und zugewiesene Events nur in zugewiesenen Sprachen ändern |
| Prüfung | Inhalte lesen und einen konkreten Website-Stand prüfen |
| Veröffentlichung | Inhalte lesen und ausschließlich einen passenden geprüften Stand für den Build freigeben oder zurücknehmen |

Der Loopback-Editor setzt serverseitig ausdrücklich die lokale Betreiberidentität. Dies ist keine produktive Benutzeranmeldung. Vor einem gehosteten Editor fehlen ein verifizierter Identitätsadapter, vertrauenswürdige Rollenzuweisung, Deployment-Schutz der Policy und UI-Anpassungen für die jeweiligen Rollen. Niemals Client-Rollen übernehmen oder eine Policy aus ungeschützten Beiträgen als produktive Autorität behandeln.

## Daten und Veröffentlichungsgrenze

- `content/site-pages.json`: Register zusätzlicher Entwurfsseiten; HTML weiter in `src/content/pages` und Sprachtexte weiter in `i18n.js`.
- `content/site-publication.json`: unveränderliche aktive/geprüfte Website-Snapshots, vorherige Freigabe und Audit. Die bestehenden fünf Seiten wurden als bereits vorhandener Ausgangsstand importiert; keine neuen Texte freigegeben.
- `shared/site-publication.mjs`: Entwurfsabbild und gemeinsame Navigation/Teaser; `editor/site-store.mjs`: Prüfung, Freigabe, Rücknahme, Konflikte und Rechte.
- Astro baut Seiten, Metadaten, Sprachdatei und Eventanzeige aus dem aktiven Snapshot. Zusätzliche Routen entstehen nur aus diesem Snapshot. Der öffentliche Event-Endpunkt nutzt ebenfalls den freigegebenen Datenstand. Interne Redaktion, Policies und Freigabedateien gelangen nicht nach `dist`.
- Wegen gemeinsamer Navigation, Wörterbuch und Events gilt eine Freigabe bewusst für die ganze Website, nicht für ein einzelnes Teilstück. Die Bestätigung listet betroffene Seiten und gemeinsame Daten auf.
- Die Grenze gilt für die Astro-Ausgabe `dist`. Alte Deployments direkt aus dem Repository-Wurzelverzeichnis müssen vor Nutzung der neuen Entwurfsfunktion auf den geprüften Build umgestellt werden. Git-versionierte Entwürfe sind bei einem öffentlichen Repository als Quellcode einsehbar und keine vertrauliche Ablage.
- Keine automatischen Commits, Builds, Deploys, Zeitfreigaben oder Cloudflare-Konfigurationsänderungen durch Redaktionsaktionen. Teilnehmerannahme, Zahlung und Einladungen bleiben ausschließlich operative API-Aktionen, unabhängig von diesen Freigaben.

## Prüfung und Restumfang

39 Tests einschließlich Policy-/Sprach-/Eventgrenzen, getrennten Prüfer-/Veröffentlicherrechten, unveränderter öffentlicher Ausgabe bei Entwurfsänderung, Rücknahme, zentralen Teasern und Konflikten. Browser: Artikel anlegen, hierarchische Suche, Vorschau mit/ohne Entwürfe, prüfen/freigeben, späteren Text separat speichern und Konflikt zwischen zwei Editorsitzungen. Ein tatsächlicher Build erzeugte die freigegebene sechste Testseite samt Navigation/Teaser. Danach wurden sechs Originaldateien bytegenau wiederhergestellt und der Testartikel entfernt; Abschlussbuild enthält wieder fünf Seiten.

Bewusst offen: gehostete Identitäten und Rollenzuweisung, Cloudflare-Caches/Invalidierung, feinere Freigabe einzelner Seiten, Navigationsreihenfolge und nachträgliche Menü-Eigenschaften neuer Seiten, Artikelübersicht/Lesedauer, Bildwelt-spezifische Grid-Bearbeitung und allgemeine Übersetzungsprüfung außerhalb der Eventtexte. Keine fremden Markeninhalte, Illustrationen oder Vertriebs-CTAs übernommen.

# Journal vorbereiten

Start: `npm run dev:editor` → Bereich **Journal** → **Übersicht** oder **Artikel**.

Direktlink zum Artikel im Editor: `/__editor/?page=redaktion-lorem-ipsum`. Die separate Website-Vorschau enthält oben „Im Editor bearbeiten“ und öffnet damit dieselbe Seite im vollständigen Editorrahmen. Dort wechselt „Vorschau/Bearbeiten“ ohne Seitenwechsel. Die aktuelle Editorseite bleibt in der URL erhalten.

- `redaktion-journal` ist die bearbeitbare Journalübersicht mit automatischer Artikelliste. Titel und Vorspann lassen sich normal bearbeiten; die Liste bezieht Titel/Kurzbeschreibung zentral aus den Artikeln. Ein Klick öffnet den Artikel im gleichen Editor.
- `redaktion-lorem-ipsum` ist ein ausdrücklich fiktiver DE/EN-Testartikel mit Lorem ipsum, Abschnitten und einem hervorgehobenen Platzhalter. Er enthält keine Event- oder Angebotsaussagen.
- Artikel verwenden eine durchgehende, mittig gesetzte Lesespalte (maximal 800px), Titel und Vorspann untereinander, offene Absatzabstände und zurückhaltende Hervorhebungen. Die allgemeinen zweispaltigen Panel-Layouts werden innerhalb von Journalartikeln nicht auf die Textabschnitte angewandt; BCB-Schrift und Farben bleiben erhalten. Auch neue Artikel erhalten diesen Seitenrahmen.
- Neue Artikel entstehen über „Seite / Artikel anlegen“; aus der Übersicht ist der Artikeltyp vorausgewählt. Alle Inhalte nutzen den normalen Editor und dieselben Policy-/Freigaberegeln.
- Website-Vorschau: „Unfreigegebene Inhalte anzeigen“ einschalten. Dann erscheinen Journal-Menü, Übersicht, Artikel und Startseitenteaser gemeinsam. Ausschalten zeigt weiter die unveränderte freigegebene Website.
- Beide Seiten sind als Entwurf versioniert. Keine Freigabe, kein Push und kein Deploy. Der öffentliche Astro-Build bleibt bei fünf Seiten; im öffentlichen Wörterbuch fehlt der Lorem-ipsum-Inhalt.

Prüfung: 42 Tests, Build, Syntax-/API-Prüfungen, Browser Übersicht→Artikel und DE/EN-Vorschau erfolgreich. Der vorhandene lokale Server wurde für die neue Integration neu gestartet und bleibt auf Port4321 aktiv. Für eine spätere echte Veröffentlichung zuerst den fiktiven Testartikel ersetzen oder bewusst aus dem Freigabeumfang entfernen; aktuell gilt die Freigabe für die ganze Website.

# Event- und Scheduling-Architektur

Ziel: Die Website soll langfristig sowohl einen öffentlichen Eventkalender als auch eventinterne Ablauf- und Slotpläne abbilden können. Das Scheduling muss flexibel genug bleiben, um sehr unterschiedliche Regeln pro Event zu unterstützen.

## Kalender-Ebenen

### Öffentlicher Eventkalender

Für alle sichtbar:

- Eventname
- Datum / Zeitraum
- Status, z. B. geplant, Anmeldung offen, ausgebucht, abgeschlossen
- öffentliche Beschreibung
- grobe Kapazitäten
- Link zur Anmeldung oder Warteliste

Dieser Kalender enthält keine personenbezogenen Daten und keine internen Slots.

### Eventinterner Kalender

Nur für bestätigte Teilnehmende eines Events sichtbar:

- Studio-/Location-Rotation
- Zeitslots
- Team- oder Pairing-Zuordnung
- Listenansicht
- Kalenderansicht
- ICS-Export
- ggf. Hinweise zu Setwechseln, Pausen, Check-in, Briefing

Dieser Kalender ist eventabhängig und kann andere Regeln haben als der öffentliche Jahreskalender.

## Scheduling-Regeln

Das System sollte nicht hart auf 30-Minuten-Slots oder einzelne Studio-Bookings festgelegt werden. Stattdessen bekommt jedes Event einen `scheduleRuleSet`.

Beispiele:

### Kurze Set-Slots

Geeignet für kleinere Setwechsel:

```json
{
  "type": "fixed_slots",
  "slotDurationMinutes": 30,
  "breakDurationMinutes": 0,
  "resources": ["Studio 1", "Studio 2"],
  "allowParticipantBooking": true
}
```

### Studio-Rotation

Geeignet für mehrere Studios mit weniger Wechseloverhead:

```json
{
  "type": "rotation",
  "slotDurationMinutes": 120,
  "breakDurationMinutes": 30,
  "resources": ["Studio 1", "Studio 3", "Studio 4"],
  "rounds": 3,
  "rule": "each_photographer_visits_each_studio_once"
}
```

Damit lässt sich z. B. abbilden: 3 Studios, 3 x 2h Shootingblöcke, 30 Minuten Pause/Wechselzeit, jede:r Fotograf:in ist einmal in jedem Studio.

### Freier Tagesplan

Geeignet für Portfolio Circles oder kleine Community-Sessions:

```json
{
  "type": "agenda",
  "items": [
    { "time": "10:00", "title": "Ankommen / Briefing" },
    { "time": "10:30", "title": "Freie Shootingphase" },
    { "time": "14:00", "title": "Review / Austausch" }
  ]
}
```

## Datenmodell-Vorschlag

### `Events`

```text
event_id | title_de | title_en | status | starts_at | ends_at | public_visibility | registration_status | schedule_visibility | schedule_rule_set_json
```

### `EventParticipants`

```text
event_id | firebase_uid | registration_id | participant_status | functions | display_name | email | instagram | confirmed_at
```

### `EventScheduleItems`

```text
event_id | schedule_item_id | starts_at | ends_at | resource_id | title | participant_refs | visibility | notes
```

### `EventResources`

```text
event_id | resource_id | resource_name | resource_type | capacity | notes
```

## Views

### Public Views

- Jahres-/Listenansicht für alle Events
- Eventdetailseite ohne interne Teilnehmerdaten
- Anmeldung / Warteliste über Account-Seite

### Participant Views

- Listenansicht des eigenen Events
- Kalenderansicht
- Filter nach Studio/Resource
- eigener Plan
- ICS-Export

## ICS Export

ICS sollte getrennt nach Scope erzeugt werden:

- öffentlicher ICS Feed: alle öffentlichen Events
- eventinterner ICS Feed: nur bestätigte Teilnehmende mit Token
- optional persönlicher ICS Feed: nur eigene Slots / Zuordnungen

Wichtig: Eventinterne ICS URLs sollten nicht erratbar sein. Dafür eignet sich ein zufälliger Feed-Token pro Teilnehmer:in oder pro Eventrolle.

## Abgrenzung zur aktuellen Implementierung

Aktuell existieren:

- öffentliche Eventdaten in `data/events.json`
- Registrierung in Google Sheets
- private Community-Profile

Noch nicht implementiert:

- Eventdetailseiten
- internes Scheduling
- Teilnehmerberechtigungen pro Event
- List-/Calendar-View
- ICS Export
- Mailflow für Partnerbestätigung

Diese Funktionen sollten als eigene Schicht entstehen, nicht direkt in `data/events.json` oder das bestehende Registrierungsformular gepackt werden.

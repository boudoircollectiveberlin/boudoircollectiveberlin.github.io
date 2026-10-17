# Event translation review checkpoint

Event text dialogs now distinguish missing, unconfirmed, outdated, changed and confirmed English translations. German is the source language for this checkpoint. Preview markers still indicate only a missing other language; review status appears only in the paired dialog.

`editor/event-reviews.json` stores SHA-256 source fingerprints and, after explicit confirmation, target fingerprints. Imported pairs are unconfirmed. Editing either text invalidates its confirmation; changing German also flags previously imported translations for review. Reconfirming an unchanged English translation is supported. Confirmation travels with the normal page draft/history/save and checks both original language values before acceptance, so a concurrent change cannot silently receive approval for an older text.

The sidecar contains no account information and is excluded from the Astro public catalog, public revision and static build. Reading the editor does not write review state. Metadata and direct event edits also invalidate a confirmation through their changed text fingerprints. Operational APIs remain unchanged.

Validation: 32 tests, static build, API/editor syntax checks. Browser roundtrip confirmed an existing pair, saved it, reopened its confirmed status and changed German to observe the review warning. All test source changes were restored byte-for-byte.

Remaining: general page/dictionary review tracking, selectable source language, hosted RBAC and full optimistic save/publication conflicts. This local checkpoint does not provide multi-user authorization or a hosted editorial database.

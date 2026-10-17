# PROJECT OVERVIEW
Boudoir Collective Berlin: Astro/static HTML, CSS, vanilla JS. Branch `preview`. Important milestones committed; nothing pushed or deployed. Read this file and `.codex/handovers/latest.md` to resume.

# CURRENT STATE
- `8b777dc`: Astro/editor foundation + shared event model/renderer.
- `9d5e0ec`: event/cache architecture documentation.
- `772c74f`: event translation review revisions.
- `a57d732`: viewport-bounded context menus and scrollable modal dialogs.
- Final validation: 32 tests, five-page static build, API/editor syntax checks pass. Instructions/evidence: `docs/local-validation.md`.
- Old `.codex/local-server-4175.log` removed. Test backups already restored byte-for-byte and removed. Own test server stopped; restart with `npm run dev:astro`, open `/__editor/`. Generated public/dist refreshed and retained; dependencies retained.
- Existing untracked DSPro9 drafts, `.vscode`, AGENTS.md, project skills and local registration spreadsheet preserved. No blanket staging or cleanup of user work.

# ARCHITECTURE
- `data/events.json`: canonical public DE/EN event text, content, assets and facts; preserve IDs, status, prices and unknown dates/times.
- `shared/event-content.mjs`: validated public projection, rich-text safety, card renderer and detail bindings. `shared/read-events.mjs`: Node adapter + public SHA-256 revision (fingerprint, not yet a write-conflict guard).
- Astro layouts embed public catalog; `script.js` reuses it. Legacy pages read same-origin JSON once. No event backend read for Astro display. `api/events.js` shares the public reader; existing operational APIs remain unchanged.
- Pages: `src/pages/*.astro`; editable fragments: `src/content/pages/*.html`; general translations: `i18n.js`. Editor local routes in `editor/local-editor.mjs`, interface in `editor/client.js`.
- Loopback/origin/token checks; serialized local writes and rollback, individual atomic source replacements. Multi-file writes are not crash-atomic. Editor never shipped in Astro static build.
- Event review sidecar `editor/event-reviews.json`: imported source hashes; confirmed pairs also store target hash. Explicit approval checks original DE/EN values, binds confirmation to final pair. Source/target edits invalidate status. No review metadata in public catalog/build/revision. Review is not publication approval.

# FRONTEND STATE
- Single click edits active language; double-click/right-click opens paired dialog. No per-field translation buttons.
- Preview markers ONLY indicate missing OTHER language. Review/stale status appears in event dialog; German is currently the source. General dictionary review and selectable source remain open.
- Recursive tree, constrained component drag/drop and before/after/inside insertion, Undo/Redo, WebP media, navigation, metadata and device preview implemented.
- Context menu measured after showing and clamped to viewport with 8px gap; internally scrollable when necessary. Modals fixed/centered, height capped with internal scrolling. Browser checked bottom footer right-click and following text dialog.
- Browser verified shared event title edits/list-detail consistency and translation confirmation save/reopen/source-change warning. Exact test source restored. Screenshots live outside repo in this chat's visualization folder.

# BACKEND / INTEGRATIONS STATE
- active: GitHub Pages/Vercel, Firebase identity, private Google Sheets membership/registration and existing mail integration unchanged.
- active: local static event catalog/shared renderer; operational actions still use existing APIs.
- planned: Cloudflare Workers gateway, RBAC, scoped edge read caches around 1h TTL and targeted invalidation; no infrastructure/DNS/security changes performed.
- required: accept/reject/payment/invite operations remain independent of Git commits/checks/PRs/builds/deploys. Authorization and writes authoritative on each request. Private browser responses no-store. Protected internal cache after per-request authorization, correctly partitioned by event/user/scope. Rights revocation cannot wait for TTL. Handle invalidation failure and in-flight refills.
- considered: D1 editorial drafts and separate operational migration; no second writable source of truth.
- unresolved: production RBAC/database/publication workflow. Google Calendar/ICS/scheduling not implemented; Microsoft Forms not introduced.

# DECISIONS
Commit tested milestones on `preview`; no push/deploy without authorization. Keep static rendering and integration continuity. Do not infer event facts or change authored operational policies. Reference repo `suess_boudoir` remains read-only. No full functional parity claim.

# CONSTRAINTS
Preserve user drafts/configuration and existing integrations. No credentials/private data in handovers. No external participant actions or mail in smoke tests. Build before tests because tests read dist. Set `ASTRO_TELEMETRY_DISABLED=1` for restricted local builds. `scripts/split-pages.mjs` and event migration are one-time tools; do not regenerate evolved sources with them.

# OPEN ISSUES
- General optimistic save conflicts for page/dictionary/events; review confirmation alone has a limited original-pair guard.
- Role/event/locale permissions, revision-bound publication approval, audit and hosted authoring.
- General translation review/source-language choice, event creation/group/cover acceptance, broader complex layout/rich-text/media tests.
- Legacy operational API hardcoded policy/date labels and cache/no-store coverage need dedicated migration.

# CURRENT TODOS
- [x] Shared event display/editing and static snapshot.
- [x] Event translation review and bottom-edge menu/dialog fix.
- [x] Validation, source restoration, cleanup and committed continuation documentation.
- [ ] General conflict handling, then RBAC and exact-revision publication.
- [ ] Cloudflare gateway/caches/invalidation and isolated operational migration.

# NEXT RECOMMENDED TASK
Implement optimistic save conflicts for page, dictionary and event revisions. Preserve pending drafts on conflict, provide a usable reload/compare path, and test two editor sessions. Then introduce server-side role/event/locale scope and revision-specific approval/publication. Keep participant operations separate. Commit each tested milestone.

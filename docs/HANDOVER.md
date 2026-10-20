# PROJECT OVERVIEW
BCB: Astro/static HTML/CSS/vanilla JS; branch preview. No push/deploy. Reference suess_boudoir read-only. See docs/editor-transfer-suess.md for the 20.10.2026 transfer audit and implementation.

# CURRENT STATE
Journal draft checkpoint: overview redaktion-journal + DE/EN Lorem-ipsum article redaktion-lorem-ipsum, both in Journal area and normal editor. Dynamic overview uses central title/summary, opens article in same editor; generated list omitted from saved HTML. Journal nav hides when snapshot has zero articles. 42 tests, five-page approved build, DE/EN browser overview→article checks passed. Publication file unchanged. User's local server was restarted on4321 for new integration and remains running.
Editor start: `npm run dev:editor` (same underlying launcher as `dev:astro`); prints `/__editor/` URL, forwards `--port`, disables Astro telemetry by default. Smoke-tested on port4324: HTTP200 and editor HTML. Test server stopped afterwards.
Existing milestones: 8b777dc shared events/editor; 772c74f event translation review; a57d732 modal/menu viewport fix; 4beca1b documentation; feccfa9 semantic outline and three section templates. Current milestone: hierarchical/searchable pages, new article/content pages, approved-site snapshots, saved-draft website preview, server-side policy checks and optimistic conflicts. 39 tests, five-page baseline build and API/editor syntax checks passed. Browser created/reviewed/approved a temporary article; actual six-page build verified route/nav/teaser. Later edits stayed draft; two-session stale save rejected. Six exact originals restored; test article/backups removed. No new editorial content approved in final state.

# ARCHITECTURE
- Drafts: src/content/pages/*.html, i18n.js, data/events.json; additional page registry content/site-pages.json now contains Journal overview + virtual test article. These are intentional unapproved content, not disposable test leftovers.
- content/site-publication.json stores immutable active/reviewed/previous full-site snapshots plus audit. Existing five-page site imported as baseline; not a new content release.
- shared/site-pages.mjs provides registry; shared/site-publication.mjs composes draft/approved pages/nav/teasers; shared/publication-state.mjs reads the release record.
- Astro Layout + [slug].astro build only approved pages/meta; sync-public mirrors approved i18n/events. readEventCatalog defaults approved; editor must explicitly use draft:true. Public event API uses approved data. Editors/Policies/registry/release file excluded from dist.
- editor/site-store.mjs: fixed-path atomic writes, exact revisions, create/review/publish/withdraw, policy checks. Serialized mutation queue in local-editor.mjs; multi-file operations not crash-atomic. General stale save returns409; inputs retained. Main save opens comparison, local draft export and confirmed reload.
- Release covers whole site due shared dictionary/navigation/events. review needs approve right; publish needs publish right and exact reviewed revision. withdraw restores previous whole-site snapshot, retaining drafts. No automatic Git/build/deploy or scheduling.

# FRONTEND STATE
Normal editor for all pages/articles. Area + searchable page/article selector; area/search alone never navigate. Three reusable section templates, semantic outline, inline active-language editing, paired dialogs, Undo/Redo, media, metadata/nav retained. New article title/summary feed central nav/teasers. Missing-other-language indicators only; event review status in dialog, DE source. Live editor preview includes unsaved changes; separate saved website preview toggle selects drafts/approved consistently. Private preview read-only forms and no-store/noindex. Existing bottom-edge modal/menu fix retained.

# BACKEND / INTEGRATIONS STATE
- active: GitHub Pages/Vercel, Firebase identity, private Google Sheets and mail APIs unchanged; operational APIs independent of editorial release.
- active locally: policy/content-rbac.json + editor/policy.mjs enforce reads/writes, assigned documents/events, language restrictions, separate reviewer/publisher. Roles/ownership never accepted from HTTP input; trusted loopback local-operator only.
- planned: hosted verified identity/role assignment and role-specific UI; protected policy authority; Cloudflare gateway + correctly scoped authorized edge read caches around1h TTL with targeted invalidation. Auth/writes authoritative per request; private browser no-store; role revocation must not wait TTL.
- considered: D1 editorial drafts and separate operational migration; no second writable source.
- unresolved: hosted deployment/bootstrap, legacy hardcoded operative policies. Calendar/ICS not implemented; Forms not introduced.

# DECISIONS
Commit tested milestones on preview; never push/deploy without approval. Preserve shared sources and BCB appearance; no copied brand articles/illustrations/CTAs. Source-versioned drafts are not confidential in a public repository. New release boundary is Astro dist; old root-directory deployments must migrate to approved build before using unpublished content. No claim of hosted RBAC or full Suess parity.

# CONSTRAINTS
Preserve untracked DSPro9/.vscode/AGENTS.md/.codex assets and skills. No external participant actions/mail. Build before tests; ASTRO_TELEMETRY_DISABLED=1. On Windows sandbox, fixture atomic replaces need unrestricted test execution; full39 tests passed there. Never rerun one-time split-pages/event migration over evolved sources. Do not overwrite approved snapshot from current drafts to bypass review.

# OPEN ISSUES
Hosted identity/policy trust/UI roles; Cloudflare caching/invalidation; finer per-page publishing; navigation order and post-creation menu settings; article overview/reading time and gallery-grid authoring; general dictionary translation review/source locale. Approved snapshot freezes HTML/meta/i18n/events, not renderer/CSS/asset bytes: code/media releases still need normal review. Server requires restart after integration edits.

# CURRENT TODOS
- [x] Suess chat/source audit and useful BCB feature transfer.
- [x] Same editor for articles, hierarchy/search, consistent preview/nav/teasers.
- [x] Full-site exact review/approval/rollback, policies and optimistic conflicts.
- [x]39 tests/build/browser evidence, exact restoration and committed handover.
- [ ] Hosted identity adapter and role-specific acceptance; targeted caching/invalidation.

# NEXT RECOMMENDED TASK
Connect a verified server identity/assignment adapter before hosting the editor, enforce protected policy trust, and derive UI capabilities from the same policy. Keep participant operations completely separate. Then improve page-specific publication granularity/navigation settings. Start by reading this handover and docs/editor-transfer-suess.md; inspect git status before edits.

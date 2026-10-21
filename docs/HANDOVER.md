# PROJECT OVERVIEW
BCB: Astro/static HTML/CSS/vanilla JS; branch preview. No push/deploy. Reference suess_boudoir read-only. See docs/editor-transfer-suess.md for the 20.10.2026 transfer audit and implementation.

# CURRENT STATE
Final local validation for this checkpoint: 48 tests, five-page approved build, API/editor syntax and live HTTP403 scope checks passed. A real temporary Git repository verified the CLI against target-branch assignments and rejected candidate JavaScript. No candidate executed. Public source/draft/release data unchanged. Test server stays running; no push or remote provisioning.
21.10.2026 migration checkpoint: .devcontainer Node22/port4321; Codespaces exact forwarding-host+HTTPS-origin behind loopback; default limited contributor profile, no operator in Codespaces. Commands dev:editor:test / dev:editor:contribute / validate. Local test identity assigned only Journal overview+Lorem article and DE/EN; no events/nav/publication. GitHub contributor startup verifies /user and requires policy/contributors.json assignment (currently empty, actual login requested but not supplied). Content PR validator parses Git blobs only, uses base-branch policy and PR author; prepared pull_request_target workflow never runs candidate code. See docs/MIGRATION_PLAN.md, CONTRIBUTING_CONTENT.md, CODESPACES_ACCEPTANCE.md. Actual cloud/PR/bootstrap/deploy NOT performed; no push. Local browser+HTTP403 boundaries checked, server4321 test-profile session12406 kept running; screenshot bcb-test-contributor.png. Remote Codespaces and first third-party contribution remain next acceptance tasks.
Standalone website preview now has an explicit "Im Editor bearbeiten" link to the exact page. Editor accepts allowlisted ?page= ID, keeps current page in URL, and supports its existing in-frame preview/edit toggle. Browser verified preview→same article editor→preview→edit. Screenshot bcb-editor-return.png.
Journal reading refinement: article main uses bcb-journal-article, max800px single-column sections, stacked heading/lead, no panel backgrounds, restrained statement. New article creation uses same wrapper. Journal3 tests + syntax checks pass; browser computed all four sections display:block and main800px. Screenshot bcb-journal-reading.png. Still drafts; approved snapshot unchanged.
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
Real Codespaces/PR bootstrap and actual assigned GitHub account remain unverified; see MIGRATION_PLAN. Hosted multi-user identity still separate from a private single-owner Codespace. Cloudflare caching/invalidation; finer per-page publishing; navigation order and post-creation menu settings; article reading time and gallery-grid authoring; general dictionary translation review/source locale. Approved snapshot freezes HTML/meta/i18n/events, not renderer/CSS/asset bytes: code/media releases still need normal review. Server requires restart after integration edits.

# CURRENT TODOS
- [x] Suess chat/source audit and useful BCB feature transfer.
- [x] Same editor for articles, hierarchy/search, consistent preview/nav/teasers.
- [x] Full-site exact review/approval/rollback, policies and optimistic conflicts.
- [x]39 tests/build/browser evidence, exact restoration and committed handover.
- [x] Local Codespaces configuration, limited test identity, GitHub operator bootstrap, trusted Git-blob validator and contributor guide.
- [ ] Real GitHub target-branch bootstrap, assigned test account, actual Codespaces/PR acceptance; targeted caching/invalidation.

# NEXT RECOMMENDED TASK
Follow docs/MIGRATION_PLAN.md from step6: obtain actual GitHub test login, explicitly authorize remote bootstrap/push, install code/validator/policy on trusted target branch, assign contributor there, then run real private Codespaces and positive/negative PR acceptance. Do not mark migration complete from local tests. Multi-user hosted identity, per-article release granularity, operative staging migration, Cloudflare caches and dist-only deployment remain separate later gates. Keep participant operations independent. Inspect git status first.

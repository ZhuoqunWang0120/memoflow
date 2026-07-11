# Change Log

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: inspect whether a narrow Capacitor iOS shell spike is feasible without changing MemoFlow behavior
- Summary of changes:
  - added a docs-only Capacitor scouting report under `docs/overnight/`
  - documented that the current MemoFlow app is Node-server-first rather than static-web-asset-first
  - documented that the cleanest narrow spike would be a thin wrapper around an already-running MemoFlow server, not a bundled local-first shell
- Files changed:
  - `docs/overnight/20260708-023659-03_capacitor_scout.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,220p' package.json` -> confirmed `build`, `check`, `eval:smoke`, and Node server scripts
  - `sed -n '1,520p' src/webServer.ts` -> confirmed inline HTML routes, `/api/*` handlers, and serverful runtime
  - `sed -n '1,240p' public/sw.js` -> confirmed service worker caches only static install assets and skips navigations plus `/api/*`
  - `rg -n "OPENAI|MEMOFLOW_DATA_DIR|fs/promises|jsonl|process\\.env" ...` -> confirmed file-backed JSONL storage and env-bound OpenAI usage
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
  - `xcodebuild -version` -> `Xcode 15.4`
  - `xcode-select -p` -> `/Applications/Xcode.app/Contents/Developer`
  - `security find-identity -v -p codesigning` -> `0 valid identities found`
  - `pod --version` -> failed, `command not found`
- Decisions made:
  - keep this task documentation-only and do not add Capacitor
  - treat a bundled static Capacitor shell as a poor fit for the current architecture
  - recommend only a future thin-shell spike against an external MemoFlow server if implementation is revisited
- Risks or follow-ups:
  - current local toolchain is not ready for a real Capacitor iOS implementation because signing identities are absent and CocoaPods is unavailable
  - current Capacitor v8 docs indicate a newer Xcode baseline than the locally installed `15.4`
  - standalone on-device local-first MemoFlow would require architectural work beyond the allowed narrow spike
  - existing local web app behavior was preserved because this task was docs-only; no runtime behavior changes were made

## 2026-07-07

- Branch: `pwa/ios-installable-v0`
- Goal: make the existing local MemoFlow web app installable as a minimal iOS-friendly PWA without changing core behavior
- Summary of changes:
  - added manifest, placeholder icons, and iOS home-screen metadata for `/` and `/capture`
  - added conservative service worker support limited to static PWA assets
  - added install and manual test documentation for iPhone/PWA verification
  - kept storage, persistence, and server-side app flow unchanged
- Files changed:
  - `src/webServer.ts`
  - `src/webServerCaptureHtml.ts`
  - `public/manifest.webmanifest`
  - `public/sw.js`
  - `public/icons/icon.svg`
  - `public/icons/icon-192.png`
  - `public/icons/icon-512.png`
  - `public/icons/apple-touch-icon-180.png`
  - `docs/pwa-ios-install.md`
  - `docs/manual-pwa-test-checklist.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,220p' AGENTS.md` -> reviewed repo safety rules
  - `sed -n '1,260p' package.json` -> confirmed TypeScript + Node build scripts
  - `sed -n '1,260p' src/webServer.ts` -> confirmed server structure and routes
  - `sed -n '1,360p' src/webServerCaptureHtml.ts` -> confirmed capture page structure
  - `rg -n ...` repo searches -> confirmed no existing manifest/PWA files before this task
  - `node <<'NODE' ... NODE` -> generated placeholder PNG icons at `public/icons/`
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval` -> passed, `17/17`
  - `npm run eval:items` -> passed, `17/17`
  - `npm run eval:memory` -> passed, `11/11`
  - `npm run eval:context` -> passed, `15/15`
  - `npm run eval:capture` -> passed, `13/13`
  - `npm run dev` -> launched local server successfully
  - `curl -I http://127.0.0.1:3000/manifest.webmanifest` -> `200 OK`
  - `curl -I http://127.0.0.1:3000/sw.js` -> `200 OK`
  - `curl -I http://127.0.0.1:3000/icons/apple-touch-icon-180.png` -> `200 OK`
  - `curl -s http://127.0.0.1:3000/ | rg -n ...` -> confirmed manifest, touch icon, viewport-fit, and service worker registration in `/`
  - `curl -s http://127.0.0.1:3000/capture | rg -n ...` -> confirmed manifest, touch icon, viewport-fit, and service worker registration in `/capture`
- Decisions made:
  - kept the existing Node HTTP server and inline HTML architecture
  - used additive static asset routes instead of introducing a bundler or framework
  - limited service worker caching to manifest and icon assets to reduce stale-app risk
  - kept installed app start URL at `/` to preserve the current primary app surface
- Manual acceptance note:
  - Tested basic PWA use on iPhone.
  - App loaded successfully.
  - Basic capture/save flow appeared to work.
  - No obvious desktop/local regression observed.
- Risks or follow-ups:
  - same-network iPhone HTTP access may not activate service worker because secure-context rules still apply
  - iPhone home-screen installation and notch/safe-area behavior were not exercised on a physical device in this session
  - there is still no `lint` script
  - there is still no `test` script
  - Full service worker/offline behavior not verified unless tested over HTTPS or localhost.
  - No automated browser smoke test exists yet.

## 2026-07-07

- Branch: `pwa/ios-installable-v0`
- Goal: fix `/capture` mobile safe-area padding regression found during pre-commit PWA review
- Summary of changes:
  - preserved `env(safe-area-inset-*)` padding in the small-screen `/capture` media query
  - kept the existing compact mobile layout and capture behavior unchanged
- Files changed:
  - `src/webServerCaptureHtml.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '186,196p' src/webServerCaptureHtml.ts` -> confirmed the fixed-padding override
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:capture` -> passed, `13/13`
- Decisions made:
  - limited the fix to the mobile media-query override instead of changing base layout behavior
- Risks or follow-ups:
  - physical iPhone verification is still needed to confirm notch and home-indicator spacing

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: record the decision to defer multi-user implementation until after single-user PWA validation
- Summary of changes:
  - documented that the current PWA phase remains single-user
  - recorded the future direction for per-user shared records across phone and laptop
  - added a dedicated future multi-user design note
- Files changed:
  - `docs/change-log.md`
  - `docs/future-multi-user-design.md`
- Commands run and results:
  - `sed -n '1,260p' docs/change-log.md` -> reviewed existing change-log entries
  - `test -f docs/future-multi-user-design.md && ... || echo missing` -> confirmed the design doc did not exist yet
- Decisions made:
  - do not add users or auth during the current PWA stabilization phase
  - test and iterate the single-user PWA first
  - revisit multi-user only after single-user behavior is stable
- Risks or follow-ups:
  - the current sharing model is only appropriate for one user hitting one server/store
  - future multi-user support will require user isolation, auth, and server-owned persistence

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: document implementation sequencing between single-user sync and future multi-user work
- Summary of changes:
  - clarified that the next implementation target is single-user phone+laptop sync
  - clarified that multi-user remains deferred until after single-user PWA and sync behavior are stable
  - updated the future multi-user design note with explicit sequencing
- Files changed:
  - `docs/change-log.md`
  - `docs/future-multi-user-design.md`
- Commands run and results:
  - `sed -n '1,260p' docs/future-multi-user-design.md` -> reviewed the current future multi-user note
  - `sed -n '1,320p' docs/change-log.md` -> reviewed existing decision entries
- Decisions made:
  - next implementation focus is single-user sync, not multi-user
  - future multi-user work should build on a backend-centered source-of-truth model rather than client-side sync
- Risks or follow-ups:
  - the current repo still has no implemented single-user sync path beyond one shared running server/store
  - future multi-user work still requires separate auth and persistence design

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: make iPhone LAN/mobile-hotspot testing easier without changing app behavior
- Summary of changes:
  - kept the server default bind on `127.0.0.1`
  - added a dedicated `npm run dev:lan` command for binding to `0.0.0.0`
  - updated iPhone testing documentation with exact LAN/hotspot steps
- Files changed:
  - `package.json`
  - `docs/pwa-ios-install.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,80p' src/webServer.ts` -> confirmed default bind is `127.0.0.1` with `HOST` env override support
  - `sed -n '1,220p' package.json` -> confirmed no existing LAN dev script
  - `sed -n '1,260p' docs/pwa-ios-install.md` -> reviewed existing iPhone instructions
  - `npm run build` -> pending
- Decisions made:
  - left app binding behavior unchanged by default for dev safety
  - exposed LAN testing through a dedicated script instead of changing the default host
- Risks or follow-ups:
  - LAN/hotspot reachability still depends on network configuration and Mac firewall settings

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: add automated smoke coverage for the PWA surface before more product work
- Summary of changes:
  - added a dedicated smoke eval that boots the real web server on a temp data dir
  - added automated checks for `/`, `/capture`, `/manifest.webmanifest`, `/sw.js`, and app icons
  - exposed the smoke eval as `npm run eval:smoke`
- Files changed:
  - `package.json`
  - `src/eval/runSmokeEval.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,220p' package.json` -> reviewed current scripts
  - `sed -n '1,280p' src/eval/runCaptureEval.ts` -> reviewed existing eval structure
  - `rg -n ...` -> confirmed there was no dedicated smoke eval yet
  - `npm run build` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
  - `npm run eval` -> passed, `17/17`
  - `npm run eval:items` -> passed, `17/17`
  - `npm run eval:memory` -> passed, `11/11`
  - `npm run eval:context` -> passed, `15/15`
  - `npm run eval:capture` -> passed, `13/13`
- Decisions made:
  - used the compiled real server instead of a partial in-test stub
  - isolated smoke runs with a temp `MEMOFLOW_DATA_DIR` so local data is untouched
- Risks or follow-ups:
  - there is still no browser-driven UI smoke test

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: add passive review-correction logging for reviewed suggestions without changing parser behavior
- Summary of changes:
  - added append-only local correction-event storage for meaningful reviewed proposal edits
  - logged correction events from reviewed suggestion saves in both web and CLI review flows
  - added a focused correction eval plus parser-quality documentation
- Files changed:
  - `.gitignore`
  - `package.json`
  - `README.md`
  - `src/index.ts`
  - `src/itemsCli.ts`
  - `src/webServer.ts`
  - `src/eval/runCorrectionEval.ts`
  - `src/schemas/correctionEvent.ts`
  - `src/services/correctionEventService.ts`
  - `src/services/reviewedSuggestionSaveService.ts`
  - `docs/product/parser-quality-log.md`
  - `docs/change-log.md`
- Commands run and results:
  - `rg -n ...` -> traced the reviewed-save flow and confirmed no existing correction log
  - `sed -n ...` on approval, schema, item store, and eval files -> confirmed the minimal extension points
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:corrections` -> passed, `4/4`
  - `npm run eval` -> passed, `17/17`
  - `npm run eval:items` -> passed, `17/17`
  - `npm run eval:memory` -> passed, `11/11`
  - `npm run eval:context` -> passed, `15/15`
  - `npm run eval:capture` -> passed, `13/13`
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - stored correction events in local append-only JSONL to match existing persistence patterns
  - only logged events when the saved item meaningfully differs from the proposal baseline
  - treated `clarify_needed` proposals specially so edited saves can still produce a useful before snapshot
- Risks or follow-ups:
  - proposal ids are lightweight review-session identifiers, not durable globally unique parser ids
  - correction events are not yet summarized or consumed by parser logic

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: make archived items reversible from the sidebar item list without changing item behavior elsewhere
- Summary of changes:
  - added an explicit `Unarchive` action for archived items in the sidebar item list
  - added a dedicated unarchive item route and store helper
  - kept item filtering, persistence location, and archive behavior unchanged
- Files changed:
  - `src/webServer.ts`
  - `src/services/itemStoreService.ts`
  - `src/eval/runItemLedgerEval.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n ... src/webServer.ts` -> confirmed archived items only had `Archive`
  - `sed -n ... src/services/itemStoreService.ts` -> confirmed archive set `status: archived` and `archived_at`
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:items` -> passed, `18/18`
- Decisions made:
  - used a dedicated `/api/items/:id/unarchive` action instead of widening generic item patch behavior
  - when unarchiving an item whose status is currently `archived`, restore the type default active status because the prior pre-archive status is not stored
- Risks or follow-ups:
  - unarchive restores the type default active status, not the exact pre-archive status

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: make review/edit status and date behavior match what the item list shows
- Summary of changes:
  - changed review and edit date fields to native date inputs with `yyyy-mm-dd` guidance
  - changed review and edit status fields from free-text inputs to constrained selects
  - fixed resolved `clarify_needed` saves so they do not persist `needs_clarification` by accident
  - changed item list rows to show exact stored status and prefer due/follow-up dates over generic updated timestamps
- Files changed:
  - `src/webServer.ts`
  - `src/services/suggestionApprovalService.ts`
  - `src/eval/runCorrectionEval.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `rg -n ... src/webServer.ts src/services` -> confirmed current status/date rendering and save paths
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:items` -> passed, `18/18`
  - `npm run eval:corrections` -> passed, `5/5`
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - item list now prefers `due_date`, then `follow_up_date`, then `updated_at`
  - item list now shows exact stored status instead of collapsing `ready/open/saved` to `ready`
  - inherited `needs_clarification` is normalized to the chosen type default when a clarify suggestion is resolved and saved
- Risks or follow-ups:
  - native date inputs depend on browser support and locale UI, though submitted values remain `yyyy-mm-dd`

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: hide item-list date text when no due date or follow-up date exists
- Summary of changes:
  - removed the item-list fallback that showed `updated_at` when no task date fields were present
  - kept due-date and follow-up-date display unchanged when those fields exist
- Files changed:
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `npm run build` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - an item row without `due_date` or `follow_up_date` now shows no date text at all

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: show `ready`, `open`, and `saved` as `ready` in the UI without changing stored statuses
- Summary of changes:
  - restored grouped status display in the item list so the three default active states render as `ready`
  - kept raw stored status values unchanged for saving, filtering, and editing
- Files changed:
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `npm run build` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - this is presentation-only; no persistence or API behavior changed

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: fix iPhone mobile/PWA layout overflow and wrapping issues without changing app behavior
- Summary of changes:
  - added global mobile overflow guards and text-size adjustment protection
  - removed row-level `nowrap` behavior that was clipping saved item titles and memory text on narrow screens
  - made mobile tabs horizontally scrollable inside the nav instead of risking page overflow
  - increased bottom safe-area padding so Safari/PWA bottom chrome does not cover the last rows
  - stabilized mobile item-title sizing and added two-line clamping for item titles
- Files changed:
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `mcp__stitch.list_projects` -> blocked, `Auth required`
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: remove legacy `clarify_needed` type leakage and tighten shared mobile layout rules without changing MemoFlow's storage model
- Summary of changes:
  - normalized suggestion parsing so ambiguous proposals keep a valid item type and use `needs_clarification` as status and review state instead of an invalid type
  - updated the LLM response schema and prompt guidance to stop requesting `clarify_needed` as a type
  - removed mobile item-title and memory-text clamping, reduced item-card density, and increased shared bottom safe-area padding so fixed nav does not cover content
  - documented reusable mobile alignment, spacing, typography, card, form, and safe-area rules in `DESIGN.md`
- Files changed:
  - `src/parsers/openAiSuggestionParser.ts`
  - `src/parsers/stubSuggestionParser.ts`
  - `src/services/suggestionService.ts`
  - `src/services/suggestionApprovalService.ts`
  - `src/services/suggestionNormalizationService.ts`
  - `src/prompts/dumpToSuggestions.ts`
  - `src/itemsCli.ts`
  - `src/eval/golden_cases.jsonl`
  - `src/eval/runCorrectionEval.ts`
  - `src/webServer.ts`
  - `DESIGN.md`
  - `docs/change-log.md`
- Commands run and results:
  - `rg -n "clarify_needed|needs_clarification|..." ...` -> confirmed remaining legacy type usage in parser, prompt, eval, and UI paths
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval` -> passed, `17/17`
  - `npm run eval:corrections` -> passed, `5/5`
  - `npm run eval:smoke` -> passed, `5/5`
  - `npm run screenshots:mobile` -> passed, generated screenshots for `375x812`, `390x844`, and `430x932` with no horizontal overflow reported on Capture, Items, Memory, Pending, or pending-review variants
- Decisions made:
  - ambiguous suggestions now stay within the four valid item types and use `needs_clarification` only as review state
  - ambiguous fallback type normalization defaults to the closest safe valid type instead of preserving an invalid enum value
  - mobile list titles now prefer full wrapping over truncation, even when this makes cards taller
- Risks or follow-ups:
  - older example markdown files still contain historical `clarify_needed` language outside the prompt extraction path and may need a later documentation cleanup
  - visual verification still depends on the screenshot pass because the app uses inline server-rendered HTML and CSS

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: tighten two remaining mobile layout details without changing app behavior
- Summary of changes:
  - contained the pending-review secondary field grid more strictly so the date control stays inside its bordered panel
  - moved item-row status and category pills into the same row as `Edit` and `Archive` / `Unarchive` so saved item titles have more horizontal room
- Files changed:
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `npm run build` -> pending
- Decisions made:
  - kept the item-row title/date hierarchy intact and only moved status/category into the action row
  - fixed the date-field overflow with CSS containment instead of changing the form structure
- Risks or follow-ups:
  - physical iPhone confirmation is still useful for the date input because iOS renders the native control chrome differently from desktop browsers

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: align saved item rows so type and status sit with the action row instead of above the title
- Summary of changes:
  - moved the saved-item type badge into the same row as status and edit/archive actions
  - removed category display from saved item rows so titles have more horizontal space
- Files changed:
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `npm run build` -> pending
- Decisions made:
  - kept due/follow-up date under the title and limited the row change to type/status placement only

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: keep saved-item type/status badges and edit/archive actions on the same mobile row when space allows
- Summary of changes:
  - removed the mobile rule that forced the type/status badge group to take the full width of the action row
  - kept the item-row layout otherwise unchanged
- Files changed:
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `npm run build` -> pending
- Decisions made:
  - preferred a single compact action row on mobile, with wrapping only as a fallback when space truly runs out

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: right-align saved-item edit/archive actions on mobile without changing the rest of the row layout
- Summary of changes:
  - pushed the saved-item badge group to the left and the `Edit` / `Archive` actions to the right within the mobile action row
- Files changed:
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `npm run build` -> pending
  - Playwright viewport checks at `390px` and `430px` -> blocked in this environment because both local Chromium and WebKit crashed before rendering
- Decisions made:
  - kept the fix mobile-first and CSS-scoped instead of redesigning row structure deeply
  - kept saved statuses, data model, routes, and PWA behavior unchanged
  - used a local fallback design synthesis in `DESIGN.md` because Stitch project access was unavailable in this session

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: organize the post-PWA v0 roadmap and backlog without changing app behavior
- Summary of changes:
  - added concise product planning docs for roadmap, backlog, parser-quality loop, i18n sequencing, and future account-sync/multi-user direction
  - kept the planning sequence anchored on preserving the working local web app before new surface or architecture work
  - documented that auth, `user_id`, backend sync, and multi-user remain explicitly deferred
- Files changed:
  - `docs/product/roadmap.md`
  - `docs/product/backlog.md`
  - `docs/product/parser-quality-log.md`
  - `docs/product/i18n-plan.md`
  - `docs/product/future-account-sync-multi-user.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,220p' AGENTS.md` -> reviewed repo safety and reporting requirements
  - `git branch --show-current` -> `pwa/ios-installable-v0`
  - `rg --files docs` -> reviewed existing docs layout
  - `sed -n '1,240p' docs/change-log.md` -> reviewed existing change-log entries
  - `sed -n '1,240p' package.json` -> reviewed available verification scripts
  - `sed -n '1,220p' docs/product/parser-quality-log.md` -> reviewed existing parser-quality note before updating it
  - `sed -n '1,240p' docs/future-multi-user-design.md` -> reviewed prior future-direction note for alignment
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
  - `npm run eval` -> passed, `17/17`
  - `npm run eval:items` -> passed, `18/18`
  - `npm run eval:memory` -> failed due existing repo-state error: `SyntaxError` because `../parsers/stubSuggestionParser.js` does not export `stubSuggestionParser`
  - `npm run eval:context` -> passed, `15/15`
  - `npm run eval:capture` -> passed, `13/13`
  - `npm run eval:corrections` -> passed, `5/5`
- Decisions made:
  - created new canonical planning docs under `docs/product/` instead of changing app code or storage
  - kept the roadmap order exactly aligned with the requested sequence
  - treated account-owned sync, single-account sync, and hosted multi-user as separate later phases
- Risks or follow-ups:
  - there is now both `docs/future-multi-user-design.md` and `docs/product/future-account-sync-multi-user.md`; the product doc should be treated as the current planning entry unless the older root doc is later consolidated
  - the roadmap is documentation only and does not prove priority commitment beyond the current planning intent
  - one existing repo eval is currently failing outside this docs change because of the `stubSuggestionParser` export mismatch in the current worktree

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: move the main MemoFlow web UI toward a mobile-first PWA shell without changing app behavior or storage
- Summary of changes:
  - documented a Stitch-inspired mobile design direction in `DESIGN.md` without treating Stitch mockups as functional spec
  - converted the main web UI to a mobile app shell with a fixed bottom nav and safe-area-aware content padding
  - made the Items screen search-first on mobile with quick filter chips and collapsible advanced filters
  - restyled saved items, memory rows, and pending/review cards to better fit iPhone-width screens
  - kept the existing tabs, routes, item/memory flows, local persistence, and review behavior unchanged
- Files changed:
  - `DESIGN.md`
  - `docs/mobile-pwa-ui-plan.md`
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,700p' src/webServer.ts` and targeted `rg -n ... src/webServer.ts` -> reviewed current shell, mobile CSS, and filter/review wiring
  - `mcp__stitch.list_projects` -> blocked, `Auth required`
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
  - `npm run dev` -> launched local server at `http://127.0.0.1:3000`
  - `agent.browsers.list()` via in-app browser runtime -> returned `[]`
  - viewport verification at `390px` and `430px` in the in-app browser -> blocked because no in-app browser was available in this session
- Decisions made:
  - used Stitch only as visual direction and synthesized the selected hybrid mobile design locally in `DESIGN.md`
  - made quick chips the primary mobile filter affordance while leaving advanced filters available behind a disclosure
  - stopped truncating memory preview text in JavaScript and instead relied on mobile-safe wrapping/clamping in CSS
  - kept all changes inside the existing inline HTML/CSS/JS web shell instead of introducing new UI dependencies or architecture
- Risks or follow-ups:
  - viewport behavior at exact `390px` and `430px` widths is not visually confirmed in this session because browser automation was unavailable
  - Stitch project creation/design-system sync is still blocked until Stitch authentication is available
  - the desktop and local web flows appear preserved by code review plus build/check/smoke coverage, but there is still no full browser-driven UI regression suite

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: establish a real laptop render-and-inspect loop for MemoFlow mobile PWA UI fixes and use it for up to three visual passes
- Summary of changes:
  - added a reusable Playwright mobile screenshot runner with seeded local data and viewport captures for `Capture`, `Items`, `Memory`, `Pending`, and `Pending Review`
  - added a README note and npm script for rerunning the mobile screenshot loop locally
  - replaced the bottom-nav icon-font dependency with CSS-masked inline icons so screenshots no longer fall back to literal strings like `add_circle`
  - used three screenshot passes to tighten capture controls, reduce mobile item-title scale, improve memory card text density, and verify pending-review date and bottom-action layout
- Files changed:
  - `package.json`
  - `README.md`
  - `scripts/mobile-screenshots.mjs`
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `node -e "import('playwright')..."` -> confirmed Playwright was installed but sandboxed Chromium and WebKit launches crashed
  - `npm run screenshots:mobile` inside sandbox -> failed because Chrome aborted in the sandbox
  - `npm run screenshots:mobile` outside sandbox -> passed after enabling the broader machine permission flow
  - first screenshot pass -> revealed a script data-path bug that left `Items`, `Memory`, and `Pending` empty
  - second screenshot pass -> generated populated viewport screenshots at `375x812`, `390x844`, and `430x932`
  - third screenshot pass -> regenerated final screenshots after the last small CSS adjustments and added explicit bottom-action review captures
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - used viewport screenshots instead of `fullPage` screenshots because the fixed bottom nav made full-page captures misleading for mobile review
  - kept the screenshot loop isolated under `data/mobile-screenshots/` and `screenshots/mobile/`
  - treated Stitch only as visual direction; all UI changes stayed inside the existing app shell and functional flows
  - stopped after three visual passes as requested
- Risks or follow-ups:
  - the review title field still uses a single-line input, so long text is naturally horizontally scrollable inside the input itself even though the page no longer overflows
  - the Items screen still uses horizontally scrollable quick chips on mobile; this is intentional, but further visual polish is possible later
  - there is still no lint script
  - there is still no browser-driven assertion suite beyond the screenshot loop and smoke eval

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: remove the stub parser from the MemoFlow web product surface
- Summary of changes:
  - changed the web suggestion API default parser from `stub` to `llm`
  - removed the parser selector from the main capture screen and pending-review setup
  - kept stub parser support available for internal CLI and eval usage
- Files changed:
  - `src/webServer.ts`
  - `docs/change-log.md`
- Commands run and results:
  - `rg -n "stubSuggestionParser|parser"` across `src`, `README.md`, and `docs` -> traced product-facing and internal stub-parser usage
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
  - `npm run eval:memory` -> passed, `11/11`
- Decisions made:
  - treated stub as internal/eval-only instead of a web product option
  - limited the change to the web surface instead of rewriting parser internals or CLI flows
- Risks or follow-ups:
  - README and flowchart docs still mention the stub parser as part of the broader implementation; update those later if you want the documentation to match the new product-facing stance

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: add a minimal i18n scaffold for future Simplified Chinese UI support without changing current English MemoFlow behavior
- Summary of changes:
  - added a small local UI-string scaffold with English defaults, stable keys, and an empty `zh-CN` placeholder
  - centralized obvious user-facing strings across the main web app shell and the dedicated `/capture` surface
  - updated the i18n product doc with the actual scaffold shape, future `zh-CN` path, and the boundary between UI translation and parser behavior
- Files changed:
  - `src/i18n/uiStrings.ts`
  - `src/webServer.ts`
  - `src/webServerCaptureHtml.ts`
  - `src/index.ts`
  - `docs/product/i18n-plan.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,220p' AGENTS.md` -> reviewed repo safety and reporting requirements
  - `git branch --show-current` -> `pwa/ios-installable-v0`
  - `git checkout -b i18n/scaffold` -> failed because this environment cannot write new git refs under `.git/refs/heads/`
  - `sed -n ... src/webServer.ts` and `sed -n ... src/webServerCaptureHtml.ts` -> reviewed inline HTML and client-side UI string surfaces
  - `sed -n '1,220p' docs/product/i18n-plan.md` -> reviewed the pre-existing i18n planning note before updating it
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval` -> passed, `17/17`
  - `npm run eval:items` -> passed, `18/18`
  - `npm run eval:memory` -> passed, `11/11`
  - `npm run eval:context` -> passed, `15/15`
  - `npm run eval:capture` -> first run failed because `/capture` source included unrelated UI strings via the full inline dictionary; after narrowing the inline subset it passed, `13/13`
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - used a local dictionary/helper instead of adding an i18n dependency
  - kept English as the only active locale and left `zh-CN` as a documented placeholder
  - limited the scaffold to obvious user-facing strings in the current inline web surfaces instead of attempting full repo-wide string extraction
  - kept parser prompts, parser behavior, correction logging, storage, and PWA behavior unchanged
- Risks or follow-ups:
  - string coverage is intentionally partial; some less-obvious or non-UI copy remains outside the scaffold
  - there is still no locale selection mechanism or persisted UI-language preference
  - if future tests inspect raw HTML source, route-specific inline dictionaries should stay scoped to avoid false positives from hidden strings

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: update the product backlog with additional future feature ideas and safety guardrails without changing implementation scope
- Summary of changes:
  - reorganized the backlog into process-oriented priority and status sections instead of the earlier `Now/Next/Later` shape
  - added backlog entries for input and item injection safety guardrails, reminder support, voice and wearable capture, and Google Calendar or Workspace integration
  - recorded that these entries are backlog and safety-planning items only, not current implementation work
- Files changed:
  - `docs/product/backlog.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,260p' docs/product/backlog.md` -> reviewed the existing backlog structure before reorganizing it
  - `tail -n 80 docs/change-log.md` -> reviewed recent change-log entry format
  - `git branch --show-current` -> `pwa/ios-installable-v0`
  - `npm run build` -> passed
  - `npm run check` -> passed
- Decisions made:
  - kept all new ideas in the backlog rather than creating implementation tickets in code
  - elevated safety guardrails into their own section so they remain visible before future integrations or automatic actions
  - kept the backlog focused on narrow future milestones and design questions rather than feature commitments
- Risks or follow-ups:
  - backlog priority labels are planning guidance only and should be revisited at the next major roadmap decision point
  - reminder support and Google integration both depend on later storage, UX, and safety-boundary decisions

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: refine the voice-dump backlog item with a clearer mobile-first and wearable-safety boundary
- Summary of changes:
  - updated the voice-dump backlog entry so v0 starts as mobile capture input
  - clarified that wearable support should remain dump-only
  - added the requirement to define a stable raw-dump creation boundary before wearable work
  - deferred watch and glasses work until a native shell or sync path exists
- Files changed:
  - `docs/product/backlog.md`
  - `docs/change-log.md`
- Commands run and results:
  - `rg -n "Voice dump input / wearable capture surface|wearable|voice dump" docs/product/backlog.md docs/change-log.md` -> located the current backlog entry and recent backlog log context
  - `sed -n '1,260p' docs/product/backlog.md` -> reviewed the current backlog structure and voice-dump wording before updating it
  - `npm run build` -> passed
  - `npm run check` -> passed
- Decisions made:
  - kept the update limited to backlog wording only
  - treated wearable capture as a later, narrower extension of raw-dump capture rather than a general mobile workflow
  - made native-shell or sync availability an explicit prerequisite for watch or glasses work
- Risks or follow-ups:
  - the raw-dump creation boundary itself still needs a later design note before any voice or wearable implementation work starts

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: add a clearer backlog item for a future user system with per-user device sync and cross-user isolation
- Summary of changes:
  - replaced the older combined sync and multi-user parking-lot placeholder with a clearer user-system backlog item
  - documented that future data should sync across a given user's own devices but not across different users
  - kept hosted multi-user as a separate later-phase backlog track
- Files changed:
  - `docs/product/backlog.md`
  - `docs/change-log.md`
- Commands run and results:
  - `rg -n "Account-owned sync|multi-user|users|sync" docs/product/backlog.md docs/change-log.md docs/product/future-account-sync-multi-user.md` -> reviewed existing sync and multi-user backlog/design notes for alignment
  - `sed -n '1,260p' docs/product/backlog.md` -> reviewed the current backlog structure before updating the parking-lot sync item
  - `sed -n '1,220p' docs/product/future-account-sync-multi-user.md` -> reviewed the current future-direction note so the backlog wording stayed aligned
  - `npm run build` -> passed
  - `npm run check` -> passed
- Decisions made:
  - treated the user system as its own backlog concept rather than hiding it inside a generic multi-user placeholder
  - separated same-user cross-device sync from hosted multi-user product scope
  - kept this as planning only with no auth, sync, or data-model implementation work
- Risks or follow-ups:
  - the backlog now describes the product target more clearly, but the eventual user/account boundary still needs a dedicated design pass before implementation work starts

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: add concise backlog notes for friends-alpha LLM/provider safety boundaries and lightweight alpha access control
- Summary of changes:
  - added a backlog item for keeping LLM provider calls and API keys server-side with a configurable future provider boundary
  - added a backlog item for a lightweight friends-alpha access code ahead of broader HTTPS PWA sharing
  - recorded that these are backlog and safety-planning items only, not current implementation scope
- Files changed:
  - `docs/product/backlog.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,260p' docs/product/backlog.md` -> reviewed the current backlog structure before inserting the new safety notes
  - `tail -n 80 docs/change-log.md` -> reviewed recent change-log formatting before appending this entry
  - `npm run build` -> pending
  - `npm run check` -> pending
- Decisions made:
  - kept provider choice as a future configuration concern rather than a current parser change
  - kept alpha access code separate from future auth, user, and sync work
  - kept the update docs-only with no behavior changes
- Risks or follow-ups:
  - provider reachability for mainland China testers remains a deployment-time decision until provider abstraction or switching is designed
  - even a lightweight alpha access code should be reviewed alongside broader abuse/cost controls before public sharing

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: add a backlog note for possible future LLM provider router/aggregator exploration
- Summary of changes:
  - added a backlog exploration item for evaluating router/aggregator services across providers such as OpenAI, DeepSeek, and MiniMax
  - captured cost, privacy, logging/retention, quality-consistency, and China-accessibility considerations
  - recorded that this is exploration only, not current implementation scope
- Files changed:
  - `docs/product/backlog.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '100,220p' docs/product/backlog.md` -> reviewed the current LLM/provider safety section before inserting the exploration note
  - `tail -n 80 docs/change-log.md` -> reviewed recent change-log entries for formatting
  - `npm run build` -> passed
  - `npm run check` -> passed
- Decisions made:
  - kept provider routing as a future strategy decision rather than a current parser/backend change
  - explicitly called out the risk of unstable free-quota dependence for friends-alpha
  - kept the update docs-only
- Risks or follow-ups:
  - any future router/aggregator evaluation will need privacy and retention review before real user dump traffic is sent through it

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: add a short ASR/TTS note to the voice-input backlog item
- Summary of changes:
  - added `ASR` as a future speech-to-text raw-dump capture keyword under the voice-input backlog item
  - added `TTS` as a later optional exploration note rather than a current implementation target
- Files changed:
  - `docs/product/backlog.md`
  - `docs/change-log.md`
- Commands run and results:
  - `rg -n "Voice dump input / wearable capture surface|speech-to-text|voice" docs/product/backlog.md docs/change-log.md` -> located the current voice-input backlog item and recent related log entries
  - `sed -n '48,92p' docs/product/backlog.md` -> reviewed the current voice-input backlog wording before appending the keywords note
  - `npm run build` -> passed
  - `npm run check` -> passed
- Decisions made:
  - kept `ASR`/`TTS` as concise backlog keywords only
  - treated `ASR` as more directly relevant than `TTS` for the current voice-dump concept
  - kept the update docs-only with no product behavior change

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: update the roadmap ordering after i18n scaffold completion and pre-alpha planning changes
- Summary of changes:
  - marked `i18n scaffold` as done in the roadmap
  - moved friends-alpha safety checks and a narrow Capacitor iOS shell spike ahead of Chinese UI v0
  - moved the parser quality loop to a later explicit milestone after the alpha-groundwork steps
- Files changed:
  - `docs/product/roadmap.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,220p' docs/product/roadmap.md` -> reviewed the prior roadmap ordering before updating it
  - `tail -n 80 docs/change-log.md` -> reviewed recent change-log formatting before appending this entry
  - `git branch --show-current` -> `pwa/ios-installable-v0`
  - `npm run build` -> passed
  - `npm run check` -> passed
- Decisions made:
  - treated the roadmap update as planning-only and did not change backlog implementation scope
  - kept the Chinese UI milestone after alpha-safety and iOS-shell discovery work
  - kept account/sync work out of the immediate numbered sequence you supplied
- Risks or follow-ups:
  - the updated roadmap still depends on cleaning up the current branch/repo state before using it as a precise execution queue

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: add a safe overnight Codex orchestration workflow for autonomous inspection/docs work
- Summary of changes:
  - added an asyncio-based local orchestrator for running multiple `codex exec` workers in parallel or sequentially
  - added worker prompt templates for repo inspection, alpha safety, Capacitor scouting, backlog/docs review, and PM summarization
  - added a short workflow doc describing outputs, safe defaults, and usage
- Files changed:
  - `scripts/overnight_codex_sprint.py`
  - `prompts/overnight/01_repo_inspector.md`
  - `prompts/overnight/02_alpha_safety_inspector.md`
  - `prompts/overnight/03_capacitor_scout.md`
  - `prompts/overnight/04_backlog_docs_worker.md`
  - `prompts/overnight/99_pm_summarizer.md`
  - `docs/product/overnight-workflow.md`
  - `docs/change-log.md`
- Commands run and results:
  - `find scripts -maxdepth 2 -type f | sort` -> reviewed existing script conventions
  - `codex exec --help` -> confirmed non-interactive stdin-based prompt usage and safe CLI flags
  - `python3 --version` -> confirmed Python 3.9.6 for asyncio compatibility
  - `python3 -m py_compile scripts/overnight_codex_sprint.py` -> blocked by macOS Python cache-directory permission, not by script syntax
  - `python3 -c "from pathlib import Path; compile(...)"` -> passed, `syntax ok`
  - `python3 scripts/overnight_codex_sprint.py --dry-run` -> passed, printed planned workers/log paths/handoff path
  - `npm run build` -> passed
  - `npm run check` -> passed
- Decisions made:
  - used prompt templates plus runtime placeholder substitution instead of hardcoding large prompts inside Python
  - kept worker scope inspection/docs-first and non-destructive by default
  - kept the orchestrator local-only and did not auto-run the full overnight workflow in this task

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: allow the overnight Codex orchestrator to request unattended worker approval mode without dropping workspace sandboxing
- Summary of changes:
  - added `--approval-mode` to the overnight orchestrator with `default` and `never`
  - kept worker command sandboxing on `workspace-write`
  - made the script detect whether the local Codex CLI advertises `--ask-for-approval` and fail clearly if `never` is requested on an unsupported build
  - updated the workflow doc with the unattended command shape and risk note
- Files changed:
  - `scripts/overnight_codex_sprint.py`
  - `docs/product/overnight-workflow.md`
  - `docs/change-log.md`
- Commands run and results:
  - `codex exec --help` -> confirmed this local CLI advertises `--sandbox` and the dangerous bypass flag, but does not advertise `--ask-for-approval`
  - `python3 scripts/overnight_codex_sprint.py --dry-run --approval-mode never` -> expected clear failure because the local CLI does not advertise the required flag
  - `python3 scripts/overnight_codex_sprint.py --dry-run` -> passed, printed exact planned worker commands and log paths
  - `python3 -c "from pathlib import Path; compile(Path('scripts/overnight_codex_sprint.py').read_text(encoding='utf-8'), 'scripts/overnight_codex_sprint.py', 'exec'); print('syntax ok')"` -> passed, `syntax ok`
  - `npm run build` -> passed
  - `npm run check` -> passed
- Decisions made:
  - preserved sandboxing and explicitly did not use `--dangerously-bypass-approvals-and-sandbox`
  - chose explicit flag detection over guessing hidden or renamed approval settings
  - kept unattended mode opt-in rather than default
- Risks or follow-ups:
  - unattended mode depends on a Codex CLI build that actually supports `--ask-for-approval`
  - if Carol upgrades or switches Codex CLI versions, she should re-run the dry run to confirm the exact worker command shape

## 2026-07-08

- Branch: `pwa/ios-installable-v0`
- Goal: capture a backlog note about review fatigue from low-value item descriptions
- Summary of changes:
  - added a backlog exploration item for default-off or more selective descriptions during review
  - recorded this as a future workflow simplification idea, not current implementation scope
- Files changed:
  - `docs/product/backlog.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,260p' docs/product/backlog.md` -> reviewed the current backlog structure and placement for review-flow ideas
  - `tail -n 80 docs/change-log.md` -> reviewed recent change-log formatting before appending this entry
  - `npm run build` -> passed
  - `npm run check` -> passed
- Decisions made:
  - framed the issue as review-workflow fatigue rather than an immediate parser bug
  - kept the note evidence-seeking and deferred any behavior change
- Risks or follow-ups:
  - this may intersect later with parser output defaults and review-surface ergonomics
  - any implementation should be validated against real review examples so useful context is not stripped too aggressively

## 2026-07-11

- Branch: `pwa/ios-installable-v0`
- Goal: perform a focused friends-alpha safety audit and repo cleanup plan without changing product behavior
- Summary of changes:
  - added an overnight audit note covering storage paths, shared-data implications, LLM/API-key boundaries, and service-worker caching
  - added a repo cleanup plan that classifies the dirty tree into runtime, tooling, docs, orchestration, generated, sensitive, and human-review buckets
  - kept the task inspection-only and did not change app/runtime behavior
- Files changed:
  - `docs/overnight/alpha-safety-audit.md`
  - `docs/overnight/repo-cleanup-plan.md`
  - `docs/change-log.md`
- Commands run and results:
  - `sed -n '1,220p' AGENTS.md` -> reviewed repo safety rules
  - `git status --short` -> confirmed the repo is heavily dirty across runtime, tooling, docs, and generated artifacts
  - `rg -n ...` across `src/`, `public/`, `docs/`, `package.json`, and `README.md` -> mapped storage, provider calls, service-worker behavior, and repo artifact locations
  - `find data ...` and `find logs ...` -> confirmed local JSONL stores and overnight log artifacts present in the workspace
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - treated the current shared server/file-backed data model as the main blocker for any shared friends-alpha
  - treated the current server-side provider/API-key boundary as acceptable to keep, but not sufficient to make alpha ready
  - treated `logs/`, screenshot outputs, and generated data subtrees as cleanup targets rather than default commit candidates
- Risks or follow-ups:
  - a lightweight alpha access code would not solve the current shared-data problem between different testers
  - repo acceptance still needs human review and commit separation before this branch should be treated as a clean merge unit

## 2026-07-11

- Branch: `pwa/ios-installable-v0`
- Goal: perform the immediate repo-cleanup prep step before account-system work
- Summary of changes:
  - expanded `.gitignore` to hide generated overnight logs, generated screenshot outputs, generated mobile-screenshot data, and generated overnight handoff/report artifacts
  - updated the repo cleanup plan with exact suggested staging groups for docs, tooling, runtime, and mixed-risk files
  - kept real runtime and planning work visible in `git status` for human review instead of hiding it behind broad ignore rules
- Files changed:
  - `.gitignore`
  - `docs/overnight/repo-cleanup-plan.md`
  - `docs/change-log.md`
- Commands run and results:
  - `git status --short` -> reviewed the dirty working tree before cleanup changes
  - `git status --short --ignored` -> confirmed local/generated artifacts are now ignored while real source changes remain visible
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - ignored generated overnight worker outputs by timestamp pattern instead of ignoring the whole `docs/overnight/` directory so curated audit notes can still be committed
  - did not ignore `Users/`, `DESIGN.md`, or runtime source files because they still need explicit human review
  - treated cleanup/staging order as the immediate prerequisite before account-system implementation
- Risks or follow-ups:
  - the branch is still mixed and should not be used as a clean feature baseline until the suggested staging groups are reviewed and separated
  - `README.md` and the broad runtime files still require deliberate acceptance review before staging

## 2026-07-11

- Branch: `pwa/ios-installable-v0`
- Goal: convert the mixed runtime bucket into an accepted staging plan after product-decision review
- Summary of changes:
  - updated the repo cleanup plan with accepted runtime decisions for parser default, unclear-suggestion semantics, unarchive, UI/mobile polish, and design/tooling retention
  - replaced the generic mixed-runtime bucket with concrete staging groups for correction logging, i18n, accepted parser/runtime semantics, unarchive, accepted UI polish, and accepted design/orchestration files
  - kept the task planning-only and did not stage or commit anything
- Files changed:
  - `docs/overnight/repo-cleanup-plan.md`
  - `docs/change-log.md`
- Commands run and results:
  - `git diff --stat -- ...runtime files...` -> confirmed the accepted runtime bucket still spans parser semantics, correction logging, unarchive, and large web UI changes
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - treated Carol's approvals as enough to move parser default, removal of `clarify_needed`, unarchive, and UI/mobile polish out of the "needs product intent" bucket
  - kept `README.md` as a remaining deliberate review item because it may still combine multiple milestone claims
  - kept staging structure as the main remaining repo-hygiene problem before account-system work
- Risks or follow-ups:
  - `src/webServer.ts` still needs hunk-level staging because it mixes several accepted milestones in one file

## 2026-07-11

- Branch: `pwa/ios-installable-v0`
- Goal: record final acceptance of `README.md` in the repo cleanup plan
- Summary of changes:
  - marked `README.md` as accepted for commit in the cleanup plan
  - removed `README.md` from the remaining explicit review blockers
- Files changed:
  - `docs/overnight/repo-cleanup-plan.md`
  - `docs/change-log.md`
- Commands run and results:
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - treat `README.md` as acceptable to stage with the planning/docs group rather than holding it back as a special blocker
- Risks or follow-ups:
  - `src/webServer.ts` still needs hunk-level staging because it mixes several accepted milestones in one file

## 2026-07-11

- Branch: `pwa/ios-installable-v0`
- Goal: turn the `src/webServer.ts` and capture-page runtime mix into an exact hunk-level staging map
- Summary of changes:
  - added an exact hunk split recommendation for `src/webServer.ts`
  - added an exact split recommendation for `src/webServerCaptureHtml.ts`, including a pragmatic note that the capture file can usually be staged whole with the accepted i18n + UI polish commit
  - kept the task planning-only with no staging or runtime changes
- Files changed:
  - `docs/overnight/repo-cleanup-plan.md`
  - `docs/change-log.md`
- Commands run and results:
  - `rg -n ... src/webServer.ts src/webServerCaptureHtml.ts` -> mapped the main parser, review, unarchive, i18n, and UI-polish anchors inside the mixed files
  - `nl -ba src/webServer.ts ...` and `nl -ba src/webServerCaptureHtml.ts ...` -> collected exact line anchors for the recommended hunk groups
  - `npm run build` -> passed
  - `npm run check` -> passed
  - `npm run eval:smoke` -> passed, `5/5`
- Decisions made:
  - treated the parser-default and reviewed-save contract changes as one coherent hunk set
  - treated `unarchive` as its own hunk set
  - treated `webServerCaptureHtml.ts` as cleaner than `src/webServer.ts` and usually safe to stage whole with the accepted i18n + capture UI commit
- Risks or follow-ups:
  - `src/webServer.ts` still requires actual partial staging in git because the file remains physically mixed even though the conceptual split is now documented

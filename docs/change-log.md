# Change Log

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
- Risks or follow-ups:
  - same-network iPhone HTTP access may not activate service worker because secure-context rules still apply
  - iPhone home-screen installation and notch/safe-area behavior were not exercised on a physical device in this session
  - there is still no `lint` script
  - there is still no `test` script

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

# Webapp Baseline Before PWA

Date: 2026-07-07

## Current Branch

- `pwa/ios-installable-v0`

## App Framework / Build Setup

- Local-first TypeScript application with source in `src/`
- Node.js HTTP server in [`src/webServer.ts`](/Users/zhuoqunwang/playground/memoflow/src/webServer.ts:1)
- Inline HTML-based web UI served by the Node server, including a dedicated capture route in [`src/webServerCaptureHtml.ts`](/Users/zhuoqunwang/playground/memoflow/src/webServerCaptureHtml.ts:1)
- TypeScript compiler build only: `tsc` outputs `dist/` per [`package.json`](/Users/zhuoqunwang/playground/memoflow/package.json:1) and [`tsconfig.json`](/Users/zhuoqunwang/playground/memoflow/tsconfig.json:1)
- No frontend framework, bundler, service worker, manifest, or backend service is currently wired in this baseline
- Runtime dependencies are minimal: `dotenv` and `zod`

## Known Core Flows To Preserve

- Raw memo capture from the local webapp
- Save raw memo dumps for later review
- Generate provisional suggestions from a dump
- Review, edit, approve, or reject suggestions
- Save approved suggestions as durable items
- Browse, filter, sort, update, and archive items
- Create, edit, archive, and delete memory entries
- Use the dedicated `/capture` route for lightweight capture without changing the main workspace flow
- Keep storage local-first and file-backed; no required backend, auth, or cloud sync

These flows are described in [`README.md`](/Users/zhuoqunwang/playground/memoflow/README.md:1) and exposed through routes and APIs in [`src/webServer.ts`](/Users/zhuoqunwang/playground/memoflow/src/webServer.ts:1).

## Available Verification Commands

- `npm install`
- `npm run build`
- `npm run check`
- `npm run dev`
- `npm run eval`
- `npm run eval:items`
- `npm run eval:memory`
- `npm run eval:context`
- `npm run eval:capture`

## Baseline Command Results

Baseline provided for this branch before PWA work:

- `git status`: clean
- `npm install`: passed
- `npm run build`: passed
- `npm run lint`: unavailable because there is no `lint` script
- `npm test`: unavailable because there is no `test` script

Post-documentation verification for this task:

- `npm run build`: must pass again after documentation-only changes

## Missing Guardrails

- No `lint` script is defined in [`package.json`](/Users/zhuoqunwang/playground/memoflow/package.json:1)
- No `test` script is defined in [`package.json`](/Users/zhuoqunwang/playground/memoflow/package.json:1)
- Current automated guardrail is TypeScript compilation via `npm run build`

## Constraints For Follow-up PWA Work

- Do not change current app behavior while introducing installability support
- Do not refactor storage or data models without explicit approval
- Do not introduce a required backend as part of PWA enablement
- Verify each PWA step against the existing local webapp flows above

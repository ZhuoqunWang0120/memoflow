# Friends-Alpha Safety Audit

Date: 2026-07-11
Branch: `pwa/ios-installable-v0`

## Scope

- Inspection only.
- No product/runtime behavior changes.
- Focus: data isolation, LLM/provider boundary, service-worker caching, and minimum alpha boundary.

## 1. Data Storage Map

### Raw dumps

- Server file-backed JSONL at `data/dumps.jsonl`.
- Evidence:
  - `src/services/dumpStoreService.ts:6-7`
  - `src/services/dumpStoreService.ts:33-51`
  - `src/services/dumpStoreService.ts:98-132`

### Pending suggestions

- Not persisted to disk by the current app.
- Generated on demand by `POST /api/suggestions`, returned in the HTTP response, then held in inline page state in the browser.
- Evidence:
  - server route: `src/webServer.ts:131-147`
  - browser state container: `src/webServer.ts:1627-1640`
  - browser assignment after generation: `src/webServer.ts:1732-1745`
  - suggestions cleared on save-for-later: `src/webServer.ts:1701-1713`

### Saved items

- Server file-backed JSONL at `data/items.jsonl`.
- Evidence:
  - `src/services/itemStoreService.ts:7-8`
  - `src/services/itemStoreService.ts:63-80`
  - `src/services/itemStoreService.ts:168-203`

### Memories

- Server file-backed JSONL at `data/memory.jsonl`.
- Evidence:
  - `src/services/memoryStoreService.ts:6-8`
  - `src/services/memoryStoreService.ts:22-37`
  - `src/services/memoryStoreService.ts:106-140`

### Review-correction logs

- Server file-backed JSONL at `data/correction_events.jsonl`.
- Logged when a reviewed suggestion is saved with meaningful edits.
- Evidence:
  - `src/services/correctionEventService.ts:9-10`
  - `src/services/correctionEventService.ts:66-89`
  - `src/services/correctionEventService.ts:92-164`

### Storage mode summary

- Raw dumps: server-file-backed JSONL
- Pending suggestions: mixed request/response + browser-memory state, not durable
- Saved items: server-file-backed JSONL
- Memories: server-file-backed JSONL
- Review-correction logs: server-file-backed JSONL

## 2. Multi-User Implication

### Shared server-side store

- The current server imports one global dump store, item store, and memory store with default paths under `process.cwd()/data/...`.
- There is no user/account lookup, no per-request tenant key, and no access boundary in the HTTP routes.
- Evidence:
  - dumps default path: `src/services/dumpStoreService.ts:6-7`
  - items default path: `src/services/itemStoreService.ts:7-8`
  - memory default path: `src/services/memoryStoreService.ts:6-7`
  - server routes call those stores directly with no user scoping: `src/webServer.ts:131-260`

### Consequence

- If two different people visit the same deployed MemoFlow URL, they will hit the same Node server and the same server-side files.
- They can read the same pending dumps, memory entries, and saved items.
- They can also overwrite or mutate shared state:
  - dumps can be marked reviewed/ignored
  - items can be created, patched, archived, or unarchived
  - memory can be created, updated, archived, or deleted

### Verdict

- Public or shared friends-alpha is not safe yet, even with an obscure link.
- A lightweight access code may reduce casual abuse, but it does not solve data isolation.
- Different testers would still share one canonical store unless there is a per-user or per-alpha-session boundary.

## 3. LLM Provider / API-Key Boundary

### Where the key is read

- The web server loads env via `dotenv/config`.
- The OpenAI parser reads `process.env.OPENAI_API_KEY`.
- The semantic relation scanner also reads `process.env.OPENAI_API_KEY`.
- Evidence:
  - env bootstrap: `src/webServer.ts:1`
  - parser key read: `src/parsers/openAiSuggestionParser.ts:76-87`
  - semantic scanner key read: `src/services/semanticRelationScanService.ts:50-64`

### Browser vs provider path

- The browser calls MemoFlow routes such as `/api/suggestions`.
- The server route calls `createSuggestionsFromDump(...)`.
- The LLM/parser implementation then makes the outbound provider call server-side.
- Evidence:
  - browser request path: `src/webServer.ts:1735-1739`
  - request helper uses same-origin `fetch(url, ...)`: `src/webServer.ts:2670-2681`
  - server suggestion route: `src/webServer.ts:131-147`
  - provider call: `src/parsers/openAiSuggestionParser.ts:89-117`

### Is the key exposed to frontend assets?

- I did not find the API key serialized into inline HTML, service worker code, static assets, or browser request code.
- The browser-visible UI strings are serialized separately and do not include provider credentials.
- Evidence checked:
  - inline app shell and UI serialization: `src/webServer.ts:1617-1640`
  - capture shell: `src/webServerCaptureHtml.ts:1-40`
  - service worker: `public/sw.js:1-50`

### Raw dumps sent upstream

- Raw dump text is sent from the server to the provider inside the LLM prompt.
- When context is enabled, active memory and selected items are also included in the prompt path.
- Evidence:
  - parser prompt generation: `src/parsers/openAiSuggestionParser.ts:85-117`
  - context-building path: `src/webServer.ts:132-145`
  - semantic scanner also sends raw memo plus semantic-scan items: `src/services/semanticRelationScanService.ts:61-93`

### Are raw dumps logged server-side?

- Raw dumps are persisted server-side in `data/dumps.jsonl`.
- Review-correction logs also retain before/after snapshots derived from raw review outcomes.
- I did not find general request-body logging or console logging of raw dump text in the server path.
- The only always-on server console log I found is startup logging.
- Evidence:
  - dump persistence: `src/services/dumpStoreService.ts:33-51`
  - correction-event snapshots: `src/services/correctionEventService.ts:32-39`, `src/services/correctionEventService.ts:74-89`
  - startup log only: `src/webServer.ts:275-277`

## 4. Service Worker / Cache

- The service worker caches only static install assets:
  - `/manifest.webmanifest`
  - icon files
- It skips:
  - non-GET requests
  - cross-origin requests
  - `/api/*`
  - navigations
- It does not cache user-created JSON responses or app pages.
- Evidence:
  - static asset allowlist: `public/sw.js:1-8`
  - skip `/api/*`: `public/sw.js:32-36`
  - skip navigations: `public/sw.js:35`
  - cache only allowlisted assets: `public/sw.js:36-49`

### Verdict

- Current service-worker behavior is conservative and appropriate for alpha safety.
- No evidence found that it caches user-created data, parser responses, or HTML navigations.

## 5. Friends-Alpha Minimum Safe Boundary

### Minimum boundary before sharing with friends/family

Must implement or verify:

1. A data-isolation boundary.
   - Current shared-file model is the main blocker.
   - An access code alone is not enough.
2. A clear server-only provider boundary.
   - This is mostly true already and should remain true.
3. Request controls.
   - Add request size limits.
   - Add basic rate limiting or other abuse guardrails.
4. Privacy disclosure.
   - Tell testers raw dumps are stored server-side.
   - Tell testers dump content and some memory/context may be sent server-side to the configured LLM provider.
5. Error handling review.
   - Current UI shows upstream error text directly if the server returns it.
   - Evidence: `src/parsers/openAiSuggestionParser.ts:119-121`, `src/webServer.ts:2676-2700`

### Is a lightweight alpha access code sufficient?

- No, not by itself.
- It can help with accidental link spread and API-cost abuse.
- It does not prevent different testers from sharing and mutating the same server-side files.

### Is data isolation still required if access code exists?

- Yes.
- Access control and data isolation solve different problems:
  - access code: who can enter
  - data isolation: whose data they can see or mutate

### Tester warning copy needed

Suggested minimum tester warning:

- this alpha is not multi-user safe yet
- do not use it for private or sensitive personal data
- raw dumps are stored on the server
- dump content, and optionally some memory/context, may be sent to the configured LLM provider for parsing
- other testers may currently share the same server-side workspace unless isolation is added

## Verdict Summary

- Data isolation verdict: not ready
- LLM API-key boundary verdict: server-side boundary appears intact
- Service worker caching verdict: safe/static-only
- Friends-alpha readiness verdict: not ready for shared friends/family use until data isolation is solved

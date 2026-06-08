# Smart Memo Core v0 Decision Log

Date: 2026-06-07

This note captures implementation decisions made after reviewing
`dev_notes/mvp-core.md`. It is intended as a handoff for a fresh session.

## Goal

Build a standalone TypeScript module and CLI that transforms raw dumped memo
text into structured suggestions.

Flow:

```text
raw dumped memo text
-> parser, either stub or LLM
-> validated SuggestionResult
-> human-readable JSON output
```

The module should not create final tasks or persist anything. It only produces
suggestions for a future user-facing approval/editing flow.

## Agreed Parser Design

Implement both parser paths:

- `stub`: local deterministic/simple parser for development and tests.
- `llm`: OpenAI-backed parser for real suggestion quality.

Use a shared parser interface, for example:

```ts
type SuggestionParser = {
  parse(input: ParseSuggestionInput): Promise<SuggestionResult>;
};
```

The service should choose a parser explicitly, with `stub` as the default.

Suggested CLI usage:

```bash
npm run suggest -- --parser stub "email Duke about final eval"
npm run suggest -- --parser llm "email Duke about final eval"
```

## Stub Parser Meaning

The stub parser is not expected to understand text deeply. It is a small local
implementation that returns plausible structured suggestions using hardcoded
sample matching, basic keyword heuristics, and/or fallback
`clarify_needed` suggestions.

Its purpose is to test the plumbing:

- TypeScript module shape
- Zod validation
- CLI JSON output
- eval runner
- future UI/service contract

It should stay intentionally simple and should not be treated as the final
intelligence layer.

## LLM Provider Decision

For v0, support OpenAI only, but keep it behind the shared parser interface so
other providers can be added later without changing the service contract.

Avoid a broad multi-provider abstraction in v0 unless real requirements appear.

## API Key Decision

Users who install/run the product should use their own OpenAI API key.

The project must not ship with, hardcode, proxy through, or store the author's
personal API key.

The LLM parser should read the key from the user's local environment:

```bash
export OPENAI_API_KEY=...
npm run suggest -- --parser llm "..."
```

Implementation expectation:

```ts
const apiKey = process.env.OPENAI_API_KEY;
```

If `--parser llm` is selected and `OPENAI_API_KEY` is missing, fail loudly with
a clear setup error. Do not silently fall back to the stub parser.

Recommended error shape:

```text
OPENAI_API_KEY is required when parser=llm. Set it in your local environment.
```

## API Key Security Notes

Using an environment variable means this project does not store the API key in
source code or a database. This reduces leakage risk, but does not eliminate all
risk.

Known risks:

- Shell history may capture inline API key usage.
- A user-created `.env` file could be accidentally committed.
- Local processes on the same machine may be able to inspect environment vars.
- Logs could leak secrets if code prints config or error objects carelessly.
- CI/deployment systems could expose secrets if misconfigured.

Required mitigations:

- Never print the API key.
- Never include the key in thrown errors.
- Add `.env` to `.gitignore`.
- Add `.env.example` with placeholders only if env docs are needed.
- Prefer docs that show `export OPENAI_API_KEY=...` instead of inline command
  assignment.

## Main Service Contract

Keep the public service function simple and future-proof:

```ts
createSuggestionsFromDump(
  {
    rawText,
    context,
  },
  {
    parser,
  }
)
```

`context` should remain optional from day one. It can be ignored in MVP and used
later for RAG, related memos, source snippets, emails, docs, or previous tasks.

## Validation Contract

Define Zod schemas for:

- `Suggestion`
- `SuggestionResult`

Suggestion types:

- `task`
- `exploration`
- `idea`
- `reference`
- `clarify_needed`

Parser output, including LLM JSON, must be validated through Zod before being
returned by the service.

## Eval Requirements

Create `src/eval/golden_cases.jsonl` with representative cases:

- simple task
- multiple suggestions from one memo
- exploration
- idea
- reference
- ambiguous memo requiring clarification
- follow-up or waiting-on-someone case
- vague/informal wording

Create `src/eval/runEval.ts` that:

- loads all golden cases
- calls `createSuggestionsFromDump()`
- checks valid result shape
- checks expected type
- checks key title keywords
- checks `needs_clarification` when specified
- prints per-case pass/fail and summary

For deterministic MVP evals, default the eval runner to the `stub` parser unless
an explicit `--parser llm` option is added.

## Recommended Implementation Order

1. Create minimal TypeScript package setup.
2. Add Zod schemas and exported TypeScript types.
3. Add parser interface.
4. Add stub parser.
5. Add OpenAI parser behind the same interface.
6. Add prompt file for dump-to-suggestions classification.
7. Add service function with optional `context`.
8. Add CLI with `--parser stub|llm`.
9. Add `.gitignore` handling for `.env`.
10. Add golden cases and eval runner.
11. Run CLI/eval verification.

## Non-Goals for v0

- No UI.
- No database.
- No user account/auth system.
- No persistence of suggestions.
- No automatic creation of final tasks/items.
- No multi-provider LLM framework unless needed later.

## Implementation Progress

As of the latest implementation pass, the core module exists and includes:

- TypeScript package setup with `npm run check`, `npm run suggest`, and
  `npm run eval`.
- Zod schemas for `Suggestion` and `SuggestionResult`.
- Shared parser interface.
- Stub parser for deterministic local development/eval.
- OpenAI-backed LLM parser behind the same interface.
- `.env` support through `dotenv/config`; `.env` is ignored and
  `.env.example` is checked in.
- CLI that accepts raw memo text and prints validated JSON.
- Prompt construction in `src/prompts/dumpToSuggestions.ts`.
- Reference docs:
  - `src/examples/suggestion_definitions.md`
  - `src/examples/dump2suggestions_few_shot_ex.md`
- Eval runner and golden cases in `src/eval/`.

Current eval status:

```text
npm run check
npm run eval
17/17 passed
Type accuracy: 100.0%
```

## Current Behavior Notes

The current design reflects the newer suggestion definition:

- Classification is based on observable wording, not inferred hidden
  commitment.
- `commitment_level` is not required and should not be emitted.
- Default statuses:
  - `task -> ready`
  - `exploration -> open`
  - `idea -> saved`
  - `reference -> saved`
  - `clarify_needed -> needs_clarification`
- `clarify_needed` supports `clarification_question` and `missing_context`.
- Bare project/product/content phrases should usually become `idea`.
- Bare links should become `reference`.
- Bare unclear shorthand should become `clarify_needed`.
- Multi-item memo dumps should split into multiple suggestions when clear.

## Date Inference Progress

Date behavior is currently LLM-first with prompt guardrails plus limited stub
coverage for deterministic evals.

Supported/covered examples include:

- `today`, `tomorrow`, `tmr`
- `今天`, `明天`
- `后天`, `大后天`, `明后天`
- `today or tomorrow`, `today or tmr`
- `周一` through `周日`, `星期一` through `星期日`
- English weekdays such as `Friday` and `next Friday`

Policy notes:

- If an acceptable date range is clear, use the latest acceptable date.
- If wording is loose, such as `这两天`, `due_date: null`, `+2`, or `+3` may
  all be acceptable for now.
- Do not invent dates when there is no observable date signal.

## Known Issues

### P2: LLM Can Still Misread Some Chinese Relative Dates

Observed issue:

```text
大后天买菜
```

The stub parser/eval path resolves this as current date + 3 days, but the LLM
may still misinterpret `大后天` as `后天` and return current date + 2 days.

This is accepted as a P2 issue for now because users can correct due dates in
the future UI. Do not block v0 on this.

Potential future fixes:

- Add a narrow post-parse date guardrail for high-confidence relative date
  phrases.
- Add optional internal date-debug fields such as source phrase and normalized
  meaning.
- Use a dedicated date-normalization library or service later if date parsing
  becomes central.

### P2: Stub Parser Is Heuristic

The stub parser exists for plumbing and eval stability. It is intentionally not
the real intelligence layer. Its titles/descriptions are rough, especially for
Chinese inputs and links.

## Item Persistence Decisions

Next milestone: add file-backed persistence for approved MemoFlow items.

Scope remains:

- No UI.
- No database.
- Suggestions remain provisional.
- Only accepted or edited suggestions become persisted `Item`s.

Canonical store:

```text
data/items.jsonl
```

`items.jsonl` uses one JSON object per line. New item writes append a new line
after existing items.

### Item vs Suggestion

Keep `Item` schema separate from `Suggestion` schema.

Suggestions may include:

```text
task
exploration
idea
reference
clarify_needed
```

Persisted items may include only:

```text
task
exploration
idea
reference
```

Decision: do not persist `clarify_needed` as an item.

Meaning: `clarify_needed` is a provisional AI output saying there is not enough
information. Before it becomes durable user data, the user should resolve or
edit it into a real item type such as `idea`, `reference`, `task`, or
`exploration`.

### Starter Sample Item

Decision: include one starter sample item in `data/items.jsonl`.

Meaning:

- Fresh users will see one sample item when they list items.
- The sample item is ordinary data in MVP.
- The first real `add` operation appends a second JSONL line after the sample.
- For this MVP, do not gitignore `data/items.jsonl` because the starter sample
  should ship with the repo.

Example JSONL behavior:

```jsonl
{"id":"sample_001","type":"idea","title":"Try MemoFlow with a raw memo dump","status":"saved","created_at":"2026-06-08T00:00:00.000Z","updated_at":"2026-06-08T00:00:00.000Z","archived_at":null}
{"id":"itm_abc123","type":"task","title":"Buy groceries","status":"ready","created_at":"2026-06-08T01:00:00.000Z","updated_at":"2026-06-08T01:00:00.000Z","archived_at":null}
```

Later, when this becomes a real installed app, reconsider moving sample data to
`data/items.example.jsonl` and gitignoring real user `data/items.jsonl`.

### Item Store Service

Add:

```text
src/schemas/item.ts
src/services/itemStoreService.ts
```

Required service operations:

```ts
list(...)
add(...)
update(...)
archive(...)
exportCsv(...)
```

Recommended behavior:

- `list`: read `data/items.jsonl`, validate each line, hide archived items by
  default unless `includeArchived` is requested.
- `add`: validate input, create `id`, `created_at`, `updated_at`, append one
  JSONL line.
- `update`: find by `id`, merge allowed fields, update `updated_at`, rewrite
  file atomically.
- `archive`: set `archived_at` and an archive status, update `updated_at`,
  rewrite file atomically.
- `exportCsv`: return CSV string for current items, optionally including
  archived items.

### CLI Decision

Decision: add a separate item CLI script instead of overloading `suggest`.

Meaning:

```bash
npm run suggest -- "portfolio website"
npm run items -- list
npm run items -- add --type idea --title "Portfolio website"
npm run items -- update <id> --status archived
npm run items -- archive <id>
npm run items -- export-csv
```

Suggested implementation:

```text
src/itemsCli.ts
```

and package script:

```json
{
  "items": "npm run build --silent && node dist/itemsCli.js"
}
```

Default output should be JSON for list/add/update/archive and raw CSV for
`export-csv`.

### Interactive Approval Flow

Decision: add an interactive item command:

```bash
npm run items -- review-dump "raw memo text"
npm run items -- review-dump --parser llm "raw memo text"
```

Meaning:

```text
raw dump
-> generate suggestions
-> show suggestions one by one
-> user approves, edits, rejects, or quits
-> approved/edited suggestions are immediately appended as Items
```

This is the CLI version of the future UI approval-card flow.

Approved decisions:

- Review suggestions sequentially, one at a time.
- Basic CLI editing in v0:
  - `type`
  - `title`
  - `description`
  - `status`
  - `due_date`
  - `waiting_on`
  - `tags`
  - `category`
- A later UI should support full editing with richer controls.
- `clarify_needed` suggestions are shown, but cannot be approved directly.
  User must edit the type to `task`, `exploration`, `idea`, or `reference`
  before saving.

Implementation target:

```text
src/services/suggestionApprovalService.ts
src/itemsCli.ts
```

Suggested conversion rule:

```text
Suggestion + raw dump + optional user edits
-> AddItemInput
```

Persisted item should include source metadata:

```ts
source: {
  kind: "suggestion",
  raw_text: originalDump,
  suggestion
}
```

Current user data location:

```text
data/items.jsonl
```

This is local file-backed storage in the project directory. There is no database
or cloud sync. In the current MVP, `data/items.jsonl` ships with one starter
sample item and new user-approved items append after it.

Implementation completed:

- `src/services/suggestionApprovalService.ts` converts an approved/edited
  `Suggestion` into `AddItemInput`.
- `npm run items -- review-dump "raw memo text"` runs the interactive
  approval flow with the stub parser by default.
- `npm run items -- review-dump --parser llm "raw memo text"` runs the same
  flow with the OpenAI parser.
- The CLI supports:
  - approve
  - edit
  - reject
  - quit
- Edited fields in v0:
  - `type`
  - `title`
  - `description`
  - `status`
  - `due_date`
  - `waiting_on`
  - `tags`
  - `category`
- Saved items include:

```ts
source: {
  kind: "suggestion",
  raw_text,
  suggestion
}
```

Verification completed:

```text
npm run check
npm run eval
npm run items -- list
```

Interactive smoke tests were run in temp directories so the committed starter
`data/items.jsonl` remained unchanged.

### Sample Commands

Generate provisional suggestions only:

```bash
npm run suggest -- "portfolio website"
npm run suggest -- --parser llm "周五买菜"
```

List saved items:

```bash
npm run items -- list
npm run items -- list --include-archived
```

Manually add an item:

```bash
npm run items -- add --type task --title "Buy groceries" --due-date 2026-06-12 --tags errands,home
npm run items -- add --type idea --title "Portfolio website" --category career --tags portfolio,website
```

Review a raw dump, approve/edit/reject suggestions, and save approved items:

```bash
npm run items -- review-dump "portfolio website"
npm run items -- review-dump "email Duke about final eval. also maybe memo app should support waiting status"
npm run items -- review-dump --parser llm "周五买菜"
```

During `review-dump`, choose:

```text
a = approve suggestion as item
e = edit suggestion before saving
r = reject suggestion
q = quit review flow
```

Update an existing item:

```bash
npm run items -- update itm_example --status done
npm run items -- update itm_example --title "Buy groceries from Safeway" --due-date 2026-06-12
```

Archive an item:

```bash
npm run items -- archive itm_example
```

Archive semantics:

```text
done = completed, still visible in normal list output
archived = hidden from normal list/export output, retained in storage
delete = not implemented
```

Use archive as a reversible alternative to delete. It is useful for canceled,
outdated, no-longer-relevant, accidentally saved, or old items that should be
kept for history but removed from the default working list.

Export current item list as CSV:

```bash
npm run items -- export-csv
npm run items -- export-csv --include-archived
```

Write CSV output to a file:

```bash
npm run items -- export-csv > items.csv
```

## End-of-Day Status: 2026-06-08

Current implemented system:

```text
raw dump
-> provisional suggestions
-> interactive CLI approval/edit/reject
-> approved items
-> data/items.jsonl
```

Main commands:

```bash
npm run suggest -- "raw memo"
npm run items -- review-dump "raw memo"
npm run items -- list
npm run items -- add --type task --title "..."
npm run items -- update <id> --status done
npm run items -- archive <id>
npm run items -- export-csv
```

Current user data storage:

```text
data/items.jsonl
```

This is local-only file-backed storage in the project directory. There is still
no UI, database, auth, sync, or cloud storage.

Starter data:

- `data/items.jsonl` contains one starter sample item.
- New approved/manual items append after the sample item.

Verification last run:

```text
npm run check
npm run eval
npm run items -- list
```

Known remaining limitations:

- The interactive approval flow is CLI-only. A future UI should provide richer
  full editing.
- `clarify_needed` cannot be saved directly; user must edit it into a real item
  type.
- Date inference is still LLM-first and may occasionally need user correction.
- Stub parser remains heuristic and exists mainly for deterministic local evals.

## Local Webapp v0

Implementation completed:

```text
raw memo
-> suggestions
-> editable suggestion cards
-> approve / reject
-> saved item ledger
-> update status / archive
```

Run locally:

```bash
npm run dev
```

Default URL:

```text
http://127.0.0.1:3000
```

Architecture:

- `src/webServer.ts` is a thin local Node HTTP server.
- No React/Next dependency was added for v0.
- The browser UI is served by the local server.
- API routes call existing core services.
- Prompt and LLM logic remain in `suggestionService`/parser code, not UI code.
- Item persistence still uses `data/items.jsonl`.

Local API routes:

```text
POST /api/suggestions
GET  /api/items
POST /api/items
PATCH /api/items/:id
POST /api/items/:id/archive
```

Validation:

- Suggestion request body is validated with Zod.
- Approved item creation body is validated with Zod.
- Item update body is validated with Zod.

Webapp capabilities:

- Enter raw memo dump.
- Generate suggestions with `stub` or `llm` parser.
- Edit suggestion fields before approval:
  - `type`
  - `title`
  - `description`
  - `status`
  - `due_date`
  - `waiting_on`
  - `tags`
  - `category`
  - `follow_up_needed`
- Approve suggestion into an Item.
- Reject suggestion without saving.
- View active saved items.
- Update item status.
- Archive item.

Verification completed:

```text
npm run check
npm run eval
npm run suggest -- "portfolio website"
npm run items -- list
```

HTTP/API checks completed:

- `GET /`
- `GET /api/items`
- `POST /api/suggestions`
- isolated temp-store smoke test for:
  - approve item through `POST /api/items`
  - status update through `PATCH /api/items/:id`
  - archive through `POST /api/items/:id/archive`

Browser automation was not available in the current Codex tool session, so UI
verification was done through local HTTP/API checks. The dev server was left
running for manual browser testing.

Known webapp limitations:

- Styling is intentionally simple.
- No complex filtering/search/grouping.
- No include-archived toggle in the web UI yet.
- No full JSON editor for suggestions/items.
- No auth, database, sync, reminders, imports, RAG, or mobile/PWA layer.

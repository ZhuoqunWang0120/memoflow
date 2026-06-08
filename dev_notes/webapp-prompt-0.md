You are working in the existing MemoFlow Core repo.

Current validated system:

```text
raw dump
-> provisional suggestions
-> interactive CLI approval/edit/reject
-> approved items
-> data/items.jsonl
```

Main commands already implemented and tested:

```bash
npm run suggest -- "raw memo"
npm run items -- review-dump "raw memo"
npm run items -- list
npm run items -- add --type task --title "..."
npm run items -- update <id> --status done
npm run items -- archive <id>
npm run items -- export-csv
```

Now build a **thin local webapp v0** around the existing core services.

## Goal

Create a minimal local web UI that wraps the already-working MemoFlow Core workflow:

```text
memo input
-> generate suggestions
-> editable suggestion cards
-> approve / reject
-> saved item list
-> update status / archive
```

This should be a product slice, not a full product.

## Important constraints

- Reuse existing core services wherever possible.
- Do not duplicate prompt logic in UI code.
- Do not move LLM logic into React components.
- Do not add RAG.
- Do not add Gmail import.
- Do not add reminders.
- Do not add authentication.
- Do not migrate to SQLite yet unless absolutely necessary.
- Keep `data/items.jsonl` as the source of truth for now.
- Keep the architecture modular so the UI can later be replaced by mobile/PWA/iOS.
- Keep this local-only for now.

## Expected user flow

### 1. User enters a memo dump

A page should include a textarea where the user can paste/type a raw memo.

Example:

```text
email Duke about final eval. also maybe memo app should support waiting status
```

There should be a button:

```text
Generate Suggestions
```

### 2. App generates suggestions

The frontend should call a backend/API route or server action that uses the existing suggestion service.

The response should be a valid `SuggestionResult`.

The UI should display each suggestion as a card.

Each card should show at least:

```text
type
title
description
status
confidence
needs_clarification
clarification_question, if present
missing_context, if present
suggested_fields, if useful
```

### 3. User can edit suggestions before saving

Each suggestion card should be editable before approval.

At minimum, user should be able to edit:

```text
type
title
description
status
follow_up_needed
due_date
waiting_on
tags/category if already supported
```

Do not overbuild the editor. A simple form is enough.

### 4. User can approve or reject each suggestion

For each suggestion:

```text
Approve -> save as Item in data/items.jsonl
Reject -> do not save
```

Important conceptual rule:

```text
Suggestion = provisional machine output
Item = user-approved canonical record
```

The LLM should never silently create final items. The UI approval action is what converts a suggestion into an item.

### 5. App shows saved item list

The page should show saved items from `data/items.jsonl`.

For each item, show at least:

```text
id
type
title
description
status
created_at
updated_at
source_memo, if available
```

The item list can be basic. No complex grouping/filtering needed yet.

### 6. User can update status and archive

For each saved item, support:

```text
change status
archive item
```

This should call the existing item store/update/archive logic.

## Suggested UI layout

A single-page local app is enough:

```text
------------------------------------------------
MemoFlow Local Webapp

[ Raw memo textarea                         ]

[ Generate Suggestions ]

------------------------------------------------
Suggestions

[ Suggestion Card 1 ]
type: ...
title: ...
description: ...
status: ...
[ editable fields ]
[ Approve ] [ Reject ]

[ Suggestion Card 2 ]
...

------------------------------------------------
Saved Items

[ Item row/card 1 ]
title / type / status / updated_at
[ status dropdown ] [ archive ]

[ Item row/card 2 ]
...
------------------------------------------------
```

Use simple styling. Prioritize functionality and clarity over polish.

## Architecture expectation

Please choose the simplest webapp setup that fits the existing repo.

If the repo is already TypeScript/Node-based, a minimal Next.js app is acceptable.

Possible structure:

```text
app/
  page.tsx
  api/
    suggestions/route.ts
    items/route.ts
    items/[id]/route.ts

components/
  MemoInput.tsx
  SuggestionCard.tsx
  SavedItemList.tsx
  ItemRow.tsx

src/
  services/
    suggestionService.ts
    itemStoreService.ts
```

This structure is only a suggestion. Adapt to the existing repo.

Key requirement:

```text
UI components should call API/server functions.
API/server functions should call existing services.
Existing services should remain the source of truth for business logic.
```

## API behavior

Add local API routes or equivalent server functions for:

### Generate suggestions

```text
POST /api/suggestions
body: { rawText: string }
returns: SuggestionResult
```

### List items

```text
GET /api/items
returns: { items: Item[] }
```

### Add item from approved/edited suggestion

```text
POST /api/items
body: edited item fields + source memo/proposal info
returns: saved Item
```

### Update item

```text
PATCH /api/items/:id
body: partial fields, such as { status: "done" }
returns: updated Item
```

### Archive item

Either:

```text
POST /api/items/:id/archive
```

or:

```text
PATCH /api/items/:id
body: { status: "archived" }
```

Use whichever fits the existing item store design.

## Schema and validation

Reuse existing Zod schemas if available.

Validate:

- suggestion generation request
- item creation request
- item update request

Do not trust raw frontend payloads.

## Data source

Use the existing file-backed item store:

```text
data/items.jsonl
```

Do not migrate to SQLite yet.

If file path handling is needed, make sure it works when running the local webapp from the repo root.

## Error handling

The UI should display simple error messages for:

```text
LLM/API failure
invalid suggestion result
item save failure
item update failure
item archive failure
empty memo input
```

No fancy error system needed.

## Development scripts

Add or update scripts so I can run the webapp locally.

For example:

```bash
npm run dev
```

Keep existing CLI commands working.

Do not break:

```bash
npm run suggest -- "raw memo"
npm run items -- list
npm run items -- review-dump "raw memo"
npm run eval
```

## Tests / checks

After implementation:

1. Run existing tests/evals.
2. Confirm CLI commands still work.
3. Run the local webapp.
4. Manually test:

```text
input raw memo
generate suggestions
edit a suggestion
approve it
confirm it appears in saved items
change its status
archive it
confirm items.jsonl updates correctly
reject another suggestion
confirm rejected suggestion is not saved
```

## Out of scope

Do not implement these yet:

```text
RAG
manual context box
Gmail import
chat import
reminders
calendar integration
mobile-specific UI
PWA
auth/login
SQLite/Postgres migration
complex search/filter/grouping
dedupe/merge suggestions
```

## Expected outcome

At the end of this task, MemoFlow should have a minimal local webapp that makes the existing CLI workflow usable through a browser:

```text
raw memo
-> suggestions
-> user review/edit/approve/reject
-> saved item ledger
-> item list/update/archive
```

Report:

- files added/changed
- how to run the webapp
- what was tested
- any limitations or follow-up recommendations
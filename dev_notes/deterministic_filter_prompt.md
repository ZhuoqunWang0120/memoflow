Implement deterministic sort/filter/search for the MemoFlow Item Ledger.

Context:
MemoFlow already has:
- An item ledger backed by data/items.jsonl
- Saved items with fields such as id, type, status, title, description, created_at, updated_at, due_date, follow_up_date, and archived/archived_at if applicable
- Existing item list UI and item store services
- Existing CLI/web flows for creating, updating, archiving, and reviewing items

Goal:
Make the Item Ledger easier to browse and maintain with predictable, non-LLM controls.

Important constraints:
- Do NOT use LLMs for list view, sort, filter, or search.
- Do NOT add semantic search, embeddings, RAG, auto-tagging, grouping, or organization suggestions.
- Do NOT migrate away from the existing JSONL/file-backed storage unless absolutely necessary.
- Do NOT break existing CLI commands or existing item creation/update/archive behavior.
- Keep behavior deterministic, transparent, and easy to test.
- Archived items should be hidden by default unless the user explicitly enables showing archived items.

Required features:

1. Sort controls

Add deterministic sorting for the item ledger.

Support at least:
- created_at newest first
- created_at oldest first
- updated_at newest first
- updated_at oldest first
- due_date soonest first
- follow_up_date soonest first
- type
- status

Sorting requirements:
- Items with missing due_date or follow_up_date should sort after items with those dates when using date-based sorts.
- Sorting should be stable where possible.
- Default sort should be updated_at newest first, or created_at newest first if updated_at is not reliably available.

2. Filter controls

Add filters for:
- type: task / exploration / idea / reference / clarify_needed
- status: ready / open / saved / waiting / follow_up / in_progress / done / parked / archived / needs_clarification, depending on which statuses already exist in the codebase
- archived visibility: hide archived by default; allow “show archived” or “archived only”

Filtering requirements:
- Use only statuses/types that are valid in the existing schema.
- If the codebase already defines enums/types, reuse them instead of hardcoding divergent values.
- Filters should be combinable, e.g. type=task + status=waiting.
- Empty filter means show all non-archived items by default.

3. Text search

Add simple deterministic text search over:
- title
- description
- optionally raw/source text if that field already exists

Search requirements:
- Case-insensitive.
- Simple substring match is enough for v1.
- No fuzzy search, no embeddings, no LLM.
- Search should combine with filters and sort.

4. UI updates

Update the Item Ledger UI to include:
- A search input
- Type filter
- Status filter
- Archived visibility filter/toggle
- Sort dropdown

Keep UI simple and low-friction.

Suggested UI behavior:
- Search input at top of item list
- Dropdown or segmented controls for type/status
- Sort dropdown
- Checkbox/toggle for showing archived
- A clear/reset filters button if easy to implement

5. Service/helper layer

Prefer implementing reusable deterministic helper functions, for example:

- filterItems(items, filters)
- sortItems(items, sortOption)
- searchItems(items, query)
- getVisibleItems(items, { filters, sort, query })

Keep this logic separate from React components if applicable, so it can be tested.

6. Tests

Add or update tests for:
- default list hides archived items
- type filter works
- status filter works
- type + status filters combine correctly
- search matches title case-insensitively
- search matches description case-insensitively
- date sort puts missing dates last
- due_date soonest sort works
- follow_up_date soonest sort works
- archived visibility modes work

7. Documentation

Update the relevant README or implementation log with a short note:

- Item Ledger now supports deterministic sort/filter/search.
- These controls do not use LLMs.
- LLM remains responsible only for suggestion generation/context interpretation/dedup suggestions, while canonical item browsing remains predictable and user-controlled.

Acceptance criteria:
- I can open the Item Ledger and search by text.
- I can filter by type and status.
- Archived items are hidden by default.
- I can explicitly view archived items.
- I can sort by created_at, updated_at, due_date, follow_up_date, type, and status.
- Existing item creation, update, archive, and review flows still work.
- Tests pass.
- No LLM code is added to the list view.
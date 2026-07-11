# MemoFlow

MemoFlow is a local-first TypeScript prototype for turning raw memo dumps into structured suggestions, then saving approved suggestions as durable items.

Current flow:

```text
raw memo
-> optional pending dump queue
-> provisional suggestions
-> user review/edit/approve/reject
-> saved items
-> data/items.jsonl
```

No database, auth, cloud sync, RAG, reminders, or import integrations yet.

## Product Flow

```mermaid
flowchart TD
  subgraph Capture["🎤 Capture View"]
    A[Raw memo input] --> B{Submit}
    B -->|Save now| C[Generate suggestions]
    B -->|Dump for later| D[Save to pending queue]
  end

  subgraph Pending["📋 Pending View"]
    D --> E[Pending dump list]
    E --> F[Start review]
  end

  subgraph Review["🔍 Suggestion Review"]
    C --> G[Editable suggestion cards]
    F --> G
    G --> H{User decision}
    H -->|Approve| I[Save as Item]
    H -->|Edit fields + approve| I
    H -->|Update existing item| J[Edit existing item instead]
    H -->|Reject| K[Discard suggestion]
    J --> I
  end

  subgraph Items["📦 Items View"]
    I --> L[data/items.jsonl]
    L --> M[Item ledger — search / filter / sort]
    M --> N[Update status / fields]
    M --> O[Archive]
    M --> P[Export CSV]
    M --> Q[Edit item fields — title, description, URL, dates…]
  end

  subgraph Memory["🧠 Memory View"]
    R[Create memory entry] --> S[data/memory.jsonl]
    S --> T[Memory list — edit / archive]
    T -->|Archive| U[Hidden from context]
  end

  Capture -. "use memory & context" .-> Review
  Memory -. "active entries injected as context" .-> Review
```

## Architecture Flow

```mermaid
flowchart LR
  subgraph Input["Input Layer"]
    UI[Local Webapp<br/>4 sidebar views]
    CLI[CLI commands]
  end

  subgraph API["API Layer"]
    DumpsAPI["POST /api/dumps<br/>GET /api/dumps"]
    SuggestAPI["POST /api/suggestions"]
    ItemsAPI["POST /api/items<br/>GET/PATCH /api/items/:id<br/>POST /api/items/:id/archive"]
    MemoryAPI["GET/POST/PATCH<br/>/api/memory"]
  end

  subgraph Core["Core Services"]
    DumpStore[dumpStoreService<br/>data/dumps.jsonl]
    SuggestionSvc[suggestionService]
    ApprovalSvc[suggestionApprovalService]
    ContextSvc[suggestionContextService]
    ItemStore[itemStoreService<br/>data/items.jsonl]
    MemoryStore[memoryStoreService<br/>data/memory.jsonl]
  end

  subgraph Parsing["Parsing Layer"]
    Parser{parser?}
    Stub[stub parser<br/>regex-based<br/>URL extraction]
    LLM[LLM parser<br/>OpenAI API<br/>URL + context extraction]
    SemanticScan[semanticRelationScan<br/>OpenAI API]
  end

  subgraph Context["Context Bundle"]
    ActiveMem[Active memory entries]
    KeywordItems[Keyword-matched items]
    RecentItems[Recent active items]
    SemanticItems[Semantic scan items<br/>≤100]
  end

  UI --> API
  CLI --> API

  DumpsAPI --> DumpStore
  SuggestAPI --> SuggestionSvc
  ItemsAPI --> ApprovalSvc
  ItemsAPI --> ItemStore
  MemoryAPI --> MemoryStore

  DumpStore -->|"review"| SuggestAPI

  SuggestionSvc --> Parser
  Parser -->|stub| Stub
  Parser -->|llm| LLM
  LLM --> SemanticScan

  Stub --> SuggestionResult[SuggestionResult]
  LLM --> SuggestionResult

  ContextSvc --> Context
  Context --> SuggestionSvc

  MemoryStore --> ActiveMem
  ItemStore --> KeywordItems
  ItemStore --> RecentItems
  ItemStore --> SemanticItems

  SuggestionResult --> ApprovalSvc
  ApprovalSvc -->|"merge suggested_fields<br/>+ user overrides"| ItemStore
  ItemStore --> CsvExport[CSV export]

  Schemas[Zod schemas] -. validate .-> SuggestionResult
  Schemas -. validate .-> ApprovalSvc
  Schemas -. validate .-> ItemStore
```

Full-size combined system diagram and standalone files: [`docs/flowcharts.md`](docs/flowcharts.md).

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` if you want to use the LLM parser:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

The default `stub` parser works without an API key.

## Local Webapp

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

The webapp supports:

- raw memo input
- freeform user memory
- quick dump save for later
- pending review list
- suggestion generation
- editable suggestion cards
- approve/reject
- saved item list
- deterministic item search/filter/sort
- status update
- archive

## Mobile Screenshot Loop

Generate mobile screenshots for the main web UI at `375x812`, `390x844`, and `430x932`:

```bash
npm run screenshots:mobile
```

Artifacts are written to:

```text
screenshots/mobile/
```

Notes:

- the script uses an isolated local dataset under `data/mobile-screenshots/`
- it captures `Capture`, `Items`, `Memory`, `Pending`, and `Pending Review`
- if Playwright cannot launch the browser in the current sandbox, rerun the command with the broader machine permission flow enabled

## CLI

Generate provisional suggestions:

```bash
npm run suggest -- "portfolio website"
npm run suggest -- --parser llm "周五买菜"
```

Save a raw dump for later review:

```bash
npm run items -- dump-save "email Duke about final eval"
npm run items -- dump-list
npm run items -- dump-review <dump_id>
npm run items -- dump-ignore <dump_id>
```

Review a dump interactively and save approved items:

```bash
npm run items -- review-dump "email Duke about final eval. also maybe memo app should support waiting status"
```

List saved items:

```bash
npm run items -- list
npm run items -- list --query duke
npm run items -- list --type task --status waiting
npm run items -- list --archived show --sort due_date_asc
npm run items -- list --archived only
```

Add an item manually:

```bash
npm run items -- add --type task --title "Buy groceries" --due-date 2026-06-12
```

Update or archive:

```bash
npm run items -- update <id> --status done
npm run items -- archive <id>
```

Export CSV:

```bash
npm run items -- export-csv > items.csv
npm run items -- export-csv --query duke --sort updated_at_desc > items.csv
```

Item ledger browsing is deterministic. Search, filters, and sort do not use
LLMs, embeddings, semantic search, RAG, auto-tagging, or grouping.

Existing items can be edited manually from the Item Ledger. Edits are
deterministic and user-controlled: MemoFlow updates the canonical item record in
`data/items.jsonl`, sets `updated_at`, and does not use an LLM to rewrite,
merge, or modify existing items. This same manual editor supports the `Update
existing instead` flow when a new suggestion looks related to an existing item.

MemoFlow also supports freeform user memory stored locally in `data/memory.jsonl`.
Memory is user-created and user-controlled: the LLM does not automatically
extract, rewrite, classify, or create memory. In the web UI, `Use memory` is off
by default; when enabled, active non-archived memory entries are injected into
suggestion generation as lightweight context. Archived memory is hidden by
default and is not used in prompts. This is not RAG, embedding retrieval, or
automatic memory management.

Suggestion generation can also use `Use context` for creation-time duplicate
awareness. Context includes active memory, deterministic keyword-matched items,
recent active items, and a capped semantic scan list of up to 100 active
non-done items. With the LLM parser, MemoFlow runs a small dedicated semantic
relation scan so the model can attach advisory `related_existing_items` for
duplicates, follow-ups, or same-topic items even when exact tokens do not
overlap. Strong deterministic keyword overlap can also add a fallback
possible-duplicate relation. This is advisory only: the user can create a new
item anyway, manually update an existing item instead, or discard the suggestion.
MemoFlow does not auto-merge, auto-update, auto-archive, use embeddings, or
perform full RAG.

Status display note: item statuses are stored as raw values, but the web ledger
displays the default per-type states `ready`, `open`, and `saved` as `ready`.
Follow-up is represented with fields such as `follow_up_date` and `waiting_on`,
not a normal `follow_up` status.

## Data

Saved items live in:

```text
data/items.jsonl
```

Pending raw dumps live in:

```text
data/dumps.jsonl
```

Freeform memory entries live in:

```text
data/memory.jsonl
```

Passive review-correction events live in:

```text
data/correction_events.jsonl
```

Correction events record meaningful edits between a reviewed proposal and the
final saved item. They are local-only parser-quality signals for future manual
review. MemoFlow does not automatically learn from them yet.

This repo includes one starter sample item. Real user data should remain local. `.env`, `dist/`, `node_modules/`, and `data/items.local.backup.jsonl` are ignored.

## Development

```bash
npm run check
npm run eval
npm run eval:items
npm run eval:memory
npm run eval:context
```

Core source:

```text
src/services/suggestionService.ts
src/services/itemStoreService.ts
src/services/suggestionApprovalService.ts
src/webServer.ts
```

Suggestion definitions and examples:

```text
src/examples/suggestion_definitions.md
src/examples/dump2suggestions_few_shot_ex.md
```

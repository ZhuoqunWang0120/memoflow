# MemoFlow Native Domain Model

Date: 2026-07-11

## Goal

Define the canonical native MemoFlow entities and state transitions for the Apple-first migration. This is the behavior source of truth for the native app, grounded in the current web app.

## Canonical Entities

### Dump

Represents a raw capture that can be reviewed later.

Fields:
- `id`
- `rawText`
- `status`: `pending | reviewed | ignored`
- `source`
- `createdAt`
- `updatedAt`
- `reviewedAt`
- `ignoredAt`

State transitions:
- create -> `pending`
- `pending` -> `reviewed`
- `pending` -> `ignored`

Notes:
- A reviewed dump may generate zero, one, or many saved items.
- Reviewing a dump does not delete the original raw dump record.

### SuggestionSession

Represents one AI generation request over a raw dump plus optional context.

Fields:
- `id`
- `rawText`
- `dumpId?`
- `usedMemory`
- `usedContext`
- `createdAt`
- `provider`
- `model`
- `status`: `running | completed | failed`
- `errorMessage?`

Notes:
- This is a native-facing domain concept even if Stage 1 keeps it mostly in memory.
- A session yields one or more `SuggestionProposal` values.

### SuggestionProposal

Represents one editable AI proposal before the user approves or rejects it.

Fields:
- `proposalId`
- `type`: `task | exploration | idea | reference`
- `title`
- `description?`
- `status`
- `confidence`
- `needsClarification`
- `clarificationQuestion?`
- `missingContext[]`
- `suggestedFields`
- `relatedExistingItems[]`

Notes:
- `clarify_needed` is not a valid type.
- Ambiguity is represented by `needsClarification = true` and typically `status = needs_clarification`.
- Proposal edits happen before save and do not mutate previously saved items.

### Item

Represents a saved durable record produced by manual entry or an approved suggestion.

Fields:
- `id`
- `type`: `task | exploration | idea | reference`
- `title`
- `description?`
- `status`
- `category?`
- `followUpNeeded?`
- `dueDate?`
- `followUpDate?`
- `waitingOn?`
- `url?`
- `tags[]`
- `sourceKind`: `manual | suggestion`
- `sourceRawText?`
- `sourceSuggestionPayload?`
- `createdAt`
- `updatedAt`
- `archivedAt?`

Default status by type:
- `task` -> `ready`
- `exploration` -> `open`
- `idea` -> `saved`
- `reference` -> `saved`

Archive semantics:
- archive sets `status = archived` and `archivedAt = now`
- unarchive clears `archivedAt`
- if the current status is `archived`, unarchive restores the type default active status
- unarchive does not restore the exact pre-archive status because the current web app does not store it

### MemoryEntry

Represents freeform user memory that can be injected into AI parsing context.

Fields:
- `id`
- `text`
- `createdAt`
- `updatedAt`
- `archivedAt?`

State transitions:
- create -> active
- active -> archived
- archived -> deleted or remain archived
- active -> edited

Notes:
- Only active memory participates in AI context injection.

### CorrectionEvent

Represents a passive learning log when a reviewed suggestion is meaningfully changed before save.

Fields:
- `id`
- `createdAt`
- `source`: `pending_review | suggestion_review | cli_review | native_review`
- `proposalId?`
- `dumpId?`
- `savedItemId?`
- `beforeSnapshot`
- `afterSnapshot`
- `changedFields[]`
- `learningStatus`: `unreviewed`

Notes:
- These logs are passive evidence only.
- They do not automatically mutate prompts, parser rules, or model behavior.

## Native State Transitions

### Capture -> Suggestion -> Save

1. User enters raw text.
2. User either:
   - saves it as a pending dump, or
   - generates suggestions immediately.
3. AI returns one or more `SuggestionProposal` values.
4. User edits, approves, or rejects each proposal.
5. Approved proposal becomes a saved `Item`.
6. If the approved item differs from the baseline proposal snapshot, append a `CorrectionEvent`.
7. If the proposal came from a pending dump and at least one item is saved, mark the dump `reviewed`.

### Pending Review

1. Pending dump is selected from the pending list.
2. Native app loads its `rawText` into a suggestion session.
3. User can ignore the dump or generate suggestions for review.
4. Dump stays `pending` until explicitly ignored or reviewed.

### Item Lifecycle

1. Saved item is visible in the ledger when `archivedAt == nil`.
2. Archive hides it from active views and sets archived metadata.
3. Unarchive restores it to the active list with type-default status if needed.

### Memory Lifecycle

1. User creates freeform memory.
2. Active memory can be edited.
3. Archived memory is excluded from AI context.
4. Deletion is explicit.

## CloudKit-Compatible Modeling Constraints

Stage 1 does not enable CloudKit, but native records should stay within likely CloudKit-safe boundaries:

- stable string identifiers
- scalar or optional scalar fields preferred over nested reference graphs
- avoid required cyclic relationships
- avoid opaque mutable blobs for canonical data when a first-class field exists
- keep timestamps on all durable records
- keep archive state as soft-delete metadata instead of destructive mutation when product history matters

## Mapping From Current Web App

Current web JSONL stores map directly:
- `data/dumps.jsonl` -> `Dump`
- `data/items.jsonl` -> `Item`
- `data/memory.jsonl` -> `MemoryEntry`
- `data/correction_events.jsonl` -> `CorrectionEvent`

Current AI parser output maps to:
- `SuggestionSession`
- `SuggestionProposal`

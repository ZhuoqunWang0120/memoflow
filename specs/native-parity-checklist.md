# MemoFlow Native Parity Checklist

Date: 2026-07-11

This checklist defines what counts as native parity with the current MemoFlow behavior. Native parity is not reached when screens merely exist; the core loop and semantics must match.

## Required For Stage 1 Native iPhone Parity

### Capture and Raw Dumps

- [ ] Enter raw text in a native capture screen.
- [ ] Save raw text as a pending dump without running AI.
- [ ] Persist pending dumps locally on device.
- [ ] Open a pending dump later for review.
- [ ] Ignore a pending dump.
- [ ] Mark a dump reviewed through the review/save flow.

### AI Suggestion Generation

- [ ] Generate real AI suggestions from the native app.
- [ ] Use development-only API configuration for internal builds.
- [ ] Keep provider API key out of committed source.
- [ ] Preserve the current four valid item types:
  - `task`
  - `exploration`
  - `idea`
  - `reference`
- [ ] Preserve `needs_clarification` behavior as review state, not item type.

### Review and Approval

- [ ] Review one or more returned suggestions in native UI.
- [ ] Edit obvious review fields before save:
  - type
  - title
  - description
  - status
  - selected item fields
- [ ] Approve a suggestion into a saved item.
- [ ] Reject or discard a suggestion without saving it.
- [ ] Preserve the current default status logic when saving approved suggestions.

### Saved Items

- [ ] Persist saved items locally on device.
- [ ] Show saved items in a native ledger view.
- [ ] Archive an item.
- [ ] Unarchive an item.
- [ ] Preserve current unarchive semantics:
  - clear `archivedAt`
  - if status is `archived`, restore the type default active status
- [ ] Keep source provenance for suggestion-created items.

### Memory

- [ ] Create memory entries locally.
- [ ] Edit memory entries locally.
- [ ] Archive memory entries.
- [ ] Delete memory entries.
- [ ] Exclude archived memory from AI context.

### Passive Review-Correction Logging

- [ ] Log a correction event when a reviewed proposal is meaningfully edited before save.
- [ ] Do not mutate parser behavior automatically from correction logs.
- [ ] Keep correction logs local in Stage 1.

### Context and Duplicate Awareness

- [ ] Support a native `use memory` toggle.
- [ ] Support a native `use context` toggle.
- [ ] Build local context from active memory and saved items.
- [ ] Preserve deterministic keyword/recent-item context ordering closely enough for review.

## Allowed To Defer Past Initial Native Scaffold

These may be scaffolded first and tightened in follow-up native parity passes:

- [ ] full post-save item edit surface matching the web UI
- [ ] full parity for every optional suggested field editor
- [ ] complete parity for context ranking nuances
- [ ] representative native eval harnesses beyond a small seed corpus

## Explicitly Out Of Scope For Stage 1

- [ ] CloudKit sync
- [ ] custom email/password accounts
- [ ] backend storage of user memory/items/dumps
- [ ] production AI proxy
- [ ] usage credits or subscriptions
- [ ] public distribution safety controls
- [ ] Android, Windows, or general web rewrite

## Stage 1 Acceptance Gate

The Stage 1 migration is not complete until all of the following are true:

- [ ] Native app can capture raw text and save pending dumps locally.
- [ ] Native app can generate real AI suggestions on-device in development mode.
- [ ] Native app can review, edit, and approve suggestions into local items.
- [ ] Native app can create and manage memory locally.
- [ ] Archive/unarchive semantics match the current web app.
- [ ] Passive correction logging still works.
- [ ] The core loop works with the legacy web server turned off.

## Representative Native Acceptance Scenarios

- [ ] Save a dump, return later, generate suggestions, approve one item, and confirm the dump is reviewed.
- [ ] Generate suggestions directly from capture, edit a title/status, save the item, and confirm a correction event logs.
- [ ] Save a task item, archive it, unarchive it, and verify the restored status is the type default active status.
- [ ] Add memory, archive memory, then generate a suggestion with `use memory` enabled and confirm archived memory is not included.
- [ ] Review an ambiguous suggestion and confirm it uses `needs_clarification` instead of an invalid type.

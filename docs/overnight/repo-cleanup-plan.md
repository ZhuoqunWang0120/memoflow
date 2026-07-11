# Repo Cleanup Plan

Date: 2026-07-11
Branch: `pwa/ios-installable-v0`
Head: `35cf151`

## Scope

- Inspection and cleanup planning only.
- No commit, merge, delete, or deploy work performed here.

## Current Dirty Tree Summary

Based on `git status --short`, the repo currently mixes product work, eval/tooling work, docs/planning work, and local artifacts in one branch.

## Buckets

### 1. Product / runtime code

Likely real product/runtime changes:

- `src/index.ts`
- `src/itemsCli.ts`
- `src/parsers/openAiSuggestionParser.ts`
- `src/parsers/stubSuggestionParser.ts`
- `src/prompts/dumpToSuggestions.ts`
- `src/schemas/suggestion.ts`
- `src/services/itemStoreService.ts`
- `src/services/suggestionApprovalService.ts`
- `src/services/suggestionService.ts`
- `src/webServer.ts`
- `src/webServerCaptureHtml.ts`
- `src/i18n/uiStrings.ts`
- `src/schemas/correctionEvent.ts`
- `src/services/correctionEventService.ts`
- `src/services/reviewedSuggestionSaveService.ts`
- `src/services/suggestionNormalizationService.ts`

Notes:

- These appear to cover i18n scaffold, review-correction logging, review/UI changes, and parser/runtime changes already in progress.
- These should not be staged blindly as one giant commit without human review.

### 2. Eval / check tooling

- `package.json`
- `package-lock.json`
- `src/eval/golden_cases.jsonl`
- `src/eval/runItemLedgerEval.ts`
- `src/eval/runCorrectionEval.ts`
- `src/eval/runSmokeEval.ts`

Notes:

- `package.json:7-23` confirms build/check/eval scripts now include smoke/correction/mobile-screenshot helpers.
- These are good eventual commit candidates, but they should likely be grouped by milestone:
  - smoke guardrails
  - correction logging eval
  - mobile screenshot tooling

### 3. Docs / product planning

- `README.md`
- `DESIGN.md`
- `docs/change-log.md`
- `docs/mobile-pwa-ui-plan.md`
- `docs/overnight-handoff.md`
- `docs/overnight/`
- `docs/product/`

Notes:

- `docs/product/` looks like legitimate roadmap/backlog/planning documentation and should be kept.
- `docs/overnight/` contains worker reports; treat those as review artifacts, not default product docs.
- `docs/overnight-handoff.md` is a generated handoff artifact, not core product documentation.

### 4. Overnight orchestration

- `prompts/overnight/`
- `scripts/overnight_codex_sprint.py`

Notes:

- These are legitimate tooling if Carol wants the overnight workflow tracked in git.
- Keep them separate from app/product commits.

### 5. Local / generated artifacts that should stay local or be ignored

- `logs/`
- `screenshots/`
- `data/`
- `overnight.log`

Evidence:

- current ignore file covers `.log` and core local JSONL files, but not `logs/`, `screenshots/`, or `data/mobile-screenshots/`: `.gitignore:1-20`

Notes:

- `logs/overnight/...` are run artifacts
- `screenshots/mobile/...` are generated visual artifacts unless explicitly curated for docs
- `data/mobile-screenshots/...` is generated local test data
- `data/demo/` is already ignored, but other generated `data/*` subtrees are not fully covered

### 6. Sensitive or potentially private artifacts

- `.env`
- `data/dumps.jsonl`
- `data/items.jsonl`
- `data/memory.jsonl`
- `data/correction_events.jsonl`
- `data/items.local.backup.jsonl`
- `Users/` if it later contains exported personal files

Notes:

- `.env` is ignored already, but it is still a local sensitive file.
- Local JSONL stores can contain real dump text, memory, and item content.
- These should remain local-only.
- I did not inspect file contents beyond filenames because the task said not to expose secrets/private data.

### 7. Unknown / needs human review

- `Users/`
- `DESIGN.md`
- `docs/mobile-pwa-ui-plan.md`
- `public/carol-wang-cv-062026-webapp.pdf` if later touched

Notes:

- `Users/` is especially suspicious as a top-level untracked directory. It was empty at the scanned depth, but its intent is unclear.
- `DESIGN.md` may be legitimate product design documentation, but it should be reviewed before staging because it is untracked and not referenced by repo conventions yet.

## Recommended Commit Targets

### Should eventually be committed

Likely yes, after human review and splitting by milestone:

- product/runtime files for one accepted milestone at a time
- eval/check tooling that matches that milestone
- stable product docs in `docs/product/`
- `docs/change-log.md`
- overnight orchestration only if Carol wants it versioned

### Should be added to `.gitignore`

Recommended ignore additions:

- `logs/`
- `screenshots/`
- `data/mobile-screenshots/`
- `docs/overnight-handoff.md`
- `docs/overnight/20*.md` for timestamped generated worker reports while keeping curated notes under `docs/overnight/`

Rationale:

- these are generated artifacts or local run outputs
- they add noise to `git status`
- they are not source-of-truth product code

### Should remain local only

- `.env`
- all real-user `data/*.jsonl`
- `logs/`
- generated screenshot batches
- ad hoc overnight run outputs unless intentionally curated

### Needs human approval before staging

- any mixed runtime file with broad UI/product changes:
  - `src/webServer.ts`
  - `src/webServerCaptureHtml.ts`
  - parser-related files
- `README.md` because it may combine multiple milestone claims
- `DESIGN.md`
- `Users/`
- anything under `data/` not clearly synthetic demo data

### Accepted runtime decisions

Accepted by Carol on 2026-07-11:

- keep `DESIGN.md`
- keep `README.md`
- keep `docs/mobile-pwa-ui-plan.md`
- keep overnight orchestration files
- default parser = `llm`
- remove `clarify_needed` as a suggestion type
- keep unclear suggestions as valid types plus `needs_clarification`
- keep `unarchive`
- accept the current UI/mobile polish changes

Open review after those decisions:

- staging structure still matters because `src/webServer.ts` mixes several accepted milestones together

## Safe Commit Order

Recommended manual order, without actually committing here:

1. Clean local/generated noise first.
   - expand `.gitignore` for `logs/`, screenshot outputs, and generated data subtrees
   - verify that no local/private data would be staged

2. Separate docs/planning from runtime.
   - backlog, roadmap, i18n-plan, future-account docs, overnight workflow docs
   - keep generated handoff/report artifacts out unless intentionally wanted

3. Separate tooling/evals from product runtime.
   - smoke eval commit
   - correction logging eval/tooling commit
   - overnight orchestration commit

4. Split runtime/product work by milestone.
   - i18n scaffold
   - correction logging
   - mobile/PWA polish
   - any parser/runtime behavior changes

5. Re-run verification after each staged group.
   - `npm run build`
   - `npm run check`
   - `npm run eval:smoke`
   - any more targeted evals for that milestone only

## Exact Suggested Staging Groups

Use these as review units, not as one bulk stage.

### Group 0: repo-noise cleanup

- `.gitignore`
- `docs/change-log.md`

Purpose:

- remove generated noise from `git status`
- record the cleanup decision before reviewing runtime work

### Group 1: product planning docs

- `docs/product/backlog.md`
- `docs/product/roadmap.md`
- `docs/product/i18n-plan.md`
- `docs/product/parser-quality-log.md`
- `docs/product/future-account-sync-multi-user.md`
- `docs/mobile-pwa-ui-plan.md`
- `README.md`
- `docs/change-log.md`

Purpose:

- preserve planning decisions separately from runtime changes

### Group 2: overnight tooling

- `scripts/overnight_codex_sprint.py`
- `prompts/overnight/01_repo_inspector.md`
- `prompts/overnight/02_alpha_safety_inspector.md`
- `prompts/overnight/03_capacitor_scout.md`
- `prompts/overnight/04_backlog_docs_worker.md`
- `prompts/overnight/99_pm_summarizer.md`
- `docs/product/overnight-workflow.md`
- `docs/change-log.md`

Purpose:

- keep orchestration automation independent from product runtime acceptance

### Group 3: smoke/eval guardrails

- `package.json`
- `package-lock.json`
- `src/eval/runSmokeEval.ts`
- `src/eval/runItemLedgerEval.ts`
- `src/eval/golden_cases.jsonl`
- `docs/change-log.md`

Purpose:

- isolate test/check improvements from behavior changes

### Group 4: correction logging milestone

- `src/schemas/correctionEvent.ts`
- `src/services/correctionEventService.ts`
- `src/services/reviewedSuggestionSaveService.ts`
- `src/index.ts`
- `src/itemsCli.ts`
- `src/webServer.ts` correction-log wiring hunks only
- `src/eval/runCorrectionEval.ts`
- `docs/product/parser-quality-log.md`
- `docs/change-log.md`

Purpose:

- keep passive parser-learning logging reviewable on its own

### Group 5: i18n scaffold milestone

- `src/i18n/uiStrings.ts`
- `src/webServerCaptureHtml.ts`
- `src/webServer.ts` i18n string-wiring hunks only
- `src/index.ts` if you want `uiStrings` exported with the scaffold instead of the correction-log commit
- `docs/product/i18n-plan.md`
- `docs/change-log.md`

Purpose:

- review centralized string scaffolding separately from unrelated runtime changes

### Group 6: accepted parser/runtime semantics

- `src/parsers/openAiSuggestionParser.ts`
- `src/parsers/stubSuggestionParser.ts`
- `src/prompts/dumpToSuggestions.ts`
- `src/schemas/suggestion.ts`
- `src/services/suggestionApprovalService.ts`
- `src/services/suggestionService.ts`
- `src/services/suggestionNormalizationService.ts`
- `src/webServer.ts` parser-default hunk only

Purpose:

- capture the accepted behavior changes:
  - default parser = `llm`
  - no `clarify_needed` type
  - normalize unclear suggestions to valid types with `needs_clarification`

### Group 7: accepted unarchive behavior

- `src/services/itemStoreService.ts`
- `src/webServer.ts` unarchive route and ledger action hunks only
- `docs/change-log.md`

Purpose:

- keep item lifecycle expansion reviewable on its own

### Group 8: accepted UI/mobile polish

- `src/webServer.ts` layout/CSS/view-shell/mobile-filter/mobile-row polish hunks
- `src/webServerCaptureHtml.ts` non-i18n visual/layout polish hunks
- `docs/mobile-pwa-ui-plan.md`
- `docs/change-log.md`

Purpose:

- separate substantial presentation/layout changes from parser/data-flow changes

### Group 9: keep docs and tooling that Carol explicitly accepted

- `DESIGN.md`
- `scripts/overnight_codex_sprint.py`
- `prompts/overnight/01_repo_inspector.md`
- `prompts/overnight/02_alpha_safety_inspector.md`
- `prompts/overnight/03_capacitor_scout.md`
- `prompts/overnight/04_backlog_docs_worker.md`
- `prompts/overnight/99_pm_summarizer.md`
- `docs/product/overnight-workflow.md`
- `docs/change-log.md`

Purpose:

- keep accepted design/orchestration material explicit instead of leaving it in a miscellaneous bucket

## Exact Hunk Split For `src/webServer.ts`

Use this file in partial-staging mode. Do not stage the whole file at once.

### Hunk set A: accepted parser default and save-contract changes

Stage together:

- `GenerateSuggestionsRequestSchema` default parser change
  - `src/webServer.ts:64-68`
- `AddApprovedItemRequestSchema.reviewContext`
  - `src/webServer.ts:79-87`
- `POST /api/items` switch from direct add-input conversion to `saveReviewedSuggestion(...)`
  - `src/webServer.ts:233-241`
- `generateSuggestions()` default parser assignment and request body path
  - `src/webServer.ts:1721-1739`
- `approveSuggestion()` request payload carrying `reviewContext`
  - `src/webServer.ts:2402-2428`

Why:

- these hunks define the accepted runtime semantics for default LLM parsing and reviewed-save metadata
- they align with the parser/correction runtime path, not the UI polish bucket

### Hunk set B: accepted unarchive behavior

Stage together:

- server route for `/api/items/:id/unarchive`
  - `src/webServer.ts:252-256`
- item-list row action that toggles archive vs unarchive
  - `src/webServer.ts:2530-2561`
- `unarchiveItem(id)` browser action
  - `src/webServer.ts:2654-2667`

Why:

- these are one coherent item-lifecycle feature
- they should not be mixed into parser or i18n commits

### Hunk set C: i18n shell wiring

Stage together:

- `const ui = getUiStrings()` and inline serialization
  - `src/webServer.ts:339-340`
- HTML metadata/text substitutions using `${ui...}`
  - starts at `src/webServer.ts:353-354`
- `const UI = ${uiJson}; const t = ...`
  - `src/webServer.ts:1617-1619`
- string substitutions from hardcoded English to `t("...")` or `${ui...}` across:
  - save dump errors/status
  - generate errors/status
  - related-item labels
  - existing-item editor labels
  - ledger editor labels
  - request failure fallback
  - busy/status text helpers

Representative anchors:

- `src/webServer.ts:1687-1718`
- `src/webServer.ts:1721-1750`
- `src/webServer.ts:2275-2343`
- `src/webServer.ts:2346-2448`
- `src/webServer.ts:2522-2599`
- `src/webServer.ts:2670-2680`

Why:

- these hunks are about string centralization, not behavior
- they can live with `src/i18n/uiStrings.ts` and the capture-page string wiring

### Hunk set D: accepted UI/mobile polish

Stage together:

- CSS/layout changes that improve overflow handling, typography, spacing, and mobile behavior
  - `src/webServer.ts:361-721`
  - `src/webServer.ts:722-1165`
  - responsive/mobile shell sections continuing below
- sidebar icon shell and bottom-nav mobile behavior
  - `src/webServer.ts:777-839`
  - `src/webServer.ts:1215+` mobile nav shell
- item quick-filter chip strip and filter-shell styling
  - `src/webServer.ts:938-1003`
  - markup anchor: `src/webServer.ts:1543-1548`
  - event hook anchor: `src/webServer.ts:1671-1674`
- compact-row / suggestion-card presentation changes
  - `src/webServer.ts:1025-1165`
  - item rendering anchor: `src/webServer.ts:2522-2585`
- mobile/responsive initialization and view-shell behavior
  - anchors around `src/webServer.ts:1676`

Why:

- this is the large presentational bucket
- stage it as a UI/mobile polish commit rather than blending it with parser or correction logic

### Hunk set E: correction-logging wiring

Stage together if you want correction logging isolated:

- `POST /api/items` path using `saveReviewedSuggestion(...)`
  - `src/webServer.ts:233-241`
- `AddApprovedItemRequestSchema.reviewContext`
  - `src/webServer.ts:79-87`
- `approveSuggestion()` request payload carrying review context
  - `src/webServer.ts:2402-2428`

Note:

- these hunks overlap with hunk set A because the same request contract supports both accepted parser/save semantics and correction logging
- if you prefer fewer commits, combine correction logging runtime wiring with the accepted parser/save-contract commit

## Exact Hunk Split For `src/webServerCaptureHtml.ts`

This file is cleaner and can usually be staged whole if you are comfortable combining capture-page i18n and accepted capture UI polish.

If you want it split:

### Capture hunk set A: i18n scaffold

- import and inline subset serialization
  - `src/webServerCaptureHtml.ts:1-11`
- `${ui...}` substitutions in title, headings, labels, placeholders, buttons, and workspace link
  - `src/webServerCaptureHtml.ts:24`
  - `src/webServerCaptureHtml.ts:220-247`
- `const UI = ${uiJson}; const t = ...`
  - `src/webServerCaptureHtml.ts:250-252`
- error/success/request-failure message substitutions
  - `src/webServerCaptureHtml.ts:266-323`

### Capture hunk set B: accepted capture UI polish

- the visual/layout/post-it styling block
  - `src/webServerCaptureHtml.ts:31-214`

Recommended judgment:

- stage `src/webServerCaptureHtml.ts` whole with the i18n + accepted UI/mobile polish commit unless you specifically want the capture screen split into two commits

## Minimal Cleanup Plan Before Any Friends-Alpha Work

1. Stop treating the current branch as one merge unit.
2. Remove local/generated artifacts from future status noise.
3. Split docs/tooling/runtime into separate reviewable commits.
4. Review all server/runtime changes touching shared data and LLM boundaries before any deployment.

## Bottom Line

- The repo is currently too dirty to use as a clean acceptance branch.
- Product code, tooling, docs, and local artifacts are mixed together.
- The safest next step is status cleanup and commit separation before any friends-alpha deployment or further milestone work.

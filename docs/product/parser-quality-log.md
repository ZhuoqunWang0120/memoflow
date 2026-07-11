# Parser Quality Log

Status: passive review loop only

## Purpose

- Track recurring parser mistakes without changing parser behavior automatically.
- Turn human corrections into explicit review inputs for later parser work.
- Keep parser improvement separate from everyday product/UI work.

## Current Signal

- Reviewed suggestions can produce local correction events when the saved item meaningfully differs from the proposal.
- Current storage path: `data/correction_events.jsonl`
- Current use: observation only

## Review Routine

1. Sample recent correction events.
2. Group by repeated failure type.
3. Decide whether the issue is prompt, normalization, schema, or UI-review friction.
4. Open a concrete backlog item only if the pattern repeats.
5. Make parser changes later as separate approved work.

## Log Categories

- wrong type
- wrong status
- title too vague or too long
- due date or follow-up date wrong/missing
- waiting-on extraction wrong
- category or tag mismatch
- clarify-needed case handled poorly
- parser output fine but review UI caused the correction

## Rules

- No automatic learning from corrections.
- No silent prompt rewrites from raw logs.
- No parser changes inside unrelated UI or PWA tasks.
- Summaries should prefer repeated patterns, not one-off edits.

## Open Follow-Ups

- decide the minimum review cadence
- define a compact summary format for recurring correction patterns
- separate true parser errors from review-form usability issues

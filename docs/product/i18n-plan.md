# MemoFlow i18n Plan

Status: scaffold started

## Goal

- Prepare MemoFlow for multiple UI languages without changing current product behavior first.

## Order

1. Identify user-facing strings in the core web UI.
2. Move strings into a simple centralized structure.
3. Keep English as the default baseline.
4. Add locale selection rules later if the product still stays single-user local-first.
5. Ship Chinese UI v0 only after the scaffold is stable.

## Scope For The Scaffold

- navigation labels
- buttons and empty states
- item, memory, and review labels
- parser-review helper text
- install/help copy that appears in the app UI

## Current Scaffold

- UI strings live in `src/i18n/uiStrings.ts`.
- English is the default UI locale.
- The scaffold uses:
  - a flat English dictionary
  - stable string keys
  - `getUiStrings(locale)` for server-side HTML assembly
  - `serializeUiStringsForInlineScript(locale)` for inline client-side `t(key)` usage
- Current web surfaces using the scaffold:
  - `src/webServer.ts`
  - `src/webServerCaptureHtml.ts`

## What This Scaffold Does

- Centralizes obvious user-facing UI strings without changing storage or parser behavior.
- Makes the inline HTML surfaces easier to translate later.
- Keeps current English rendering as the baseline behavior.
- Provides a placeholder `zh-CN` locale slot with English fallback.

## What This Scaffold Does Not Do Yet

- no Simplified Chinese UI yet
- no language switcher yet
- no locale preference storage
- no localized date/number formatting
- no full string coverage across every file
- no parser prompt or extraction-language change

## Chinese UI vs Parser Behavior

- Chinese UI means translated labels, buttons, empty states, and instructional copy.
- Chinese parser behavior is separate work.
- This scaffold does not change:
  - parser prompts
  - parser rules
  - review-correction logging behavior
  - Chinese text parsing behavior

## Out Of Scope For Now

- translated parser prompts
- localized date parsing logic
- multi-user locale preferences
- server-side translation services

## Chinese UI v0 Notes

- Focus on the main single-user flows first.
- Keep terminology consistent across capture, items, memory, and pending review.
- Prefer a short glossary before broad translation work starts.

## How To Add `zh-CN` Later

1. Add Simplified Chinese values to the `zh-CN` dictionary in `src/i18n/uiStrings.ts`.
2. Choose a locale source later, for example a fixed config value or a tiny user preference.
3. Keep English fallback for any missing keys during rollout.
4. Expand coverage incrementally instead of trying to translate every string in one pass.
5. Verify that translated strings do not break narrow mobile layouts.

## Implementation Constraints

- Do not change storage layout now.
- Do not add a backend dependency now.
- Do not mix i18n scaffold work with account-sync work.

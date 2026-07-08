# MemoFlow Repo Safety Rules

## Baseline protection

- Preserve existing local web app behavior. Do not change current user-visible flows unless the task explicitly asks for it.
- Do not modify the `main` branch directly. Make changes on a feature branch.
- Avoid broad refactors. Prefer the smallest change set that satisfies the task.
- Prefer additive changes over rewrites, especially for PWA/mobile work.
- Keep the existing desktop/local web app usable while adding new surfaces.

## Data and architecture constraints

- Do not change the storage layout or data model without explicit user approval.
- Do not introduce a required backend service, database, auth system, or cloud dependency.
- Do not add large dependencies unless they are clearly justified in the final report and `docs/change-log.md`.
- Do not migrate user data without an explicit migration plan, backup/export path, and user approval.

## Decision and change logging

Maintain `docs/change-log.md`.

For every meaningful task, add an entry with:

- date
- branch
- goal
- summary of changes
- files changed
- commands run and results
- decisions made
- risks or follow-ups

Update `docs/change-log.md` whenever you:

- add, remove, or modify app behavior
- add dependencies
- change build/dev tooling
- change storage, persistence, schema, or migration behavior
- add PWA, native, or mobile functionality
- make a non-obvious implementation choice
- skip an expected check because the script/tool is unavailable

Keep entries factual and concise. Do not narrate irrelevant internal process.

## Verification expectations

Before completing a task:

- Run `npm run build` if available.
- Run any relevant existing checks discovered in `package.json`.
- If an expected check is unavailable, report it explicitly instead of inventing a script.
- Do not claim behavior is verified unless it was actually checked.

## Final report requirements

Final reports must include:

- summary of changes
- changed files
- commands run and their results
- decisions made
- current risks or remaining gaps
- whether existing local web app behavior was preserved, or what remains unverified

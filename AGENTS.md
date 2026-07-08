# MemoFlow Repo Safety Rules

- Preserve existing local web app behavior. Do not change current user-visible flows unless the task explicitly asks for it.
- Do not modify the `main` branch directly. Make changes on a feature branch.
- Avoid broad refactors. Prefer the smallest change set that satisfies the task.
- Do not change the storage layout or data model without explicit user approval.
- Do not introduce a required backend service, database, auth system, or cloud dependency.
- Final reports must include:
  - changed files
  - commands run and their results
  - current risks or remaining gaps

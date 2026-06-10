Design a UI reference for an existing local-first web app called MemoFlow.

  Important:
  This is a visual/UI redesign reference only.
  Do not change product logic, information architecture, or workflows.
  Do not invent new features like chat, agents, dashboards, analytics, kanban boards, projects, tags, notifications, sync, auth, or team features.
  Preserve the current app structure and all existing actions.

  Product summary:
  MemoFlow is a quiet, utilitarian personal operations tool for turning raw memo dumps into structured suggestions, reviewing them, and saving them as
  durable items in a local file-backed ledger.
  It is not a consumer note app and not a marketing site.
  It should feel like a serious internal workbench: compact, high-signal, fast to scan, and calm under repeated daily use.

  Target user:
  A single power user capturing messy thoughts, todos, reminders, references, and follow-ups, then cleaning them into a structured local ledger.

  Current product flow to preserve:
  1. Raw memo input area
  2. Save raw memo for later or generate suggestions now
  3. Suggestion review cards where user can edit, approve, reject, discard, or update an existing item instead
  4. Freeform Memory section
  5. Pending Review section
  6. Saved Items ledger with deterministic search, filters, sort, edit, update status, and archive

  Main sections that must remain visible in the app:
  - Header
  - Raw Memo composer
  - Memory
  - Pending Review
  - Suggestions
  - Saved Items ledger

  Existing controls to preserve:
  - Parser selector: stub / llm
  - Use memory toggle
  - Use context toggle
  - Save for later
  - Generate suggestions now
  - Add memory
  - Show archived memory
  - Suggestion actions:
    - Create new anyway / Approve
    - Discard / Reject
    - Update existing instead
  - Saved item actions:
    - Edit
    - Update status
    - Archive
  - Ledger controls:
    - Search
    - Sort
    - Type filter
    - Status filter
    - Archived filter
    - Clear filters

  Existing data concepts to reflect in the UI:
  - Suggestions are provisional and editable before saving
  - Saved items are canonical and manually edited
  - Memory is freeform text, user-controlled
  - Pending review dumps are separate from saved items
  - Related existing items are advisory only
  - Editing existing items is deterministic and manual, never AI-written

  Design direction:
  Create a polished desktop-first productivity interface with good mobile behavior.
  Make it feel more intentional and product-grade than a plain admin page, but still restrained and dense.
  Avoid landing-page aesthetics, giant hero sections, oversized cards, decorative gradients that reduce readability, or consumer note-app fluff.
  Prioritize scanability, comparison, editing ergonomics, and repeated use.

  Visual style:
  - Clean, compact operational UI
  - Strong hierarchy
  - Refined spacing
  - Dense but breathable layout
  - Crisp typography
  - Muted neutral foundation with one controlled accent color
  - Distinct states for provisional suggestions, related-item notices, pending review, and archived items
  - Minimal but meaningful motion
  - Small-radius surfaces, not soft bubbly cards
  - No purple-heavy palette
  - No giant rounded pills everywhere
  - No ornamental illustrations

  Layout guidance:
  - Two-column desktop workspace
  - Left side: Raw Memo, Memory, Pending Review, Suggestions
  - Right side: Saved Items ledger
  - On smaller screens, stack vertically while preserving usability
  - Keep the raw memo composer prominent near the top
  - Suggestion cards should support inline editing clearly
  - The Saved Items ledger should feel like a compact record system, not a gallery

  Component guidance:
  - Use compact toolbars and segmented controls where appropriate
  - Use icon buttons only where obvious and standard
  - Keep forms highly legible
  - Suggestion cards should visually separate:
    - suggestion metadata
    - editable fields
    - related existing item notice
    - review actions
  - Existing-item edit mode should feel like editing a canonical record, not creating a new one
  - Pending review entries should be easy to triage quickly
  - Memory entries should feel lightweight and editable inline
  - Saved item cards or rows should make title, type, status, updated time, and source visibility easy to scan

  Content behavior to preserve visually:
  - Related existing item notices should show titles, relationship type, confidence, and reason
  - “Update existing instead” should visually open a manual existing-item editor
  - Discarded suggestions should disappear from the review list
  - Item edit form should be prefilled and manual
  - No auto-merge visuals, no AI takeover framing

  Fields commonly shown:
  Suggestions and items may include:
  - type
  - status
  - title
  - description
  - due date
  - follow-up date
  - waiting on
  - tags
  - category

  Brand/tone:
  - Local-first
  - pragmatic
  - reliable
  - work-focused
  - private
  - deterministic
  - quiet competence

  Output requested:
  Provide a cohesive high-fidelity web app UI concept for MemoFlow that can be used as a visual reference for implementation.
  Do not redesign the app into a different product.
  Do not alter workflows or logic.
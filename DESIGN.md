# MemoFlow Mobile PWA Design Direction

Stitch status for this session: available but not authenticated. `list_projects` failed with `Auth required`, so the design direction below is a local fallback synthesis of the requested three variants.

## Design goal

Make MemoFlow feel like a purpose-built iPhone PWA for quick capture, review, and retrieval, rather than a desktop CRUD page compressed onto a narrow screen.

The design should:
- preserve the current four tabs and local-first flows
- reduce form heaviness on phone
- make review decisions feel primary
- keep high information density without horizontal overflow

## Variant directions

### 1. Minimal iOS-like list
- Native-feeling tab strip
- Clean list cells for Items, Memory, and Pending
- Quiet metadata, stronger hierarchy, lots of white space
- Best for fast scanning and low cognitive load

### 2. Card-based review workflow
- Review suggestions become decision cards
- Suggested item summary is prominent
- Secondary fields are quieter and grouped
- Best for the Capture -> Review flow

### 3. Power-user compact layout
- Dense but mobile-safe controls
- Compact filters and metadata
- Fast scanning for frequent use
- Best for users who touch Items and Pending constantly

## Selected direction

Use a hybrid:
- Minimal iOS-like list for Items, Memory, and Pending
- Card-based review workflow for Capture review cards
- A small amount of Power-user compactness for filters and metadata

This is the safest fit for the current codebase because the app already has strong list and card primitives and can move toward this direction with CSS and small markup adjustments instead of a rewrite.

## Stitch ideas adopted

- compact mobile app header with MemoFlow title
- fixed bottom mobile navigation for Capture, Items, Memory, and Pending
- compact search-first Items screen with quick horizontal chips
- mobile list-cell/card treatment for Items and Memory
- review cards with stronger primary content and quieter secondary fields
- larger safe-area-aware bottom spacing for PWA/Safari chrome

## Stitch ideas rejected

- replacing the current functional app with static mockup HTML
- using Stitch empty states as functional product truth
- copying Tailwind structure wholesale into the app
- introducing new product behaviors, workflows, or data semantics not already present in MemoFlow
- turning Pending into a passive empty-state screen instead of preserving the existing review flow

## Current functionality mapping

- `Capture` remains the functional source for capture and reviewed suggestion approval
- `Pending` remains the queue of saved dumps awaiting review
- `Items` remains the saved item ledger with search/filter/edit/archive
- `Memory` remains the local knowledge list with add/edit/archive
- mobile design changes must sit on top of these existing behaviors rather than redefine them

## Screen hierarchy

### Global shell
- Top mobile tab strip
- One primary screen visible at a time
- Content padded for top and bottom safe areas

### Capture
- Raw capture area first
- Review card stack second
- Review actions always easy to reach

### Items
- Section title
- Compact filter panel
- Card/list rows with title first, metadata second, actions last

### Memory
- Add-memory composer
- Mobile list rows with wrapped text preview

### Pending
- Pending dump list as compact mobile rows
- When reviewing, suggested content should dominate; metadata and auxiliary fields should recede

## Typography scale

- App title: 24px, 600, tight tracking
- Section title: 20-22px, 600
- Item title: 18px, 600, line-height 1.3-1.35
- Card/body/input text: 16px minimum
- Metadata/helper text: 13-14px
- Buttons: 15px
- Type/status pills: 11-12px uppercase

## Spacing scale

- Page side padding on phone: 16px
- Card/list row padding: 12-16px
- Tight gap: 6px
- Standard gap: 8px
- Section gap: 12px
- Large section gap: 16-20px

## Color tokens

- Background: soft cool off-white
- Surface: white
- Surface-muted: pale blue/gray
- Primary text: deep ink
- Secondary text: muted gray-green
- Accent: muted green
- Accent-secondary: muted blue
- Active status: soft green tint
- Waiting/review status: warm neutral tint
- Destructive: soft red tint

Keep the existing palette direction; do not introduce a new brand system in this pass.

## Item row / card structure

- Row/card should fit the mobile width with no horizontal overflow
- Type chip stays small and secondary
- Title is the primary element
- Title shows in full and wraps safely without truncation
- Metadata row sits below title
- Actions are compact and low emphasis
- If no due/follow-up date exists, no date text is shown

## Mobile Layout Rules

### Alignment grammar

- Page titles and section headers are left-aligned.
- Primary content text is left-aligned.
- Metadata, status, and counts may be right-aligned only when paired with a left-side title or label in the same row.
- Form labels are left-aligned.
- Form values and inputs are full-width and left-aligned, except date inputs may center text only if the control stays visually contained and consistent.
- Primary actions align with the card or content edge instead of floating independently.
- In item cards, badges align left above or beside the title, the title aligns left, metadata aligns left below the title, and only compact secondary affordances may sit on the right.
- Avoid mixing centered, left, and right alignment inside one card unless each alignment has a clear role.

### Content hierarchy

- App title: 24px, top-left.
- Screen title: 20-22px, left-aligned below the app shell.
- List or card title: 17-18px, left-aligned.
- Badges and status: visually secondary, aligned to the same left edge as the title.
- Metadata: smaller, quieter, below the title.
- Actions: lower priority than content, compact, and consistent.

### Mobile card rules

- Cards use consistent padding, radius, gap, and border treatment.
- The same card type uses the same internal layout.
- Avoid badge columns that push the title far right unless the layout is intentionally two-column.
- On narrow screens prefer simple vertical stacking: badges row, title, metadata, actions.

### Text rules

- Never allow horizontal overflow.
- Do not truncate titles unless there is a clear expand or detail interaction.
- Saved item titles show in full for now.
- Long text wraps naturally.
- Use `overflow-wrap: anywhere` only where arbitrary strings or URLs need it.
- Avoid heading-sized text inside repeated list items.

### Form rules

- Full-width form controls align to the card content edge.
- Labels sit above controls.
- Date inputs must not overflow.
- Secondary pending-review fields should be quieter than the suggested item content and decision controls.
- Approve and Reject remain prominent and align to the same card edge as the rest of the form.

### Navigation and safe area

- Bottom navigation stays fixed and mobile-native.
- Page content keeps enough bottom padding so nav never covers content.
- Bottom nav items have equal spacing and consistent icon/label alignment.
- Active nav state is clear without becoming oversized.

### Spacing scale

- Page horizontal padding: 16px.
- Card padding: 14-16px.
- Small gap: 6-8px.
- Card gap: 12-16px.
- Section gap: 20-24px.
- Bottom content padding: `calc(120px + env(safe-area-inset-bottom))`.

### Typography scale

- App title: 24px.
- Screen title: 20-22px.
- Item title: 17-18px.
- Body and input text: 16px.
- Metadata and helper text: 13-14px.
- Badge text: 11-12px.
- Buttons: 15px.

## Pending-review structure

- Suggestion card should emphasize:
  - type/status
  - title
  - description / clarification text
- Secondary fields should be grouped visually as quieter controls
- Related-existing-item messaging should remain visible but secondary
- Approve / Reject / Update existing must remain easy to tap on iPhone

## Filter behavior

- Filters must never force horizontal overflow
- Search should take the full row on mobile
- Quick chips should be the default mobile affordance for common item filters
- Advanced selects can sit behind a lightweight disclosure on mobile, while remaining visible on desktop
- Selects should be compact and arranged in a small grid rather than a tall desktop-like stack where possible
- Keep behavior unchanged; this pass is visual/interaction density only

## Safe-area behavior

- Protect top and bottom with `env(safe-area-inset-*)`
- Add enough bottom padding so the last list row or action is not covered by Safari/PWA chrome
- Avoid `100vw`-style widths that ignore safe-area and scrollbar realities

## Concrete implementation notes for React/CSS

The current app is an inline HTML/CSS/JS server-rendered shell rather than React. Treat these notes as CSS/component guidance for the existing implementation:

- Add global mobile containment:
  - `html, body, #root { max-width: 100%; overflow-x: hidden; }`
  - `html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }`
- Replace row-level `nowrap` in item/memory/pending rows with:
  - `min-width: 0`
  - `max-width: 100%`
  - `white-space: normal`
  - `overflow-wrap: anywhere`
  - `word-break: break-word`
- Keep saved item titles fully visible on mobile and rely on wrapping instead of clamping
- Let memory previews wrap naturally instead of truncating text in JavaScript
- Make the tab strip horizontally scrollable inside its container, not by expanding page width
- Ensure `input[type="date"]` uses `width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box;`
- Reduce filter visual weight via smaller gaps, grid arrangement, and quieter panel styling
- Group review secondary fields under a quieter surface treatment rather than making every field visually equal
- Preserve existing saved statuses, filters, API contracts, and file-backed storage behavior

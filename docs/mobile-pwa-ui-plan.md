# Mobile PWA UI Implementation Plan

## Current issue -> file/component mapping

- Global horizontal overflow and safe-area containment
  - `src/webServer.ts`
  - base shell styles, `main.main-content`, mobile media queries

- Item title overflow, memory text clipping, oversized mobile row presentation
  - `src/webServer.ts`
  - `.compact-row*` styles
  - `renderItems()`, `renderMemory()`, `renderPendingDumps()`

- Filter/search/select controls too tall and desktop-like
  - `src/webServer.ts`
  - `#view-items` filter markup
  - `.filter-bar`, `.filter-search`, `.filter-select`

- Pending review feels like desktop form; date input overflows card
  - `src/webServer.ts`
  - `renderSuggestions()` markup
  - suggestion card field grouping and date input styles

- Bottom Safari/PWA chrome overlap
  - `src/webServer.ts`
  - mobile `main.main-content` safe-area padding

## Safe implementation approach

- Keep all behavior, routes, and storage unchanged
- Limit changes to `src/webServer.ts` markup/CSS plus documentation
- Add only light structural classes for review cards and secondary field groups
- Prefer mobile-only CSS adjustments over broad desktop changes

## Verification

- `npm run build`
- `npm run eval:smoke`
- best-effort responsive check at `390px` and `430px`

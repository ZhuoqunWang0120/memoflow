Use the Google Stitch design only as visual/style reference. Do not treat it as source-of-truth implementation.

Stitch reference:
https://stitch.withgoogle.com/projects/15144641016665976007

Goal:
Polish the existing MemoFlow UI while preserving all actual product logic, API calls, stores, schemas, routes, and behavior.

Important:
- Do NOT replace the existing app with Stitch-generated mock code.
- Do NOT hardcode Stitch sample data.
- Do NOT remove existing features.
- Do NOT change storage format.
- Do NOT rewrite business logic.
- Do NOT change item/dump/memory schemas unless absolutely necessary.
- Do NOT change API contracts unless absolutely necessary.
- Do NOT break tests.
- Treat existing MemoFlow behavior as source of truth.

Style direction:
- Use the Stitch design as general visual inspiration only.
- Saved items / Item Ledger should feel organized, professional, clean, and trustworthy.
- Dump / capture areas should feel more post-it-like: lightweight, quick, informal, low-friction.
- Keep the product calm and not overly corporate.
- Avoid turning it into a generic SaaS dashboard or complex todo app.

Functional boundaries:
Preserve existing behavior for:
- raw dump / save for later
- pending review
- suggestion generation
- approve/edit/reject
- item ledger
- deterministic sort/filter/search
- freeform memory
- manual item editing
- context-aware related item detection
- create new anyway / update existing instead / discard
- /capture route if implemented

Implementation approach:
1. First inspect the current UI/components/routes.
2. Identify which components correspond to:
   - dump/capture surface
   - suggestion review
   - item ledger / saved items
   - memory
   - pending review
3. Apply styling/layout improvements incrementally.
4. Prefer refactoring presentation components only.
5. Reuse existing handlers, state, service calls, and API routes.
6. After changes, run tests and manually verify core flows.

Specific visual goals:
- Dump/capture input should feel like a quick note/post-it:
  - warm/light note-like container if compatible with existing styling
  - prominent textarea
  - minimal surrounding controls
  - “save now, organize later” feeling
- Saved items / Item Ledger should feel structured and professional:
  - clear card/list hierarchy
  - readable metadata
  - clean status/type labels
  - filters/search/sort remain predictable
  - archived/done states remain visually distinguishable
- Related existing item notices should be clear but not alarming:
  - show relationship and reason
  - keep Create new anyway / Update existing instead / Discard actions easy to understand
- Memory should remain lightweight and freeform, not a knowledge-base dashboard.

If the Stitch link cannot be accessed directly:
- Ask me to paste screenshots, exported code, or a short visual description.
- Do not install random MCPs or dependencies without confirmation.

Acceptance criteria:
- UI looks closer to the Stitch visual direction.
- Dump/capture areas feel post-it-like and low-friction.
- Saved items feel organized and professional.
- Existing logic and behavior are preserved.
- No Stitch mock logic or sample data is introduced.
- Existing tests pass.
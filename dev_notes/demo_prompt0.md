Use this sanitized demo story for MemoFlow automated recording.

Demo purpose:
Show that MemoFlow can detect a semantic duplicate / follow-up without relying only on exact keyword overlap.

Demo data:

Existing item:
- title: Pick up medicine
- type: task
- status: ready
- description: Pick up the pharmacy order when ready.

Memory:
- text: Target is my usual pharmacy.

New raw dump:
- pick up ibuprofen at Target

Expected behavior:
1. Open /capture or the workspace capture area.
2. Save the raw dump pick up ibuprofen at Target for later.
3. Go to the main workspace.
4. Open Pending Review.
5. Review the pending dump.
6. Generate suggestions with context enabled.
7. MemoFlow should generate a suggestion like:
   - Pick up ibuprofen at Target
8. It should show this as related to the existing item:
   - Pick up medicine
9. Relationship can be:
   - possible_duplicate
   - or follow_up
10. Show the three human-in-the-loop choices:
   - Create new anyway
   - Update existing instead
   - Discard
11. Click Update existing instead.
12. Open the manual editor for the existing item.
13. Optionally update the existing item title/description to include Target/ibuprofen.
14. End the recording on the edit/review state.

Important:
- Do not use Lexapro.
- Do not use prescription medication names.
- Do not use real medical conditions or personal health data.
- Do not use allergy meds, because it contains meds and makes duplicate detection too easy.
- The memory should represent personal context: Target is my usual pharmacy.
- The semantic relation ibuprofen → medicine should come from the model, not exact token overlap.
- The demo should show that related item detection is advisory only.
- No auto-merge.
- No auto-update.
- No auto-archive.
- User remains in control.
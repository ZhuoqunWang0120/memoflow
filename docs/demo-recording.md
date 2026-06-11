# Demo Recording — LinkedIn Build Post

## What the demo shows

MemoFlow is not a "dump to todo" app. The demo shows the more interesting product loop:

1. **Capture** — type a raw thought ("pick up ibuprofen at Safeway"), save for later
2. **Pending review** — revisit the saved dump, start a review
3. **AI suggestion with context** — generate a structured suggestion using memory ("Safeway is my usual pharmacy") and existing item context
4. **Related item detection** — MemoFlow surfaces that "pick up ibuprofen" relates to an existing item "Pick up medicine" — the match is semantic, not exact-token
5. **User controls canonical state** — instead of creating a duplicate, the user chooses "Update existing instead" and edits the original item

The key takeaway: MemoFlow helps maintain a trusted task ledger over time, rather than blindly creating new tasks for every thought.

## Demo story

| Component | Content |
|---|---|
| Existing item | "Pick up medicine" (task, ready) |
| Memory | "Safeway is my usual pharmacy." |
| Raw dump | "pick up ibuprofen at Safeway" |
| Detected relation | possible_duplicate (confidence 0.8) |
| Resolution | Update existing instead |

This story demonstrates:
- Memory/context-aware interpretation
- Semantic (not exact-token) related item detection
- Human-in-the-loop: create new, update existing, or discard
- Task-state maintenance, not just dump-to-task extraction

## Data isolation

Demo data lives in `data/demo/` — completely separate from real user data.

The server uses `MEMOFLOW_DATA_DIR` environment variable to point to the demo directory. Normal app behavior (`npm run dev`) is unaffected.

Seed data:
- `data/demo/items.jsonl` — one item: "Pick up medicine"
- `data/demo/memory.jsonl` — one memory: "Safeway is my usual pharmacy."
- `data/demo/dumps.jsonl` — empty (created during demo flow)

## Recording approach

- **Tool**: Playwright (headless chromium)
- **Suggestion API**: Mocked via Playwright route interception — deterministic, no real LLM cost
- **Other APIs**: Real (items, memory, dumps use demo data directory)
- **Output**: `artifacts/demo/memoflow-demo.mp4`
- **Duration**: ~24 seconds
- **Resolution**: 1280×720

## How to run

```bash
# Seed demo data and record video
npm run demo:record

# Or run demo server interactively for manual testing
npm run demo:dev
```

Output: `artifacts/demo/memoflow-demo.mp4`

## Privacy

- No real user data is used
- No personal names, emails, health details, or prescription names
- No API keys or local paths exposed
- Demo data is synthetic and sanitized

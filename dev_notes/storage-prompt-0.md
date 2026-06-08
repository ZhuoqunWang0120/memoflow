Add file-backed persistence for approved MemoFlow items.

Do not add UI or database yet.
Use data/items.jsonl as canonical store.
Add Item schema separate from Suggestion schema.
Add itemStoreService with list/add/update/archive/exportCsv.
Add CLI commands for item operations.
Suggestions remain provisional; only accepted/edited suggestions become Items.
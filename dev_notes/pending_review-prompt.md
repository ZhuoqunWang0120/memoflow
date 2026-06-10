Implement Quick Dump / Pending Review.

Add a Dump schema and file-backed dump store using data/dumps.jsonl.
Support saving raw dumps without generating suggestions, listing pending dumps, ignoring dumps, and reviewing a pending dump through the existing suggestion review flow.
Update the web UI with:
1. Save for later
2. Generate suggestions now
3. Pending Review list with Review now / Ignore

Do not add memory, dedup, RAG, reminders, auth, or database migration.
Do not break existing CLI or item ledger behavior.
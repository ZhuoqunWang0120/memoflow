Implement Freeform Memory for MemoFlow.

Context:
MemoFlow already has:
- A local/file-backed item ledger using data/items.jsonl
- Raw dump → suggestion → approve/edit/reject → saved item flow
- Pending Review / Quick Dump support using raw dumps
- Item Ledger deterministic sort/filter/search
- Existing suggestion generation service and prompt builder
- Existing web UI for dump input, suggestion review, and item ledger

Goal:
Add a lightweight, low-friction memory system so the user can save natural-language context that helps future suggestion generation.

Product principle:
Memory should feel like “I can casually tell MemoFlow something to remember.”
Do NOT make the user fill out structured fields like type/key/value.
Do NOT require the user to manage a complex knowledge base.
Memory is freeform text, user-created, and user-controlled.

Important constraints:
- Do NOT use LLMs to extract, rewrite, classify, or auto-create memory.
- Do NOT implement automatic memory suggestions.
- Do NOT add embeddings, vector search, RAG, semantic retrieval, or ranking.
- Do NOT migrate to a database.
- Do NOT break existing item, dump, review, or ledger behavior.
- Do NOT require memory for suggestion generation; it should be optional.
- Keep memory editable/deletable/archivable by the user.
- Keep implementation local-first and file-backed.

Required features:

1. Memory schema

Add a MemoryEntry schema/type.

Suggested shape:

ts type MemoryEntry = {   id: string;   text: string;   created_at: string;   updated_at: string;   archived_at?: string | null; };

Requirements:
- text is required and should be non-empty after trimming.
- id should be generated consistently with the project’s existing id pattern.
- created_at and updated_at should be ISO timestamps.
- Archived memory entries should not be injected into suggestion prompts by default.

2. Memory store

Add a file-backed memory store using:

text data/memory.jsonl

Implement reusable functions such as:

ts addMemory(text) listMemory(options?) updateMemory(id, updates) archiveMemory(id) deleteMemory(id) // optional; archive is enough if the project prefers soft delete getActiveMemory()

Requirements:
- Preserve existing JSONL style used by items/dumps.
- If data/memory.jsonl does not exist, create it or treat it as an empty store.
- listMemory should hide archived memory by default, with an option to include archived entries.
- archiveMemory should set archived_at and update updated_at.
- updateMemory should update text and updated_at.
- Empty or whitespace-only memory should not be saved.

3. Web UI: Add Memory

Add a low-friction “+ Add Memory” interaction.

Suggested locations:
- Near the dump input / suggestion generation area
- Optionally also in a small Memory panel or settings area

UI requirements:
- User clicks “+ Add Memory”
- A small input/modal/popover appears
- User enters freeform text
- User clicks Save
- The memory is saved without leaving the current flow
- After saving, input clears and the active memory list updates

Examples of intended memory text:
- Kiersten is my Duke DSO contact for STEM OPT questions.
- “agentic app project” refers to my customer support resolution agent project.
- “shift” means going to my hospital shift.
- Fragomen is the immigration law firm handling my H-1B case.

Do NOT force the user to split memory into fields like person/project/meaning.

4. Web UI: Memory list / management

Add a simple memory list.

Minimum UI:
- Show active memory entries
- Edit memory text
- Archive memory
- Optionally show archived memory behind a toggle

Keep this simple. This is not a full knowledge-base manager.

5. Optional memory injection into suggestion generation

Add a user-controlled option to include memory during suggestion generation.

Suggested UI:
- A toggle or checkbox labeled “Use memory” or “Use context”
- Default can be off or on, but choose one consistent with the current product flow and document it

Backend behavior:
- When memory/context is enabled, fetch active memory entries from data/memory.jsonl
- Inject them into the suggestion generation prompt in a compact section such as:

text User memory: - Kiersten is my Duke DSO contact for STEM OPT questions. - “agentic app project” refers to my customer support resolution agent project.

Requirements:
- Only active, non-archived memory entries should be injected.
- Keep injection compact and clearly separated from the raw dump.
- If there are many memory entries, include a reasonable cap, such as the most recent 20 active entries.
- Do not use LLM retrieval or embedding retrieval.
- Do not allow memory to override explicit user input in the raw dump.
- Update the prompt rules to say memory is context only; if memory conflicts with the current dump, the current dump wins.
- If memory is insufficient to resolve ambiguity, the model should still use clarify_needed.

6. API routes / service integration

Add or update API routes as appropriate for the existing web architecture.

Likely routes:
- GET /api/memory
- POST /api/memory
- PATCH /api/memory/:id
- DELETE /api/memory/:id or POST /api/memory/:id/archive

For suggestion generation:
- Update the existing suggestion API to accept a flag such as useMemory or useContext
- The API should pass active memory entries into the existing suggestion service only when the flag is enabled

7. Tests

Add tests for:
- adding a memory entry
- rejecting empty/whitespace-only memory
- listing active memory entries
- archiving memory
- archived memory hidden by default
- updating memory text updates updated_at
- active memory is included in prompt/context only when memory/context flag is enabled
- archived memory is not included in prompt/context
- suggestion generation still works when no memory file exists
- existing dump/item flows still pass

8. Documentation

Update README or implementation log with a short note:

- MemoFlow now supports freeform user memory stored in data/memory.jsonl.
- Memory is user-created and user-controlled.
- Memory is not automatically extracted by the LLM.
- Memory can optionally be injected into suggestion generation as lightweight context.
- This is not full RAG, embedding retrieval, or automatic memory management.

Acceptance criteria:
- I can add a freeform memory entry from the web UI without leaving the current flow.
- I can see active memory entries.
- I can edit/archive memory entries.
- Empty memory is not saved.
- Archived memory is hidden and not used in prompts.
- I can generate suggestions with memory/context enabled.
- I can generate suggestions without memory/context enabled.
- Existing quick dump, pending review, suggestion review, item ledger, sort/filter/search, update, and archive flows still work.
- Tests pass.
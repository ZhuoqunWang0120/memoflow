Build a standalone TypeScript module and CLI for Smart Memo Core v0.

Goal:
Given a raw memo dump, return structured suggestions classified as task, exploration, idea, reference, or clarify_needed.
The flow is:
Raw memo dump -> LLM / stub parser -> Structured suggestions -> Human-readable JSON output

Input: text of dumped memo
Output: suggestion of item list. 
Sample:
input: "email Duke about final eval. also maybe smart memo should support waiting status"
output: 
```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Email Duke about final evaluation",
      "description": "Ask Duke about the OPT final evaluation details",
      "status": "ready",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/immigration",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    },
        {
      "type": "idea",
      "title": "Add waiting status to Smart Memo",
      "description": "the smart memo product should allow task status to be waiting",
      "status": "saved",
      "confidence": 0.7,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "product",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```  

Requirements:
- No UI
- No database
- Use TypeScript
- Define Zod schemas for Suggestion and SuggestionResult
- Implement a stub parser first
- Implement an LLM parser behind a clean interface
- Add a CLI command that accepts raw text and prints JSON
- Add golden_cases.jsonl with sample cases
- Add an eval runner that checks type correctness and key title keywords
- Keep context optional in the function signature for future RAG
- Keep code simple and neat. Avoid unnecessary over-engineering. Use classes only when necessary. 

Build a standalone TypeScript module and CLI for Smart Memo Core v0.

Goal:
Given a raw memo dump, return structured suggestions classified as task, exploration, idea, reference, or clarify_needed.
The flow is:
Raw memo dump -> LLM / stub parser -> Structured suggestions -> Human-readable JSON output

Input: text of dumped memo
Output: suggestion of item list. 
Sample:
input: "email Duke about final eval. also maybe smart memo should support waiting status"
output: 
```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Email Duke about final evaluation",
      "description": "Ask Duke about the OPT final evaluation details",
      "status": "ready",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/immigration",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    },
        {
      "type": "idea",
      "title": "Add waiting status to Smart Memo",
      "description": "the smart memo product should allow task status to be waiting",
      "status": "saved",
      "confidence": 0.7,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "product",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```  

Requirements:
- No UI
- No database
- Use TypeScript
- Define Zod schemas for Suggestion and SuggestionResult
- Implement a stub parser first
- Implement an LLM parser behind a clean interface
- Add a CLI command that accepts raw text and prints JSON
- Add golden_cases.jsonl with sample cases
- Add an eval runner that checks type correctness and key title keywords
- Keep context optional in the function signature for future RAG

## Module Structure Explanation

This module is intentionally designed as the standalone **core intelligence layer** of Smart Memo / MemoFlow.

The goal is not to build the full app yet. The goal is to build and test the core transformation:

```text
raw messy memo
→ structured suggestions
→ human-readable JSON output
```

Later, the webapp UI can call this module and render the returned suggestions as editable proposal cards.

Proposed structure:

```text
memoflow-core/
  src/
    schemas/
      suggestion.ts
    prompts/
      dumpToSuggestions.ts
    services/
      suggestionService.ts
    eval/
      golden_cases.jsonl
      runEval.ts
    cli.ts
```

### `src/schemas/suggestion.ts`

Defines the shape of a valid suggestion.

This file should include Zod schemas and TypeScript types for:

- `Suggestion`
- `SuggestionResult`
- suggestion types: `task`, `exploration`, `idea`, `reference`, `clarify_needed`

This schema is the contract between the AI logic, CLI, future UI, eval runner, and future database.

Conceptually:

```text
LLM returns JSON
→ Zod validates JSON
→ only valid structured suggestions are returned
```

The schema should be strict enough to make output predictable, but flexible enough to support future fields such as citations, related context, or source references.

### `src/prompts/dumpToSuggestions.ts`

Stores the prompt used to transform raw memo text into structured suggestions.

The prompt should explain the classification rules:

```text
Task = concrete action, deliverable, person to contact, deadline, or next step.
Exploration = active open question, decision, research direction, learning goal, or sensemaking problem.
Idea = parked thought, possible future feature, content idea, or maybe-later item without commitment.
Reference = information to save, with no direct action implied.
Clarify needed = insufficient information to safely classify.
```

The prompt should also instruct the model to:

- return structured JSON only
- split one memo into multiple suggestions when needed
- avoid over-inference
- mark ambiguity explicitly with `clarify_needed`
- include confidence and clarification fields
- preserve the user’s intent as much as possible

Keeping prompts in a dedicated file makes later prompt iteration easier and avoids mixing prompt logic into service or UI code.

### `src/services/suggestionService.ts`

Contains the main business logic for the module.

This service should expose the main function that future callers use, for example:

```ts
createSuggestionsFromDump({
  rawText,
  context,
}) -> SuggestionResult
```

The service is responsible for:

1. validating the raw input
2. building the prompt
3. calling either the stub parser or LLM parser
4. validating the returned JSON against the Zod schema
5. returning a clean `SuggestionResult`

The future UI should not know about prompts, model calls, parsing, or validation. It should only call this service and receive structured suggestions.

The function signature should keep `context` optional from day one, even if it is unused in MVP. This creates a clean extension point for future RAG:

```ts
type CreateSuggestionsInput = {
  rawText: string;
  context?: ContextBundle;
};
```

In MVP, `context` can be empty or ignored. In a later version, RAG can populate it with related tasks, previous memos, uploaded documents, emails, or source snippets without changing the UI contract.

### `src/eval/golden_cases.jsonl`

Contains a small set of expected input/output examples.

Each line should be one test case. For example:

```json
{"id":"case_001","input":"email Duke about final eval before 7/22 and SEVP","expected":[{"type":"task","title_contains":["Duke","final eval","SEVP"],"needs_clarification":false}]}
```

The purpose of this file is to make prompt and parser quality testable.

Instead of relying only on “does this output feel good?”, the module can be evaluated against representative examples.

The golden cases should include:

- simple task creation
- multiple suggestions from one memo
- exploration classification
- idea classification
- reference note classification
- ambiguous memo requiring clarification
- follow-up / waiting-on-someone cases
- memo text with vague or informal wording

This file should grow over time with real examples from actual usage.

### `src/eval/runEval.ts`

Runs the parser against `golden_cases.jsonl`.

The eval runner should:

1. load all golden cases
2. call `createSuggestionsFromDump()` on each input
3. compare actual output with expected output
4. check type correctness
5. check key title keywords
6. check `needs_clarification` when specified
7. print a pass/fail summary

Example output:

```text
case_001 PASS
case_002 PASS
case_003 FAIL
Expected type: exploration
Actual type: idea

Summary:
2/3 passed
Type accuracy: 66.7%
```

The eval does not need to be perfect. Its purpose is to catch obvious regressions and make prompt iteration more systematic.

### `src/cli.ts`

Provides a simple command-line interface for testing the module without UI or database.

Example usage:

```bash
npm run suggest -- "email Duke about final eval timing"
```

Expected output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Email Duke about final evaluation timing",
      "status": "ready",
      "confidence": 0.91,
      "needs_clarification": false
    }
  ]
}
```

The CLI makes the core module immediately usable and debuggable before building the full local webapp.

### Why this structure is useful

This structure separates responsibilities clearly:

```text
schemas/  = what valid output looks like
prompts/  = how the LLM is instructed
services/ = how suggestions are generated
eval/     = how quality is tested
cli.ts    = how humans can run the module directly
```

This keeps the MVP modular.

In the future:

- the UI can call `suggestionService`
- the database can store approved suggestions as items
- RAG can be added through the optional `context` input
- email/chat/document import can create raw memo inputs
- organization suggestions can reuse the same proposal/approval pattern

The important architectural idea is:

```text
Raw memo
→ SuggestionResult
→ future user approval/editing
→ saved Item
```

The module should not directly create final tasks. It should only generate structured suggestions that a future user-facing app can review, edit, approve, or reject.



You have already implemented the initial `dump -> suggestion` flow for MemoFlow Core.

Now revise the implementation to incorporate the new suggestion definition document and few-shot examples.

## Goal

Update the dump-to-suggestion behavior so that the model classifies raw memo dumps according to the project’s current design rules:

- classify based on observable wording, not hidden commitment
- do not infer commitment level as a required field
- use `task`, `exploration`, `idea`, `reference`, and `clarify_needed`
- use default statuses by type
- preserve uncertainty instead of hallucinating missing context
- support multi-item splitting
- validate output with Zod
- keep the core module UI-free and database-free

## Files to add or update

Please add two documentation/prompt reference files if they do not already exist:

```text
src/examples/suggestion_definitions.md
src/examples/dump2suggestions_few_shot_ex.md
```

I will provide the content for both files.

Then update the prompt construction logic, likely in:

```text
src/prompts/dumpToSuggestions.ts
```

or wherever the dump-to-suggestions prompt currently lives.

The prompt should use:

1. the core rules from `suggestion_definitions.md`
2. a selected subset of examples from `src/examples/dump2suggestions_few_shot_ex.md`
3. the current user input
4. the expected JSON schema

## Important design rules to implement

### 1. Commitment is not a required output field

Do not add `commitment_level` as a required schema field.

Commitment is often user intent and is not reliably observable from a short memo. The model should classify based on observable wording.

In v0, commitment is only indirectly reflected through type/status:

```text
task -> ready
exploration -> open
idea -> saved
reference -> saved
clarify_needed -> needs_clarification
```

The future user-facing app can let the user override type/status. That user edit is the true commitment signal.

### 2. Use these object types

```text
task
exploration
idea
reference
clarify_needed
```

Definitions:

```text
Task = concrete action, deliverable, person to contact, deadline, or next step.
Exploration = active question, decision, research direction, learning goal, or sensemaking thread.
Idea = possible project, feature, content idea, direction, or bare topic without a clear action/question.
Reference = information, link, reminder, or reflection to save, with no direct action implied.
Clarify needed = insufficient information to safely classify without inventing context.
```

### 3. Use default status by type

```text
task -> ready
exploration -> open
idea -> saved
reference -> saved
clarify_needed -> needs_clarification
```

Only use a different status if the memo clearly implies it.

### 4. Handle bare phrases carefully

Short bare phrases should not automatically become tasks.

Use this rule:

```text
Bare project/product/content phrase -> idea
Bare link -> reference
Bare reflection/principle -> reference
Bare unclear shorthand -> clarify_needed
Bare known action phrase -> task
```

Examples:

```text
"portfolio website" -> idea
"Dissertation chatbot" -> idea
"https://www.metacareers.com/alumni_portal/resources" -> reference
"Yellow banana problem" -> clarify_needed
"google投递" -> task
```

### 5. Clarification behavior

Use `clarify_needed` when the model would need to invent important missing context.

For `clarify_needed`, include:

```text
needs_clarification: true
clarification_question
missing_context
```

The model should preserve uncertainty instead of hallucinating context.

### 6. Multi-item splitting

If one memo clearly contains multiple items, return multiple suggestions.

Example:

```text
email Duke about final eval. also maybe memo app should support waiting status
```

should produce:

```text
1. task -> Email Duke about final evaluation
2. idea -> Add waiting status to MemoFlow
```

## Schema changes

Review the current Zod schema for `Suggestion` and `SuggestionResult`.

The schema should support at least:

```ts
type SuggestionType =
  | "task"
  | "exploration"
  | "idea"
  | "reference"
  | "clarify_needed";

type Suggestion = {
  type: SuggestionType;
  title: string;
  description?: string;
  status: string;
  confidence: number;
  needs_clarification: boolean;
  clarification_question?: string;
  missing_context?: string[];
  suggested_fields?: {
    follow_up_needed?: boolean | null;
    due_date?: string | null;
    waiting_on?: string | null;
    url?: string | null;
    tags?: string[] | null;
    category?: string | null; // optional only; do not require it
  };
};

type SuggestionResult = {
  suggestions: Suggestion[];
};
```

Important:

- `category` should be optional, not required.
- Do not force every optional field to be filled.
- Use `null` when a field is unknown but included.
- Do not include `commitment_level` as a required field.

## Prompt behavior

Update the LLM prompt so that it includes compact definitions and selected few-shot examples.

Do not blindly include all examples forever if it makes the prompt too long. For now it is acceptable to include a representative subset, around 8–12 examples, covering:

- simple task
- multiple suggestions from one memo
- exploration question
- idea / bare project phrase
- reference / reflection
- link as reference
- clarify_needed
- follow-up / waiting-on-someone
- bilingual Chinese/English examples

The full example file can remain in `src/examples/dump2suggestions_few_shot_ex.md` as documentation and future eval data.

## Eval updates

Update or add eval cases so that the expected behavior matches the new definitions.

The eval should check at least:

1. type correctness
2. default status correctness
3. number of suggestions
4. `needs_clarification`
5. presence of required title keywords
6. no hallucinated context for ambiguous cases

Add or update test cases for:

```text
面试带 id！ -> task, ready
portfolio website -> idea, saved
Dissertation chatbot -> idea, saved
Yellow banana problem -> clarify_needed, needs_clarification
https://www.metacareers.com/alumni_portal/resources -> reference, saved
should I build this as webapp or iOS first? -> exploration, open
email Duke about final eval. also maybe memo app should support waiting status -> two suggestions: task + idea
```

## CLI behavior

The CLI should continue to accept raw memo text and print valid JSON.

Example:

```bash
npm run suggest -- "portfolio website"
```

Expected type/status:

```json
{
  "suggestions": [
    {
      "type": "idea",
      "status": "saved"
    }
  ]
}
```

No UI or database should be added in this revision.

## Implementation constraints

- Keep the module standalone.
- Keep UI/database out of scope.
- Keep prompt logic out of CLI code.
- Keep schema validation centralized.
- Keep the LLM parser behind a clean interface.
- Preserve the stub parser if it exists, but update it enough that tests still make sense.
- Add or update tests/evals.
- Run the test suite and eval runner after changes.
- Report what files changed and any remaining limitations.

## Expected outcome

After this revision, the module should better reflect the current product design:

```text
Raw memo
-> structured suggestions
-> validated JSON
```

The output should be useful for a future UI where the user can review, edit, approve, reject, or convert suggestions into saved items.
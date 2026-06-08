## Basic Design Notes for MemoFlow Suggestions

This document explains the basic meaning of the fields used in `dump -> suggestions`.

The model should use these definitions when converting a raw memo dump into structured suggestions.

---

## Core Principle

A raw memo is often short, informal, and incomplete. The model should classify based on **observable wording**, not hidden intent.

In particular, the model should **not try to infer the user's true commitment level** unless the memo clearly signals it.

Commitment is not a required output field in v0. Instead, commitment is only indirectly reflected through `type` and `status`:

```text
task -> ready
exploration -> open
idea -> saved
reference -> saved
clarify_needed -> needs_clarification
```

The user can later override the suggestion by editing, approving, rejecting, or converting it. That user action is the true commitment signal.

---

## Core Object Types

A raw memo can produce one or more suggestions.

Each suggestion should be classified as one of:

```text
task
exploration
idea
reference
clarify_needed
```

### `task`

A `task` is a concrete action that the user can do or track.

Use `task` when the memo contains an observable action, such as:

- a person to contact
- a form to complete
- a file to download
- something to submit
- something to review
- something to prepare
- a concrete next step
- a follow-up action
- a deadline-related action

Examples:

```text
email Duke about final eval
FRAGOMEN portal login and download files
sign the compensation, double check calculation
google投递
开始找工作
给 gjl 的朋友发邮件
```

A task should usually have a status like:

```text
ready
in_progress
waiting
follow_up
done
archived
```

Default status for a newly created task should usually be:

```text
ready
```

Meaning: the task is actionable and can be worked on.

---

### `exploration`

An `exploration` is an active question, decision, research direction, learning goal, or sensemaking thread.

Use `exploration` when the memo is framed as a question, uncertainty, investigation, comparison, learning direction, or problem to think through.

The model should classify something as `exploration` based on observable wording, such as:

```text
should I...
whether...
how...
why...
can X apply to Y?
figure out...
explore...
能不能...
怎么...
```

Examples:

```text
should I build this as webapp or iOS first?
how to close the gap in agentic application building experience
what’s the implication of token-level formatted generation on tabular generation?
how to design evals for customer success bots with no clear ground truth?
能不能赶上具身智能风口--学习/工作蹭到/发点 paper？
```

Default status for a newly created exploration should usually be:

```text
open
```

Meaning: the question/thread is active and unresolved. It has not been answered, closed, parked, or converted into concrete tasks yet.

Other possible exploration statuses:

```text
investigating
deciding
converted_to_tasks
parked
closed
```

Use these only when the memo clearly implies them. Otherwise use `open`.

---

### `idea`

An `idea` is a possible project, feature, content idea, direction, or maybe-later thought.

Use `idea` when the memo names something potentially useful, but does not contain a clear action or active question.

A bare noun phrase should usually be treated as `idea` unless the wording gives a clear action or question.

Examples:

```text
portfolio website
Dissertation chatbot
BI toolkit for microbiome data analytics
maybe memo app should support waiting status
agentic application 项目
```

Default status for a newly created idea should usually be:

```text
saved
```

Meaning: the thought has been captured, but it is not being treated as an active task by default.

Other possible idea statuses:

```text
promoted
archived
```

Use `promoted` only if the idea has clearly become a task or exploration.

---

### `reference`

A `reference` is information, a link, a reminder, or a reflection that should be saved but does not directly imply an action.

Use `reference` when the memo is mainly something to remember, not something to do or decide.

Examples:

```text
成长也是有窗口的，抓住它，而不是焦虑求职窗口
面试是机会，但 chatbot 是资产
能力里程碑是长期可复利的财富
https://www.metacareers.com/alumni_portal/resources
提升工程能力 这是一个基本功
```

Default status for a reference should usually be:

```text
saved
```

Meaning: the information has been stored for later reference.

Other possible reference statuses:

```text
archived
```

---

### `clarify_needed`

Use `clarify_needed` when the memo is too ambiguous to safely classify or turn into a useful suggestion.

This is especially important when the memo contains:

- vague pronouns: `this`, `that`, `the thing`, `it`
- private shorthand that is not explained
- a project/person/concept name without enough context
- unclear intent: not enough information to know whether it is a task, idea, exploration, or reference

Examples:

```text
Yellow banana problem
ask her about this
follow up on that thing
Meta internal post (qqd, fig.lu)
```

Default status should be:

```text
needs_clarification
```

The suggestion should include:

```text
needs_clarification: true
clarification_question: a concise question asking what context is missing
missing_context: a list of missing information
```

The model should not hallucinate missing context. If the memo is ambiguous, preserve uncertainty.

---

## Recommended Status Values

Statuses should describe the state of the item after it is saved.

### Common status meanings

```text
ready
```

The item is actionable and can be worked on.

Usually used for concrete tasks.

```text
open
```

The item is an active but unresolved exploration.

Use for questions, decisions, research directions, learning goals, or sensemaking threads.

```text
saved
```

The item has been captured but is not an active task.

Usually used for ideas and references.

```text
needs_clarification
```

The item cannot be safely interpreted without more information.

Use when the model needs more context from the user.

```text
waiting
```

The task is waiting on someone or something external.

Use when the user has already taken an action and the next step depends on another person/system.

Example:

```text
waiting_on: "Duke"
status: "waiting"
```

```text
follow_up
```

The task needs a future follow-up.

Use when the main next action is to check back later.

```text
in_progress
```

The task is actively being worked on.

Use only if the memo clearly implies ongoing work.

```text
done
```

The task has already been completed.

Use only if the memo clearly says the item is complete.

```text
parked
```

The item is intentionally paused or deferred.

Common for explorations.

```text
archived
```

The item is no longer active but kept for record.

---

## Suggested Default Status by Type

When unsure, use these defaults:

```text
task -> ready
exploration -> open
idea -> saved
reference -> saved
clarify_needed -> needs_clarification
```

---

## Important Distinctions

### Task vs Exploration

Use `task` when there is a concrete action.

Use `exploration` when the user needs to think, investigate, decide, compare, or understand something before concrete tasks are clear.

Examples:

```text
"email Duke about final eval" -> task
"decide whether I need both final eval and 12-month eval" -> exploration
```

```text
"create repo for chatbot eval project" -> task
"how should chatbot eval work when there is no ground truth?" -> exploration
```

```text
"Reach out to Fragomen to get H1b filed" -> task
"Can Langevin dynamics contextualized generation be applied to LLM/Transformer as generator?" -> exploration
```

---

### Exploration vs Idea

Use `exploration` when the memo is framed as an active question, decision, investigation, comparison, or sensemaking problem.

Use `idea` when the memo is a possible project, feature, or bare topic without a clear action or question.

Examples:

```text
"should I build this as webapp or iOS first?" -> exploration
"maybe build a mobile version someday" -> idea
```

```text
"how to apply mixed effects modeling ideas to LLM generation?" -> exploration
"Dissertation chatbot" -> idea
```

```text
"能不能赶上具身智能风口--学习/工作蹭到/发点 paper？" -> exploration
"BI toolkit for microbiome data analytics" -> idea
```

Important: do not classify a bare phrase as `exploration` only because it might be important. The memo should contain an observable question, uncertainty, investigation, or decision signal.

---

### Idea vs Reference

Use `idea` when the memo describes something that could become a project, feature, content piece, direction, or future action.

Use `reference` when the memo is mainly information, a link, or a reflection to remember.

Examples:

```text
"portfolio website" -> idea
"https://www.metacareers.com/alumni_portal/resources" -> reference
```

```text
"BI toolkit for microbiome data analytics" -> idea
"能力里程碑是长期可复利的财富" -> reference
```

```text
"maybe memo app should support waiting status" -> idea
"面试是机会，但 chatbot 是资产" -> reference
```

---

### Task vs Clarify Needed

Use `task` if the action is clear enough.

Use `clarify_needed` if the model would need to invent important missing context.

Examples:

```text
"email Duke about final eval" -> task
"email her about this" -> clarify_needed
```

```text
"download files from Fragomen portal" -> task
"download those files" -> clarify_needed
```

```text
"google投递" -> task
"submit that one" -> clarify_needed
```

---

### Bare Phrase Handling

Short bare phrases are common in memo dumps.

When the memo is only a bare phrase, classify by observable shape:

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

The model should not infer hidden commitment from a bare phrase.

---

## Field Meanings

### `type`

The item class:

```text
task
exploration
idea
reference
clarify_needed
```

### `title`

A concise, human-readable title.

The title should be clear enough to appear in a task list.

Good:

```text
Email Duke about final evaluation timing
Explore whether MemoFlow should start as a webapp or iOS app
Add waiting status to MemoFlow
Save Meta alumni portal resources link
```

Avoid vague titles like:

```text
Do this
Follow up
Important thing
```

unless the input itself is too ambiguous, in which case use `clarify_needed`.

### `description`

A short explanation of what the item means.

The description may preserve details from the raw memo, but should not invent unavailable context.

### `status`

The current state of the suggestion.

Use the default mapping unless the memo clearly implies another status:

```text
task -> ready
exploration -> open
idea -> saved
reference -> saved
clarify_needed -> needs_clarification
```

### `confidence`

A number between `0` and `1` indicating how confident the model is in the classification and interpretation.

Suggested guideline:

```text
0.90-1.00 = very clear
0.75-0.89 = reasonably clear
0.50-0.74 = partially clear but some ambiguity
below 0.50 = should likely be clarify_needed
```

### `needs_clarification`

Boolean.

Use `true` when important context is missing or the model should ask the user before creating a final item.

Use `false` when the suggestion is good enough for user review/editing.

### `clarification_question`

Only required when `needs_clarification = true`.

Should ask one concise question.

Good:

```text
What does "Yellow banana problem" refer to, and do you want to save it, explore it, or turn it into an action?
```

Bad:

```text
Please provide more details.
```

### `missing_context`

A list of specific missing information.

Example:

```json
[
  "Who 'her' refers to",
  "What 'this' refers to",
  "Whether the desired action is to email, save, or research"
]
```

### `suggested_fields`

A flexible object for optional fields.

Possible fields:

```text
follow_up_needed
due_date
waiting_on
url
tags
```

Do not force every field to be filled.

Use `null` when the field is not available from the memo.

---

## Category Field

`category` is optional.

It can be useful for grouping and filtering later, but it should not be required in the first MVP.

If used, it should be lightweight and not over-engineered.

Examples:

```text
admin/immigration
job search
career/learning
research/LLM
project/eval
reflection
communication
```

The model should not spend too much effort inventing perfect categories. If unsure, omit category or set it to `null`.

---

## Model Behavior Guidelines

The model should:

1. Preserve the user’s intent.
2. Classify based on observable wording, not hidden commitment.
3. Split one memo into multiple suggestions when it clearly contains multiple items.
4. Avoid turning every thought into a task.
5. Use `task` for clear actions.
6. Use `exploration` for observable questions, decisions, investigations, learning goals, and sensemaking.
7. Use `idea` for possible projects, features, directions, or bare topics without clear action/question.
8. Use `reference` for information, links, reminders, or reflections.
9. Use `clarify_needed` when important context is missing.
10. Avoid hallucinating private context.
11. Prefer useful, editable suggestions over overly detailed output.
12. Keep titles concise and action-oriented when appropriate.

---

## Examples of Multi-Item Splitting

Input:

```text
email Duke about final eval. also maybe memo app should support waiting status
```

Output should contain two suggestions:

```text
1. task -> Email Duke about final evaluation
2. idea -> Add waiting status to MemoFlow
```

Input:

```text
1. 还设备 2. 回复 gjl 3. agentic application 项目
```

Output should contain three suggestions:

```text
1. task -> Return company equipment
2. task -> Reply to GJL
3. idea or exploration -> Agentic application project
```

Use best judgment for ambiguous items, and mark `needs_clarification` when needed.

---

## Key Principle

The output is a suggestion, not the final truth.

The system should produce structured suggestions that a future user-facing app can review, edit, approve, reject, or convert into saved items.

The model should be helpful but not overconfident.
# MemoFlow Native AI Contract

Date: 2026-07-11

## Goal

Define the native AI request/response contract, validation rules, and error behavior for the Apple-first MemoFlow app. This contract is grounded in the current OpenAI-backed web parser behavior.

## Native AI Boundary

Stage 1 uses a development-only direct provider configuration for internal builds:

- `MEMOFLOW_OPENAI_API_KEY`
- `MEMOFLOW_OPENAI_MODEL`
- `MEMOFLOW_OPENAI_BASE_URL` optional

These values must not be committed into source control. They are for development-only native parity, not for public distribution architecture.

## Request Contract

### Inputs

- `rawText`: required non-empty user dump
- `useMemory`: boolean
- `useContext`: boolean
- `memorySnippets[]`: active memory texts when `useMemory == true` and `useContext == false`
- `recentActiveItems[]`: recent saved items when `useContext == true`
- `keywordMatchedItems[]`: deterministic keyword-matched active items when `useContext == true`
- `semanticScanItems[]`: deferred in Stage 1 native scaffold unless deliberately implemented later

### Prompt Rules

The AI request must preserve these behavior rules:

- valid output types are only:
  - `task`
  - `exploration`
  - `idea`
  - `reference`
- ambiguity uses `needs_clarification = true`
- ambiguity should usually produce `status = needs_clarification`
- do not invent context when the dump is underspecified
- description is optional and should not be forced when low value
- related item references may only use IDs supplied in context

## Response Contract

Top-level shape:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Email Duke about final evaluation",
      "description": "Contact Duke about the final evaluation.",
      "status": "ready",
      "confidence": 0.92,
      "needs_clarification": false,
      "clarification_question": "optional",
      "missing_context": ["optional"],
      "suggested_fields": {
        "category": "optional",
        "follow_up_needed": true,
        "due_date": "optional",
        "waiting_on": "optional",
        "url": "optional",
        "tags": ["optional"]
      },
      "related_existing_items": [
        {
          "item_id": "itm_123",
          "relationship": "possible_duplicate",
          "reason": "Shares key terms",
          "confidence": 0.66
        }
      ]
    }
  ]
}
```

## Validation Rules

After parsing the provider payload, native code must validate and normalize:

- `rawText` must not be empty before request
- `suggestions` must be an array
- `type` must be one of the four valid item types
- `title` must be non-empty after trimming
- `confidence` should clamp into `0...1` if needed
- `needs_clarification` should be inferred as true if:
  - the provider returns it directly, or
  - normalized status becomes `needs_clarification`
- if `needs_clarification == true`, preserve uncertainty instead of inventing certainty
- if non-clarification status is missing or blank, use the type default status
- blank descriptions should normalize to `nil`
- related item IDs not present in supplied context should be dropped

## Approval-to-Item Rules

When a user approves a suggestion:

- suggestion type becomes item type unless explicitly overridden
- suggestion title becomes item title unless explicitly overridden
- suggestion description becomes item description unless explicitly overridden
- suggested fields merge with user overrides
- if override status is blank or missing:
  - use `needs_clarification` when unresolved
  - otherwise use the type default status

## Correction Logging Rules

When the user saves an edited suggestion:

- compare the baseline proposal snapshot to the final saved item
- if no meaningful fields changed, do not log a correction event
- if fields changed, append one correction event with:
  - source
  - proposal ID if present
  - dump ID if present
  - before snapshot
  - after snapshot
  - changed field list
- correction logs are passive evidence only

## Error Behavior

Native AI errors should map into predictable user-visible states:

### Configuration Error

Examples:
- missing `MEMOFLOW_OPENAI_API_KEY`
- unsupported or blank model

User behavior:
- show a clear local-development configuration error
- do not create fake suggestions

### Network or Provider Error

Examples:
- no connectivity
- provider timeout
- non-2xx response

User behavior:
- show a concise failure message
- keep the raw dump text intact for retry
- do not mark pending dumps reviewed automatically

### Invalid Provider Payload

Examples:
- malformed JSON
- missing `suggestions`
- invalid schema values

User behavior:
- surface a parsing failure message
- keep the request retryable

### Partial Review Errors

Examples:
- save item succeeds but correction log encode fails

User behavior:
- prefer atomic local save behavior where possible
- if atomicity is not guaranteed in the initial scaffold, report the failure clearly and do not silently discard it

## Stage 1 Native Scaffold Notes

The initial native scaffold may implement:

- direct OpenAI-compatible requests
- local context building from SwiftData
- deterministic local filtering for context input

It does not need to implement yet:

- production AI proxy
- provider routing
- usage accounting
- public alpha abuse controls

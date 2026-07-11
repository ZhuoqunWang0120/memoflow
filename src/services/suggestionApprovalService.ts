import type { ItemFields, ItemType } from "../schemas/item.js";
import type { Suggestion } from "../schemas/suggestion.js";
import type { AddItemInput } from "./itemStoreService.js";

export type SuggestionApprovalOverrides = {
  type?: ItemType;
  title?: string;
  description?: string;
  status?: string;
  fields?: ItemFields;
};

export type SuggestionToItemInput = {
  suggestion: Suggestion;
  rawText: string;
  overrides?: SuggestionApprovalOverrides;
};

export function suggestionToAddItemInput(input: SuggestionToItemInput): AddItemInput {
  const overrides = input.overrides ?? {};
  const type = overrides.type ?? input.suggestion.type;

  const fields = {
    ...input.suggestion.suggested_fields,
    ...overrides.fields,
  };

  return {
    type,
    title: overrides.title ?? input.suggestion.title,
    description: overrides.description ?? input.suggestion.description,
    status: normalizeApprovedStatus(input.suggestion, type, overrides.status),
    fields,
    source: {
      kind: "suggestion",
      raw_text: input.rawText,
      suggestion: input.suggestion,
    },
  };
}

export function defaultStatusForType(type: ItemType): string {
  switch (type) {
    case "task":
      return "ready";
    case "exploration":
      return "open";
    case "idea":
    case "reference":
      return "saved";
  }
}

function normalizeApprovedStatus(
  suggestion: Suggestion,
  type: ItemType,
  overrideStatus: string | undefined,
): string {
  const trimmed = overrideStatus?.trim();
  if (!trimmed) return suggestion.needs_clarification ? "needs_clarification" : defaultStatusForType(type);

  return trimmed;
}

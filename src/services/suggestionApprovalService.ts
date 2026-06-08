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
  const type = overrides.type ?? persistableType(input.suggestion);

  if (!type) {
    throw new Error("clarify_needed suggestions must be edited to task, exploration, idea, or reference before saving.");
  }

  const fields = {
    ...input.suggestion.suggested_fields,
    ...overrides.fields,
  };

  return {
    type,
    title: overrides.title ?? input.suggestion.title,
    description: overrides.description ?? input.suggestion.description,
    status: overrides.status ?? defaultStatusForType(type),
    fields,
    source: {
      kind: "suggestion",
      raw_text: input.rawText,
      suggestion: input.suggestion,
    },
  };
}

function persistableType(suggestion: Suggestion): ItemType | null {
  if (suggestion.type === "clarify_needed") return null;
  return suggestion.type;
}

function defaultStatusForType(type: ItemType): string {
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

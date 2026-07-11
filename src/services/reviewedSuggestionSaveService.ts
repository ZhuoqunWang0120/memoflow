import type { Item } from "../schemas/item.js";
import type { Suggestion } from "../schemas/suggestion.js";
import { appendCorrectionEvent, type CorrectionEventStoreOptions, type ReviewCorrectionContext } from "./correctionEventService.js";
import { add, type AddItemInput, type ItemStoreOptions } from "./itemStoreService.js";
import { suggestionToAddItemInput, type SuggestionApprovalOverrides } from "./suggestionApprovalService.js";

export type SaveReviewedSuggestionInput = {
  rawText: string;
  suggestion: Suggestion;
  overrides?: SuggestionApprovalOverrides;
  reviewContext?: ReviewCorrectionContext;
};

export type SaveReviewedSuggestionOptions = {
  itemStore?: ItemStoreOptions;
  correctionStore?: CorrectionEventStoreOptions;
};

export type SaveReviewedSuggestionResult = {
  item: Item;
  correctionLogged: boolean;
  addInput: AddItemInput;
};

export async function saveReviewedSuggestion(
  input: SaveReviewedSuggestionInput,
  options: SaveReviewedSuggestionOptions = {},
): Promise<SaveReviewedSuggestionResult> {
  const addInput = suggestionToAddItemInput({
    rawText: input.rawText,
    suggestion: input.suggestion,
    overrides: input.overrides,
  });

  const item = await add(addInput, options.itemStore);

  let correctionLogged = false;
  if (input.reviewContext) {
    const event = await appendCorrectionEvent(
      {
        rawText: input.rawText,
        suggestion: input.suggestion,
        overrides: input.overrides,
        savedItem: item,
        reviewContext: input.reviewContext,
      },
      options.correctionStore,
    );
    correctionLogged = Boolean(event);
  }

  return { item, correctionLogged, addInput };
}

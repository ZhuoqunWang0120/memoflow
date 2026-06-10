import { SuggestionResultSchema, type SuggestionResult } from "../schemas/suggestion.js";
import { createOpenAiSuggestionParser } from "../parsers/openAiSuggestionParser.js";
import { stubSuggestionParser } from "../parsers/stubSuggestionParser.js";
import type { ContextBundle, ParserName, SuggestionParser } from "../parsers/types.js";
import type { RelatedExistingItem } from "../schemas/suggestion.js";
import {
  createOpenAiSemanticRelationScanner,
  type SemanticRelationScanner,
} from "./semanticRelationScanService.js";
import { deterministicRelatedItems } from "./suggestionContextService.js";

export type CreateSuggestionsInput = {
  rawText: string;
  context?: ContextBundle;
};

export type CreateSuggestionsOptions = {
  parser?: ParserName;
  suggestionParser?: SuggestionParser;
  semanticRelationScanner?: SemanticRelationScanner;
};

export async function createSuggestionsFromDump(
  input: CreateSuggestionsInput,
  options: CreateSuggestionsOptions = {},
): Promise<SuggestionResult> {
  const rawText = input.rawText.trim();

  if (!rawText) {
    throw new Error("rawText is required.");
  }

  const parserName = options.parser ?? "stub";
  const parser = options.suggestionParser ?? getParser(parserName);
  const scanner = options.semanticRelationScanner ?? getSemanticRelationScanner(parserName, options.suggestionParser);
  const scanPromise = scanner && shouldRunSemanticRelationScan(input.context)
    ? scanner.scan({ rawText, context: input.context })
    : Promise.resolve([]);
  const [result, semanticRelations] = await Promise.all([
    parser.parse({ rawText, context: input.context }),
    scanPromise,
  ]);

  const withSemanticRelations = addSemanticScanRelations(result, semanticRelations);
  const withFallback = addDeterministicRelatedFallback(withSemanticRelations, rawText, input.context);
  return SuggestionResultSchema.parse(filterRelatedItemsToContext(withFallback, input.context));
}

function getParser(name: ParserName): SuggestionParser {
  switch (name) {
    case "stub":
      return stubSuggestionParser;
    case "llm":
      return createOpenAiSuggestionParser();
  }
}

function getSemanticRelationScanner(
  parserName: ParserName,
  suggestionParser: SuggestionParser | undefined,
): SemanticRelationScanner | undefined {
  if (suggestionParser) return undefined;
  if (parserName !== "llm") return undefined;
  return createOpenAiSemanticRelationScanner();
}

function shouldRunSemanticRelationScan(context: ContextBundle | undefined): context is ContextBundle {
  return Boolean(context?.suggestionContext?.semanticScanItems.length);
}

function filterRelatedItemsToContext(result: SuggestionResult, context: ContextBundle | undefined): SuggestionResult {
  const allowedIds = new Set([
    ...(context?.suggestionContext?.recentActiveItems ?? []).map((item) => item.id),
    ...(context?.suggestionContext?.keywordMatchedItems ?? []).map((item) => item.id),
    ...(context?.suggestionContext?.semanticScanItems ?? []).map((item) => item.id),
  ]);

  if (allowedIds.size === 0) {
    return {
      suggestions: result.suggestions.map((suggestion) => ({
        ...suggestion,
        related_existing_items: undefined,
      })),
    };
  }

  return {
    suggestions: result.suggestions.map((suggestion) => ({
      ...suggestion,
      related_existing_items: suggestion.related_existing_items?.filter((related) => allowedIds.has(related.item_id)),
    })),
  };
}

function addDeterministicRelatedFallback(
  result: SuggestionResult,
  rawText: string,
  context: ContextBundle | undefined,
): SuggestionResult {
  const keywordMatchedItems = context?.suggestionContext?.keywordMatchedItems ?? [];
  if (keywordMatchedItems.length === 0) return result;

  const fallback = deterministicRelatedItems(rawText, keywordMatchedItems);
  if (fallback.length === 0) return result;

  return {
    suggestions: result.suggestions.map((suggestion) => {
      const existing = suggestion.related_existing_items ?? [];
      const existingIds = new Set(existing.map((related) => related.item_id));
      const missing = fallback.filter((related) => !existingIds.has(related.item_id));
      if (missing.length === 0) return suggestion;

      return {
        ...suggestion,
        related_existing_items: [...existing, ...missing],
      };
    }),
  };
}

function addSemanticScanRelations(result: SuggestionResult, relations: RelatedExistingItem[]): SuggestionResult {
  if (relations.length === 0 || result.suggestions.length !== 1) return result;

  const suggestion = result.suggestions[0];
  if (!suggestion) return result;

  return {
    suggestions: [
      {
        ...suggestion,
        related_existing_items: mergeRelatedItems(suggestion.related_existing_items ?? [], relations),
      },
    ],
  };
}

function mergeRelatedItems(existing: RelatedExistingItem[], incoming: RelatedExistingItem[]): RelatedExistingItem[] {
  const existingIds = new Set(existing.map((related) => related.item_id));
  const missing = incoming.filter((related) => !existingIds.has(related.item_id));
  return [...existing, ...missing];
}

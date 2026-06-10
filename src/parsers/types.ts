import type { SuggestionResult } from "../schemas/suggestion.js";
import type { SuggestionContext } from "../services/suggestionContextService.js";

export type ContextBundle = {
  snippets?: string[];
  suggestionContext?: SuggestionContext;
  [key: string]: unknown;
};

export type ParseSuggestionInput = {
  rawText: string;
  context?: ContextBundle;
};

export type SuggestionParser = {
  parse(input: ParseSuggestionInput): Promise<SuggestionResult>;
};

export type ParserName = "stub" | "llm";

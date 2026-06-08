import type { SuggestionResult } from "../schemas/suggestion.js";

export type ContextBundle = {
  snippets?: string[];
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

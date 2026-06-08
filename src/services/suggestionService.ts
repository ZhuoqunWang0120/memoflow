import { SuggestionResultSchema, type SuggestionResult } from "../schemas/suggestion.js";
import { createOpenAiSuggestionParser } from "../parsers/openAiSuggestionParser.js";
import { stubSuggestionParser } from "../parsers/stubSuggestionParser.js";
import type { ContextBundle, ParserName, SuggestionParser } from "../parsers/types.js";

export type CreateSuggestionsInput = {
  rawText: string;
  context?: ContextBundle;
};

export type CreateSuggestionsOptions = {
  parser?: ParserName;
  suggestionParser?: SuggestionParser;
};

export async function createSuggestionsFromDump(
  input: CreateSuggestionsInput,
  options: CreateSuggestionsOptions = {},
): Promise<SuggestionResult> {
  const rawText = input.rawText.trim();

  if (!rawText) {
    throw new Error("rawText is required.");
  }

  const parser = options.suggestionParser ?? getParser(options.parser ?? "stub");
  const result = await parser.parse({ rawText, context: input.context });

  return SuggestionResultSchema.parse(result);
}

function getParser(name: ParserName): SuggestionParser {
  switch (name) {
    case "stub":
      return stubSuggestionParser;
    case "llm":
      return createOpenAiSuggestionParser();
  }
}

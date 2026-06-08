import { SuggestionResultSchema, type SuggestionResult } from "../schemas/suggestion.js";
import { buildDumpToSuggestionsPrompt } from "../prompts/dumpToSuggestions.js";
import type { ParseSuggestionInput, SuggestionParser } from "./types.js";

type OpenAiParserOptions = {
  apiKey?: string;
  model?: string;
  endpoint?: string;
};

const suggestionResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          type: {
            type: "string",
            enum: ["task", "exploration", "idea", "reference", "clarify_needed"],
          },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          needs_clarification: { type: "boolean" },
          clarification_question: { type: "string" },
          missing_context: {
            type: "array",
            items: { type: "string" },
          },
          suggested_fields: {
            type: "object",
            additionalProperties: true,
            properties: {
              category: { type: ["string", "null"] },
              follow_up_needed: { type: ["boolean", "null"] },
              due_date: { type: ["string", "null"] },
              waiting_on: { type: ["string", "null"] },
              url: { type: ["string", "null"] },
              tags: {
                type: ["array", "null"],
                items: { type: "string" },
              },
            },
          },
        },
        required: ["type", "title", "status", "confidence", "needs_clarification"],
      },
    },
  },
  required: ["suggestions"],
};

export function createOpenAiSuggestionParser(options: OpenAiParserOptions = {}): SuggestionParser {
  return {
    async parse(input: ParseSuggestionInput): Promise<SuggestionResult> {
      const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required when parser=llm. Set it in your local environment.");
      }

      const endpoint = options.endpoint ?? "https://api.openai.com/v1/responses";
      const model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      const prompt = buildDumpToSuggestionsPrompt(input);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: prompt,
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "suggestion_result",
              schema: suggestionResultJsonSchema,
              strict: false,
            },
          },
        }),
      });

      if (!response.ok) {
        const message = await safeErrorMessage(response);
        throw new Error(`OpenAI request failed with status ${response.status}: ${message}`);
      }

      const payload = (await response.json()) as unknown;
      const outputText = extractOutputText(payload);
      const parsedJson = JSON.parse(outputText) as unknown;

      return SuggestionResultSchema.parse(parsedJson);
    },
  };
}

async function safeErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return response.statusText;

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? response.statusText;
  } catch {
    return text.slice(0, 500);
  }
}

function extractOutputText(payload: unknown): string {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (isRecord(payload) && Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (!isRecord(item) || !Array.isArray(item.content)) continue;

      for (const content of item.content) {
        if (isRecord(content) && typeof content.text === "string") {
          return content.text;
        }
      }
    }
  }

  throw new Error("OpenAI response did not include JSON output text.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

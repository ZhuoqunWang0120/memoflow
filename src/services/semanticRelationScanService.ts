import { z } from "zod";
import type { ContextBundle } from "../parsers/types.js";
import type { Item } from "../schemas/item.js";
import { RelatedExistingItemSchema, type RelatedExistingItem } from "../schemas/suggestion.js";

export type SemanticRelationScanInput = {
  rawText: string;
  context: ContextBundle;
};

export type SemanticRelationScanner = {
  scan(input: SemanticRelationScanInput): Promise<RelatedExistingItem[]>;
};

type OpenAiSemanticRelationScannerOptions = {
  apiKey?: string;
  model?: string;
  endpoint?: string;
};

const SemanticRelationScanResultSchema = z.object({
  related_existing_items: z.array(RelatedExistingItemSchema).default([]),
});

const semanticRelationScanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    related_existing_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item_id: { type: "string" },
          relationship: {
            type: "string",
            enum: ["possible_duplicate", "follow_up", "same_topic"],
          },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["item_id", "relationship", "reason", "confidence"],
      },
    },
  },
  required: ["related_existing_items"],
};

export function createOpenAiSemanticRelationScanner(
  options: OpenAiSemanticRelationScannerOptions = {},
): SemanticRelationScanner {
  return {
    async scan(input: SemanticRelationScanInput): Promise<RelatedExistingItem[]> {
      const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required for semantic relation scan.");
      }

      const endpoint = options.endpoint ?? "https://api.openai.com/v1/responses";
      const model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      const prompt = buildSemanticRelationScanPrompt(input);

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
              name: "semantic_relation_scan_result",
              schema: semanticRelationScanJsonSchema,
              strict: false,
            },
          },
        }),
      });

      if (!response.ok) {
        const message = await safeErrorMessage(response);
        throw new Error(`OpenAI semantic relation scan failed with status ${response.status}: ${message}`);
      }

      const payload = (await response.json()) as unknown;
      const outputText = extractOutputText(payload);
      const parsedJson = JSON.parse(outputText) as unknown;

      return SemanticRelationScanResultSchema.parse(parsedJson).related_existing_items;
    },
  };
}

export function buildSemanticRelationScanPrompt(input: SemanticRelationScanInput): string {
  const memory = input.context.suggestionContext?.memoryEntries.map((entry) => entry.text.trim()).filter(Boolean) ?? [];
  const items = input.context.suggestionContext?.semanticScanItems.slice(0, 100) ?? [];

  return `Compare the raw memo against existing semantic scan items.

Return JSON only with related_existing_items.
Use meaning, paraphrase, translation, aliases from memory, and common sense.
Do not require exact keyword overlap.
Only reference item IDs shown in Semantic scan items.
Existing items are context only. Do not edit, merge, update, or archive anything.
If no item is meaningfully related, return an empty array.

Relationship meanings:
- possible_duplicate: the raw memo appears to duplicate or restate an existing item.
- follow_up: the raw memo appears to be a next step, reminder, detail, or status update for an existing item.
- same_topic: the raw memo is related but likely still deserves a separate item.

Examples:

Raw memo:
星露谷mod
Semantic scan items:
- [itm_stardew] exploration | open | Explore Stardew Valley mod
Output:
{"related_existing_items":[{"item_id":"itm_stardew","relationship":"same_topic","reason":"星露谷 refers to Stardew Valley, and both concern Stardew Valley mods.","confidence":0.82}]}

Raw memo:
Safeway pick up lexapro
Semantic scan items:
- [itm_medicine] task | ready | Pick up medicine
Output:
{"related_existing_items":[{"item_id":"itm_medicine","relationship":"follow_up","reason":"Lexapro is medicine, and the raw memo adds pharmacy-specific pickup detail.","confidence":0.78}]}

Raw memo:
LinkedIn jobs
Semantic scan items:
- [itm_linkedin] task | ready | Evaluate Netflix job application on LinkedIn
Output:
{"related_existing_items":[{"item_id":"itm_linkedin","relationship":"same_topic","reason":"Both are about LinkedIn job-search activity.","confidence":0.7}]}

${memory.length > 0 ? `User memory:\n${memory.map((entry) => `- ${entry}`).join("\n")}\n` : ""}
Raw memo:
${input.rawText}

Semantic scan items:
${items.map(formatScanItem).join("\n")}`;
}

function formatScanItem(item: Item): string {
  const description = formatShortDescription(item.description);
  return `- [${item.id}] ${item.type} | ${item.status} | ${item.title}${description}`;
}

function formatShortDescription(description: string | undefined): string {
  if (!description) return "";

  const compact = description.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length > 140) return "";

  return ` — ${compact}`;
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

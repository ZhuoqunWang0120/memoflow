import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { buildDumpToSuggestionsPrompt } from "../prompts/dumpToSuggestions.js";
import type { SuggestionResult } from "../schemas/suggestion.js";
import { SuggestionResultSchema } from "../schemas/suggestion.js";
import type { Item } from "../schemas/item.js";
import { add as addItem, archive as archiveItem, update as updateItem } from "../services/itemStoreService.js";
import { addMemory, archiveMemory } from "../services/memoryStoreService.js";
import { buildSemanticRelationScanPrompt, type SemanticRelationScanner } from "../services/semanticRelationScanService.js";
import { buildSuggestionContext } from "../services/suggestionContextService.js";
import { createSuggestionsFromDump } from "../services/suggestionService.js";
import type { SuggestionParser } from "../parsers/types.js";

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

const tempDir = await mkdtemp(join(tmpdir(), "memoflow-context-eval-"));
const itemStorePath = join(tempDir, "items.jsonl");
const memoryStorePath = join(tempDir, "memory.jsonl");

const tests: TestCase[] = [
  {
    name: "includes all active memory when <= 20 and excludes archived",
    run: async () => {
      await addMemory("Kiersten is my Duke DSO contact", { storePath: memoryStorePath });
      const archived = await addMemory("Archived memory", { storePath: memoryStorePath });
      await archiveMemory(archived.id, { storePath: memoryStorePath });

      const context = await buildSuggestionContext("email Kiersten", { itemStorePath, memoryStorePath });
      expect(context.memoryEntries.length === 1, "Expected one active memory entry");
      expect(context.memoryEntries[0]?.text.includes("Kiersten"), "Expected active memory text");
    },
  },
  {
    name: "caps active memory at 20",
    run: async () => {
      for (let index = 0; index < 25; index += 1) {
        await addMemory(`memory ${index}`, { storePath: memoryStorePath });
      }

      const context = await buildSuggestionContext("memo", { itemStorePath, memoryStorePath });
      expect(context.memoryEntries.length === 20, "Expected active memory cap of 20");
    },
  },
  {
    name: "includes recent 20 active items and excludes done/archived",
    run: async () => {
      for (let index = 0; index < 22; index += 1) {
        await addItem({ type: "task", title: `Active task ${index}`, status: "ready" }, { storePath: itemStorePath });
      }
      const done = await addItem({ type: "task", title: "Done task", status: "done" }, { storePath: itemStorePath });
      const archived = await addItem({ type: "task", title: "Archived task", status: "ready" }, { storePath: itemStorePath });
      await archiveItem(archived.id, { storePath: itemStorePath });

      const context = await buildSuggestionContext("active task", { itemStorePath, memoryStorePath });
      expect(context.recentActiveItems.length <= 20, "Expected recent active item cap of 20");
      expect(!context.recentActiveItems.some((item) => item.id === done.id), "Expected done item excluded");
      expect(!context.recentActiveItems.some((item) => item.id === archived.id), "Expected archived item excluded");
    },
  },
  {
    name: "keyword match is case-insensitive and excluded from recent items",
    run: async () => {
      const oldItems = [];
      for (let index = 0; index < 6; index += 1) {
        oldItems.push(await addItem({
          type: "task",
          title: `NVIDIA recruiter follow up ${index}`,
          description: "Recruiter outreach",
          status: "ready",
        }, { storePath: itemStorePath }));
      }

      for (const item of oldItems) {
        await updateItem(item.id, { status: "waiting" }, { storePath: itemStorePath });
      }
      for (let index = 0; index < 25; index += 1) {
        await addItem({ type: "idea", title: `Fresh unrelated idea ${index}`, status: "saved" }, { storePath: itemStorePath });
      }

      const context = await buildSuggestionContext("nvidia RECRUITER", { itemStorePath, memoryStorePath });
      expect(context.keywordMatchedItems.length === 5, "Expected top 5 keyword matches");
      expect(context.keywordMatchedItems.every((item) => /nvidia/i.test(item.title)), "Expected case-insensitive matching");
      const recentIds = new Set(context.recentActiveItems.map((item) => item.id));
      expect(context.keywordMatchedItems.every((item) => !recentIds.has(item.id)), "Expected keyword matches excluded from recent");
    },
  },
  {
    name: "semantic scan orders keyword matches, recent active items, then older active items",
    run: async () => {
      const storePath = join(tempDir, "semantic-order-items.jsonl");
      const keyword = itemFixture("itm_semantic_keyword", "Needle exact match", {
        updated_at: "2026-01-01T00:00:00.000Z",
      });
      const activeItems = Array.from({ length: 22 }, (_, index) =>
        itemFixture(`itm_semantic_active_${String(index).padStart(2, "0")}`, `Unrelated active ${index}`, {
          updated_at: `2026-02-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        }),
      );

      await writeItemsForTest([keyword, ...activeItems], storePath);

      const context = await buildSuggestionContext("needle", { itemStorePath: storePath, memoryStorePath });
      expect(context.semanticScanItems[0]?.id === keyword.id, "Expected keyword match first in semantic scan");
      expect(context.semanticScanItems[1]?.id === "itm_semantic_active_21", "Expected newest recent item after keyword match");
      expect(context.semanticScanItems[20]?.id === "itm_semantic_active_02", "Expected twentieth recent item before older items");
      expect(context.semanticScanItems[21]?.id === "itm_semantic_active_01", "Expected older active item after recent cap");
      expect(context.semanticScanItems[22]?.id === "itm_semantic_active_00", "Expected oldest active item last");
    },
  },
  {
    name: "semantic scan dedupes IDs, caps at 100, and excludes done and archived items",
    run: async () => {
      const storePath = join(tempDir, "semantic-cap-items.jsonl");
      const activeItems = Array.from({ length: 105 }, (_, index) =>
        itemFixture(`itm_semantic_cap_${String(index).padStart(3, "0")}`, `Cap active ${index}`, {
          updated_at: `2026-03-${String((index % 28) + 1).padStart(2, "0")}T00:${String(index).padStart(2, "0")}.000Z`,
        }),
      );
      const done = itemFixture("itm_semantic_done", "Cap done", { status: "done" });
      const archived = itemFixture("itm_semantic_archived", "Cap archived", { archived_at: "2026-03-01T00:00:00.000Z" });

      await writeItemsForTest([...activeItems, done, archived], storePath);

      const context = await buildSuggestionContext("cap active", { itemStorePath: storePath, memoryStorePath });
      const scanIds = context.semanticScanItems.map((item) => item.id);
      expect(context.semanticScanItems.length === 100, "Expected semantic scan cap of 100");
      expect(new Set(scanIds).size === scanIds.length, "Expected semantic scan IDs deduped");
      expect(!scanIds.includes(done.id), "Expected done item excluded from semantic scan");
      expect(!scanIds.includes(archived.id), "Expected archived item excluded from semantic scan");
      expect(context.semanticScanItems.every((item) => item.status !== "done" && !item.archived_at), "Expected active items included only");
    },
  },
  {
    name: "deterministic fallback marks Minimax MemoFlow duplicate",
    run: async () => {
      const item = await addItem({
        type: "task",
        title: "Use Minimax API In Memoflow",
        status: "ready",
      }, { storePath: itemStorePath });
      const context = await buildSuggestionContext("Memoflow try minimax api", { itemStorePath, memoryStorePath });
      const parser: SuggestionParser = {
        async parse(): Promise<SuggestionResult> {
          return {
            suggestions: [
              {
                type: "task",
                title: "Try Minimax API in MemoFlow",
                status: "ready",
                confidence: 0.9,
                needs_clarification: false,
                suggested_fields: {},
              },
            ],
          };
        },
      };

      const result = await createSuggestionsFromDump(
        { rawText: "Memoflow try minimax api", context: { suggestionContext: context } },
        { suggestionParser: parser },
      );

      const related = result.suggestions[0]?.related_existing_items?.[0];
      expect(context.keywordMatchedItems.some((candidate) => candidate.id === item.id), "Expected item in keyword matches");
      expect(related?.item_id === item.id, "Expected deterministic duplicate relation to item");
      expect(related?.relationship === "possible_duplicate", "Expected possible_duplicate relation");
    },
  },
  {
    name: "prompt includes context sections and item IDs",
    run: async () => {
      const item = await addItem({ type: "task", title: "Email Duke about final eval", status: "ready" }, { storePath: itemStorePath });
      const context = await buildSuggestionContext("email Duke", { itemStorePath, memoryStorePath });
      const prompt = buildDumpToSuggestionsPrompt({ rawText: "email Duke", context: { suggestionContext: context } });

      expect(prompt.includes("User memory:"), "Expected memory section");
      expect(prompt.includes("Recent active items:"), "Expected recent item section");
      expect(prompt.includes("Semantic scan items:"), "Expected semantic scan section");
      expect(prompt.includes(item.id), "Expected context item ID in prompt");
      expect(prompt.includes("Do not invent item IDs"), "Expected item ID rule");
      expect(prompt.includes("related_existing_items"), "Expected related output schema");
    },
  },
  {
    name: "prompt omits context when context is not provided",
    run: async () => {
      const prompt = buildDumpToSuggestionsPrompt({ rawText: "email Duke" });
      expect(!prompt.includes("Recent active items:"), "Expected no item context without context");
      expect(!prompt.includes("Keyword-matched existing items:"), "Expected no keyword context without context");
      expect(!prompt.includes("Semantic scan items:"), "Expected no semantic scan context without context");
    },
  },
  {
    name: "schema parses related_existing_items",
    run: async () => {
      SuggestionResultSchema.parse({
        suggestions: [
          {
            type: "task",
            title: "Email Duke",
            status: "ready",
            confidence: 0.9,
            needs_clarification: false,
            suggested_fields: {},
            related_existing_items: [
              {
                item_id: "itm_123",
                relationship: "possible_duplicate",
                reason: "Both mention emailing Duke.",
                confidence: 0.8,
              },
            ],
          },
        ],
      });
    },
  },
  {
    name: "invalid related item IDs are safely ignored",
    run: async () => {
      const item = await addItem({ type: "task", title: "Email Duke uniquevisa", status: "ready" }, { storePath: itemStorePath });
      const context = await buildSuggestionContext("email Duke uniquevisa", { itemStorePath, memoryStorePath });
      const parser: SuggestionParser = {
        async parse(): Promise<SuggestionResult> {
          return {
            suggestions: [
              {
                type: "task",
                title: "Email Duke",
                status: "ready",
                confidence: 0.9,
                needs_clarification: false,
                suggested_fields: {},
                related_existing_items: [
                  { item_id: item.id, relationship: "possible_duplicate", reason: "same", confidence: 0.9 },
                  { item_id: "itm_fake", relationship: "possible_duplicate", reason: "fake", confidence: 0.9 },
                ],
              },
            ],
          };
        },
      };

      const result = await createSuggestionsFromDump(
        { rawText: "email Duke uniquevisa", context: { suggestionContext: context } },
        { suggestionParser: parser },
      );

      const relatedIds = result.suggestions[0]?.related_existing_items?.map((related) => related.item_id) ?? [];
      expect(!relatedIds.includes("itm_fake"), "Expected invalid related ID filtered");
      expect(relatedIds.includes(item.id), "Expected valid related ID kept");
    },
  },
  {
    name: "valid related item IDs from semantic scan are kept",
    run: async () => {
      const storePath = join(tempDir, "semantic-related-items.jsonl");
      const semanticOnly = itemFixture("itm_semantic_only", "Collect prescription", {
        updated_at: "2026-01-01T00:00:00.000Z",
      });
      const newerItems = Array.from({ length: 25 }, (_, index) =>
        itemFixture(`itm_semantic_newer_${String(index).padStart(2, "0")}`, `Newer unrelated ${index}`, {
          updated_at: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        }),
      );

      await writeItemsForTest([semanticOnly, ...newerItems], storePath);
      const context = await buildSuggestionContext("Safeway pick up lexapro", { itemStorePath: storePath, memoryStorePath });
      const parser: SuggestionParser = {
        async parse(): Promise<SuggestionResult> {
          return {
            suggestions: [
              {
                type: "task",
                title: "Pick up Lexapro at Safeway",
                status: "ready",
                confidence: 0.9,
                needs_clarification: false,
                suggested_fields: {},
                related_existing_items: [
                  { item_id: semanticOnly.id, relationship: "follow_up", reason: "Medication pickup follow-up.", confidence: 0.75 },
                ],
              },
            ],
          };
        },
      };

      expect(!context.keywordMatchedItems.some((item) => item.id === semanticOnly.id), "Expected semantic-only item outside keyword matches");
      expect(!context.recentActiveItems.some((item) => item.id === semanticOnly.id), "Expected semantic-only item outside recent items");
      expect(context.semanticScanItems.some((item) => item.id === semanticOnly.id), "Expected semantic-only item in scan");

      const result = await createSuggestionsFromDump(
        { rawText: "Safeway pick up lexapro", context: { suggestionContext: context } },
        { suggestionParser: parser },
      );
      const relatedIds = result.suggestions[0]?.related_existing_items?.map((related) => related.item_id) ?? [];
      expect(relatedIds.includes(semanticOnly.id), "Expected semantic scan related ID kept");
    },
  },
  {
    name: "semantic relation scan prompt includes few-shot examples and scan items",
    run: async () => {
      const item = itemFixture("itm_scan_prompt", "Explore Stardew Valley mod");
      const prompt = buildSemanticRelationScanPrompt({
        rawText: "星露谷mod",
        context: {
          suggestionContext: {
            memoryEntries: [],
            keywordMatchedItems: [],
            recentActiveItems: [],
            semanticScanItems: [item],
          },
        },
      });

      expect(prompt.includes("星露谷mod"), "Expected Stardew few-shot/raw text in scan prompt");
      expect(prompt.includes("Safeway pick up lexapro"), "Expected medicine few-shot in scan prompt");
      expect(prompt.includes("LinkedIn jobs"), "Expected LinkedIn few-shot in scan prompt");
      expect(prompt.includes(item.id), "Expected real semantic scan item ID in prompt");
    },
  },
  {
    name: "semantic relation scanner merges valid relations into single suggestion",
    run: async () => {
      const item = await addItem({ type: "task", title: "Pick up medicine", status: "ready" }, { storePath: itemStorePath });
      const context = await buildSuggestionContext("Safeway pick up lexapro", { itemStorePath, memoryStorePath });
      const parser: SuggestionParser = {
        async parse(): Promise<SuggestionResult> {
          return {
            suggestions: [
              {
                type: "task",
                title: "Pick up Lexapro from Safeway",
                status: "ready",
                confidence: 0.9,
                needs_clarification: false,
                suggested_fields: {},
              },
            ],
          };
        },
      };
      const scanner: SemanticRelationScanner = {
        async scan() {
          return [
            { item_id: item.id, relationship: "follow_up", reason: "Specific prescription pickup.", confidence: 0.8 },
            { item_id: "itm_fake_scan", relationship: "same_topic", reason: "Invented.", confidence: 0.8 },
          ];
        },
      };

      const result = await createSuggestionsFromDump(
        { rawText: "Safeway pick up lexapro", context: { suggestionContext: context } },
        { suggestionParser: parser, semanticRelationScanner: scanner },
      );
      const related = result.suggestions[0]?.related_existing_items ?? [];

      expect(related.some((candidate) => candidate.item_id === item.id && candidate.relationship === "follow_up"), "Expected scanner relation merged");
      expect(!related.some((candidate) => candidate.item_id === "itm_fake_scan"), "Expected invented scanner relation filtered");
    },
  },
  {
    name: "semantic relation scanner does not merge into multi-suggestion result",
    run: async () => {
      const item = await addItem({ type: "task", title: "Explore Stardew Valley mod", status: "ready" }, { storePath: itemStorePath });
      const context = await buildSuggestionContext("星露谷mod and buy milk", { itemStorePath, memoryStorePath });
      const parser: SuggestionParser = {
        async parse(): Promise<SuggestionResult> {
          return {
            suggestions: [
              {
                type: "idea",
                title: "Explore Stardew Valley mod",
                status: "saved",
                confidence: 0.8,
                needs_clarification: false,
                suggested_fields: {},
              },
              {
                type: "task",
                title: "Buy milk",
                status: "ready",
                confidence: 0.9,
                needs_clarification: false,
                suggested_fields: {},
              },
            ],
          };
        },
      };
      const scanner: SemanticRelationScanner = {
        async scan() {
          return [
            { item_id: item.id, relationship: "same_topic", reason: "Both concern Stardew mods.", confidence: 0.82 },
          ];
        },
      };

      const result = await createSuggestionsFromDump(
        { rawText: "星露谷mod and buy milk", context: { suggestionContext: context } },
        { suggestionParser: parser, semanticRelationScanner: scanner },
      );

      expect(result.suggestions.every((suggestion) => !suggestion.related_existing_items?.length), "Expected no ambiguous multi-suggestion relation merge");
    },
  },
];

let passed = 0;

try {
  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`${test.name} PASS`);
    } catch (error) {
      console.log(`${test.name} FAIL`);
      console.log(`  ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("");
console.log("Summary:");
console.log(`${passed}/${tests.length} passed`);

if (passed !== tests.length) {
  process.exitCode = 1;
}

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function itemFixture(id: string, title: string, patch: Partial<Item> = {}): Item {
  return {
    id,
    type: "task",
    title,
    status: "ready",
    fields: {},
    source: { kind: "manual" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...patch,
  };
}

async function writeItemsForTest(items: Item[], storePath: string): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${items.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
}

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildDumpToSuggestionsPrompt } from "../prompts/dumpToSuggestions.js";
import {
  addMemory,
  archiveMemory,
  deleteMemory,
  getActiveMemory,
  listMemory,
  updateMemory,
} from "../services/memoryStoreService.js";
import { createSuggestionsFromDump } from "../services/suggestionService.js";
import type { SuggestionParser } from "../parsers/types.js";

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

const tempDir = await mkdtemp(join(tmpdir(), "memoflow-memory-eval-"));
const storePath = join(tempDir, "memory.jsonl");

const tests: TestCase[] = [
  {
    name: "adding a memory entry trims text",
    run: async () => {
      const entry = await addMemory("  Kiersten is my Duke DSO contact.  ", { storePath });
      expect(entry.id.startsWith("mem_"), "Expected memory id to use mem_ prefix");
      expect(entry.text === "Kiersten is my Duke DSO contact.", "Expected text to be trimmed");
    },
  },
  {
    name: "rejecting empty memory",
    run: async () => {
      await expectRejects(() => addMemory("   ", { storePath }), "Memory text is required");
    },
  },
  {
    name: "listing active memory hides archived by default",
    run: async () => {
      const active = await addMemory("agentic app project means support agent project", { storePath });
      const archived = await addMemory("Archived memory", { storePath });
      await archiveMemory(archived.id, { storePath });

      const entries = await listMemory({ storePath });
      expect(entries.some((entry) => entry.id === active.id), "Expected active memory in default list");
      expect(!entries.some((entry) => entry.id === archived.id), "Expected archived memory hidden by default");
    },
  },
  {
    name: "listing can include archived memory",
    run: async () => {
      const entries = await listMemory({ storePath, includeArchived: true });
      expect(entries.some((entry) => entry.archived_at), "Expected archived memory when includeArchived=true");
    },
  },
  {
    name: "updating memory text updates updated_at",
    run: async () => {
      const entry = await addMemory("shift means hospital shift", { storePath });
      const updated = await updateMemory(entry.id, { text: "shift means my hospital shift" }, { storePath });
      expect(updated.text === "shift means my hospital shift", "Expected updated memory text");
      expect(updated.updated_at >= entry.updated_at, "Expected updated_at to advance or stay ISO-ordered");
    },
  },
  {
    name: "archiving memory sets archived_at",
    run: async () => {
      const entry = await addMemory("Fragomen handles my H-1B case", { storePath });
      const archived = await archiveMemory(entry.id, { storePath });
      expect(Boolean(archived.archived_at), "Expected archived_at after archive");
    },
  },
  {
    name: "deleting memory removes it",
    run: async () => {
      const entry = await addMemory("delete me", { storePath });
      await deleteMemory(entry.id, { storePath });
      const entries = await listMemory({ storePath, includeArchived: true });
      expect(!entries.some((candidate) => candidate.id === entry.id), "Expected deleted memory to be removed");
    },
  },
  {
    name: "active memory helper excludes archived and caps newest entries",
    run: async () => {
      const keep = await addMemory("Newest active memory", { storePath });
      const archived = await addMemory("Inactive memory", { storePath });
      await archiveMemory(archived.id, { storePath });

      const active = await getActiveMemory({ storePath, limit: 1 });
      expect(active.length === 1, "Expected one active memory entry");
      expect(active[0]?.id === keep.id, "Expected newest non-archived memory");
    },
  },
  {
    name: "prompt includes memory only when context snippets are provided",
    run: async () => {
      const withoutMemory = buildDumpToSuggestionsPrompt({ rawText: "email Kiersten" });
      const withMemory = buildDumpToSuggestionsPrompt({
        rawText: "email Kiersten",
        context: { snippets: ["Kiersten is my Duke DSO contact."] },
      });

      expect(!withoutMemory.includes("User memory:"), "Expected no memory section without context");
      expect(withMemory.includes("User memory:"), "Expected memory section with snippets");
      expect(withMemory.includes("Kiersten is my Duke DSO contact."), "Expected memory snippet in prompt");
      expect(withMemory.includes("raw memo wins"), "Expected prompt to preserve raw memo priority");
    },
  },
  {
    name: "suggestion generation works when no memory file exists",
    run: async () => {
      const result = await createSuggestionsFromDump({ rawText: "portfolio website" }, { parser: "stub" });
      expect(result.suggestions.length > 0, "Expected suggestions without memory store");
    },
  },
  {
    name: "suggestion service passes context only when caller provides it",
    run: async () => {
      const seenContexts: unknown[] = [];
      const parser: SuggestionParser = {
        async parse(input) {
          seenContexts.push(input.context);
          return {
            suggestions: [
              {
                type: "idea",
                title: "Portfolio website",
                status: "saved",
                confidence: 0.8,
                needs_clarification: false,
                suggested_fields: {},
              },
            ],
          };
        },
      };

      await createSuggestionsFromDump({ rawText: "portfolio website" }, { suggestionParser: parser });
      await createSuggestionsFromDump(
        { rawText: "email Kiersten", context: { snippets: ["Kiersten is my Duke DSO contact."] } },
        { suggestionParser: parser },
      );

      expect(seenContexts[0] === undefined, "Expected no context when not provided");
      expect(
        JSON.stringify(seenContexts[1]) === JSON.stringify({ snippets: ["Kiersten is my Duke DSO contact."] }),
        "Expected provided context to pass to parser",
      );
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

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function expectRejects(fn: () => Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedMessage)) {
      throw new Error(`Expected error containing "${expectedMessage}", actual "${message}"`);
    }
    return;
  }

  throw new Error("Expected function to reject");
}

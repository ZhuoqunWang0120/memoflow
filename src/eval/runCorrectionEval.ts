import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { changedFieldsBetweenSnapshots, listCorrectionEvents } from "../services/correctionEventService.js";
import type { CorrectionSnapshot } from "../schemas/correctionEvent.js";
import { saveReviewedSuggestion } from "../services/reviewedSuggestionSaveService.js";
import type { Suggestion } from "../schemas/suggestion.js";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const baseSuggestion: Suggestion = {
  type: "task",
  title: "Email Duke",
  description: "Ask about final evaluation",
  status: "ready",
  confidence: 0.9,
  needs_clarification: false,
  missing_context: [],
  suggested_fields: {
    due_date: "2026-07-10",
    waiting_on: "Duke",
    tags: ["school"],
  },
  related_existing_items: [],
};

const tests: TestCase[] = [
  {
    name: "no correction event is logged when saved item matches baseline proposal",
    run: async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "memoflow-correction-eval-"));
      try {
        const itemStorePath = join(tempDir, "items.jsonl");
        const correctionStorePath = join(tempDir, "correction_events.jsonl");

        const result = await saveReviewedSuggestion(
          {
            rawText: "email Duke",
            suggestion: baseSuggestion,
            reviewContext: {
              source: "pending_review",
              proposalId: "dump_1:suggestion:0",
              dumpId: "dump_1",
            },
          },
          {
            itemStore: { storePath: itemStorePath },
            correctionStore: { storePath: correctionStorePath },
          },
        );

        expect(result.correctionLogged === false, "Expected no correction event");
        const events = await listCorrectionEvents({ storePath: correctionStorePath });
        expect(events.length === 0, "Expected empty correction log");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  },
  {
    name: "correction event is logged with changed fields when saved item differs meaningfully",
    run: async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "memoflow-correction-eval-"));
      try {
        const itemStorePath = join(tempDir, "items.jsonl");
        const correctionStorePath = join(tempDir, "correction_events.jsonl");

        const result = await saveReviewedSuggestion(
          {
            rawText: "email Duke",
            suggestion: baseSuggestion,
            overrides: {
              title: "Email Duke DSO",
              description: "Ask about final evaluation and visa paperwork",
              fields: {
                due_date: "2026-07-12",
                tags: ["school", "visa"],
              },
            },
            reviewContext: {
              source: "pending_review",
              proposalId: "dump_1:suggestion:0",
              dumpId: "dump_1",
            },
          },
          {
            itemStore: { storePath: itemStorePath },
            correctionStore: { storePath: correctionStorePath },
          },
        );

        expect(result.correctionLogged === true, "Expected correction event");
        const events = await listCorrectionEvents({ storePath: correctionStorePath });
        expect(events.length === 1, "Expected one correction event");
        const event = events[0];
        expect(Boolean(event), "Expected event");
        const changedFields = event?.changed_fields ?? [];
        expect(event?.source === "pending_review", "Expected pending_review source");
        expect(event?.proposal_id === "dump_1:suggestion:0", "Expected proposal id");
        expect(event?.dump_id === "dump_1", "Expected dump id");
        expect(event?.saved_item_id === result.item.id, "Expected saved item id");
        expect(event?.learning_status === "unreviewed", "Expected unreviewed status");
        expect(event?.before.title === "Email Duke", "Expected before snapshot");
        expect(event?.after.title === "Email Duke DSO", "Expected after snapshot");
        expect(changedFields.includes("title"), "Expected title change");
        expect(changedFields.includes("description"), "Expected description change");
        expect(changedFields.includes("fields.due_date"), "Expected due_date change");
        expect(changedFields.includes("fields.tags"), "Expected tags change");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  },
  {
    name: "needs-clarification proposals can still produce a correction event after edits",
    run: async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "memoflow-correction-eval-"));
      try {
        const itemStorePath = join(tempDir, "items.jsonl");
        const correctionStorePath = join(tempDir, "correction_events.jsonl");

        const clarifySuggestion: Suggestion = {
          ...baseSuggestion,
          type: "reference",
          title: "Email someone",
          status: "needs_clarification",
          needs_clarification: true,
        };

        const result = await saveReviewedSuggestion(
          {
            rawText: "email Duke about visa",
            suggestion: clarifySuggestion,
            overrides: {
              type: "task",
              title: "Email Duke about visa",
              status: "ready",
            },
            reviewContext: {
              source: "suggestion_review",
              proposalId: "suggestion:0",
            },
          },
          {
            itemStore: { storePath: itemStorePath },
            correctionStore: { storePath: correctionStorePath },
          },
        );

        expect(result.correctionLogged === true, "Expected correction event for needs_clarification suggestion");
        const [event] = await listCorrectionEvents({ storePath: correctionStorePath });
        expect(Boolean(event), "Expected event");
        const changedFields = event?.changed_fields ?? [];
        expect(event?.before.type === "reference", "Expected normalized before snapshot type");
        expect(event?.after.type === "task", "Expected task after snapshot");
        expect(changedFields.includes("type"), "Expected type change");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  },
  {
    name: "needs-clarification proposals keep clarify status until the reviewer changes it",
    run: async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "memoflow-correction-eval-"));
      try {
        const itemStorePath = join(tempDir, "items.jsonl");
        const correctionStorePath = join(tempDir, "correction_events.jsonl");

        const clarifySuggestion: Suggestion = {
          ...baseSuggestion,
          type: "reference",
          title: "Email someone",
          status: "needs_clarification",
          needs_clarification: true,
        };

        const result = await saveReviewedSuggestion(
          {
            rawText: "email Duke about visa",
            suggestion: clarifySuggestion,
            overrides: {
              type: "task",
              title: "Email Duke about visa",
              status: "needs_clarification",
            },
            reviewContext: {
              source: "suggestion_review",
              proposalId: "suggestion:1",
            },
          },
          {
            itemStore: { storePath: itemStorePath },
            correctionStore: { storePath: correctionStorePath },
          },
        );

        expect(result.item.status === "needs_clarification", "Expected unresolved needs_clarification status to persist");
        const [event] = await listCorrectionEvents({ storePath: correctionStorePath });
        expect(event?.after.status === "needs_clarification", "Expected correction event after snapshot to preserve clarify status");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  },
  {
    name: "snapshot diff helper only marks meaningful item-field changes",
    run: () => {
      const before: CorrectionSnapshot = {
        type: "task",
        title: "Email Duke",
        description: undefined,
        status: "ready",
        fields: { due_date: "2026-07-10", waiting_on: "Duke" },
      };
      const after: CorrectionSnapshot = {
        type: "task",
        title: "Email Duke",
        description: undefined,
        status: "ready",
        fields: { due_date: "2026-07-12", waiting_on: "Duke" },
      };

      const changed = changedFieldsBetweenSnapshots(before, after);
      expect(changed.length === 1, "Expected one changed field");
      expect(changed[0] === "fields.due_date", "Expected due_date field path");
    },
  },
];

let passed = 0;

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

console.log("");
console.log("Summary:");
console.log(`${passed}/${tests.length} passed`);

if (passed !== tests.length) {
  process.exitCode = 1;
}

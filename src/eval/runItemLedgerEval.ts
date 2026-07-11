import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getVisibleItems } from "../services/itemLedgerQuery.js";
import type { Item } from "../schemas/item.js";
import { add, archive, get, unarchive, update } from "../services/itemStoreService.js";
import { itemUpdatePatchFromRequest, UpdateItemRequestSchema } from "../services/itemUpdatePatch.js";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const items: Item[] = [
  item({
    id: "a",
    type: "task",
    title: "Email Duke",
    description: "Ask about final evaluation",
    status: "ready",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-04T00:00:00.000Z",
    fields: { due_date: "2026-06-12", follow_up_date: "2026-06-20" },
  }),
  item({
    id: "b",
    type: "idea",
    title: "Portfolio website",
    description: "Career asset",
    status: "saved",
    created_at: "2026-06-02T00:00:00.000Z",
    updated_at: "2026-06-03T00:00:00.000Z",
    fields: {},
  }),
  item({
    id: "c",
    type: "task",
    title: "Buy groceries",
    description: "Safeway run",
    status: "waiting",
    created_at: "2026-06-03T00:00:00.000Z",
    updated_at: "2026-06-05T00:00:00.000Z",
    fields: { due_date: "2026-06-10", follow_up_date: "2026-06-11" },
  }),
  item({
    id: "d",
    type: "reference",
    title: "Meta resources",
    description: "Alumni portal",
    status: "archived",
    created_at: "2026-06-04T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    archived_at: "2026-06-07T00:00:00.000Z",
    fields: { due_date: "2026-06-09" },
  }),
];

const tests: TestCase[] = [
  {
    name: "default list hides archived items",
    run: () => expectIds(getVisibleItems(items), ["c", "a", "b"]),
  },
  {
    name: "type filter works",
    run: () => expectIds(getVisibleItems(items, { filters: { type: "task" } }), ["c", "a"]),
  },
  {
    name: "status filter works",
    run: () => expectIds(getVisibleItems(items, { filters: { status: "saved" } }), ["b"]),
  },
  {
    name: "type and status filters combine",
    run: () => expectIds(getVisibleItems(items, { filters: { type: "task", status: "waiting" } }), ["c"]),
  },
  {
    name: "search matches title case-insensitively",
    run: () => expectIds(getVisibleItems(items, { query: "portfolio" }), ["b"]),
  },
  {
    name: "search matches description case-insensitively",
    run: () => expectIds(getVisibleItems(items, { query: "SAFEWAY" }), ["c"]),
  },
  {
    name: "date sort puts missing dates last",
    run: () => expectIds(getVisibleItems(items, { sort: "due_date_asc" }), ["c", "a", "b"]),
  },
  {
    name: "due date soonest sort works",
    run: () => expectIds(getVisibleItems(items, { sort: "due_date_asc", filters: { archived: "show" } }), ["d", "c", "a", "b"]),
  },
  {
    name: "follow-up date soonest sort works",
    run: () => expectIds(getVisibleItems(items, { sort: "follow_up_date_asc" }), ["c", "a", "b"]),
  },
  {
    name: "archived visibility modes work",
    run: () => {
      expectIds(getVisibleItems(items, { filters: { archived: "show" } }), ["d", "c", "a", "b"]);
      expectIds(getVisibleItems(items, { filters: { archived: "only" } }), ["d"]);
    },
  },
  {
    name: "updateItem updates allowed fields and preserves non-updated fields",
    run: async () => {
      const storePath = await tempStorePath();
      const created = await add({
        type: "task",
        title: "Original title",
        description: "Original description",
        status: "ready",
        fields: { due_date: "2026-06-12", follow_up_date: "2026-06-20", category: "admin" },
      }, { storePath });

      const updated = await update(created.id, {
        title: " Updated title ",
        description: " Updated description ",
        type: "idea",
        status: "saved",
        fields: { due_date: "2026-06-13", follow_up_date: null },
      }, { storePath });

      expect(updated.id === created.id, "Expected id preserved");
      expect(updated.created_at === created.created_at, "Expected created_at preserved");
      expect(updated.title === "Updated title", "Expected trimmed title update");
      expect(updated.description === "Updated description", "Expected trimmed description update");
      expect(updated.type === "idea", "Expected type update");
      expect(updated.status === "saved", "Expected status update");
      expect(updated.fields.due_date === "2026-06-13", "Expected due_date update");
      expect(updated.fields.follow_up_date === null, "Expected follow_up_date update");
      expect(updated.fields.category === "admin", "Expected omitted field preserved");
    },
  },
  {
    name: "updateItem updates updated_at",
    run: async () => {
      const storePath = await tempStorePath();
      const created = await add({ type: "task", title: "Timestamp test", status: "ready" }, { storePath });
      await delay(5);
      const updated = await update(created.id, { title: "Timestamp test updated" }, { storePath });
      expect(updated.updated_at > created.updated_at, "Expected updated_at to increase");
    },
  },
  {
    name: "updateItem rejects missing item ID",
    run: async () => {
      const storePath = await tempStorePath();
      await expectRejects(() => update("itm_missing", { title: "Nope" }, { storePath }), "Item not found");
    },
  },
  {
    name: "updateItem rejects invalid type and empty title/status",
    run: async () => {
      const storePath = await tempStorePath();
      const created = await add({ type: "task", title: "Validation test", status: "ready" }, { storePath });
      await expectRejects(() => update(created.id, { type: "invalid" as never }, { storePath }), "Invalid enum value");
      await expectRejects(() => update(created.id, { title: "   " }, { storePath }), "Item title is required");
      await expectRejects(() => update(created.id, { status: "   " }, { storePath }), "Item status is required");
    },
  },
  {
    name: "updateItem does not allow changing id or created_at",
    run: async () => {
      const storePath = await tempStorePath();
      const created = await add({ type: "task", title: "Immutable test", status: "ready" }, { storePath });
      const updated = await update(created.id, {
        title: "Immutable test updated",
        id: "itm_changed",
        created_at: "1999-01-01T00:00:00.000Z",
      } as never, { storePath });

      expect(updated.id === created.id, "Expected id unchanged");
      expect(updated.created_at === created.created_at, "Expected created_at unchanged");
      await get(created.id, { storePath });
      await expectRejects(() => get("itm_changed", { storePath }), "Item not found");
    },
  },
  {
    name: "PATCH item API payload maps flat dates and rejects invalid payload",
    run: async () => {
      const parsed = UpdateItemRequestSchema.parse({
        title: "API edited",
        due_date: "2026-07-01",
        follow_up_date: null,
      });
      const patch = itemUpdatePatchFromRequest(parsed);

      expect(patch.title === "API edited", "Expected API title in patch");
      expect(patch.fields?.due_date === "2026-07-01", "Expected flat due_date mapped to fields");
      expect(patch.fields?.follow_up_date === null, "Expected flat follow_up_date mapped to fields");
      expect(!("id" in patch), "Expected id omitted from service patch");
      expect(!("created_at" in patch), "Expected created_at omitted from service patch");
      await expectRejects(async () => UpdateItemRequestSchema.parse({ id: "itm_bad" }), "Unrecognized key");
      await expectRejects(async () => UpdateItemRequestSchema.parse({ title: "   " }), "String must contain");
    },
  },
  {
    name: "existing archive behavior still works",
    run: async () => {
      const storePath = await tempStorePath();
      const created = await add({ type: "task", title: "Archive test", status: "ready" }, { storePath });
      const archived = await archive(created.id, { storePath });
      expect(archived.status === "archived", "Expected archived status");
      expect(Boolean(archived.archived_at), "Expected archived_at set");
    },
  },
  {
    name: "unarchive clears archived_at and restores default status after archive",
    run: async () => {
      const storePath = await tempStorePath();
      const created = await add({ type: "task", title: "Unarchive test", status: "waiting" }, { storePath });
      const archived = await archive(created.id, { storePath });
      const restored = await unarchive(created.id, { storePath });

      expect(archived.status === "archived", "Expected item archived first");
      expect(restored.archived_at === null, "Expected archived_at cleared");
      expect(restored.status === "ready", "Expected archived task to restore to default active status");
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

function item(input: Partial<Item> & Pick<Item, "id" | "type" | "title" | "status" | "created_at" | "updated_at">): Item {
  return {
    description: "",
    fields: {},
    archived_at: null,
    ...input,
  };
}

function expectIds(actual: Item[], expected: string[]): void {
  const actualIds = actual.map((candidate) => candidate.id);
  if (actualIds.join(",") !== expected.join(",")) {
    throw new Error(`Expected [${expected.join(", ")}], actual [${actualIds.join(", ")}]`);
  }
}

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function tempStorePath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "memoflow-item-eval-"));
  return join(dir, "items.jsonl");
}

async function expectRejects(fn: () => Promise<unknown>, messageIncludes: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(messageIncludes)) {
      throw new Error(`Expected error to include "${messageIncludes}", actual "${message}"`);
    }
    return;
  }

  throw new Error("Expected operation to reject");
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

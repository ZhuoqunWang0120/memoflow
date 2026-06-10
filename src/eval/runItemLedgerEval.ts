import { getVisibleItems } from "../services/itemLedgerQuery.js";
import type { Item } from "../schemas/item.js";

type TestCase = {
  name: string;
  run: () => void;
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
];

let passed = 0;

for (const test of tests) {
  try {
    test.run();
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

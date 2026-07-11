import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { ItemSchema, ItemTypeSchema, type Item, type ItemFields, type ItemType } from "../schemas/item.js";
import { getVisibleItems, type ArchivedVisibility, type ItemSortOption } from "./itemLedgerQuery.js";

const DATA_DIR = process.env.MEMOFLOW_DATA_DIR ?? "data";
const DEFAULT_STORE_PATH = join(process.cwd(), DATA_DIR, "items.jsonl");

export type ItemStoreOptions = {
  storePath?: string;
};

export type ListItemsOptions = ItemStoreOptions & {
  includeArchived?: boolean;
  archived?: ArchivedVisibility;
  type?: ItemType;
  status?: string;
  query?: string;
  sort?: ItemSortOption;
};

export type AddItemInput = {
  type: ItemType;
  title: string;
  description?: string;
  status?: string;
  fields?: ItemFields;
  source?: Item["source"];
};

export type UpdateItemInput = {
  type?: ItemType;
  title?: string;
  description?: string | null;
  status?: string;
  fields?: ItemFields;
  source?: Item["source"] | null;
  archived_at?: string | null;
};

export async function list(options: ListItemsOptions = {}): Promise<Item[]> {
  const items = await readItems(options.storePath);
  const archived = options.archived ?? (options.includeArchived ? "show" : "hide");
  return getVisibleItems(items, {
    query: options.query,
    sort: options.sort,
    filters: {
      archived,
      type: options.type,
      status: options.status,
    },
  });
}

export async function get(id: string, options: ItemStoreOptions = {}): Promise<Item> {
  const items = await readItems(options.storePath);
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Item not found: ${id}`);
  return item;
}

export async function add(input: AddItemInput, options: ItemStoreOptions = {}): Promise<Item> {
  const now = new Date().toISOString();
  const item = ItemSchema.parse({
    id: `itm_${randomUUID()}`,
    type: input.type,
    title: input.title,
    description: input.description,
    status: input.status ?? defaultStatusForType(input.type),
    fields: input.fields ?? {},
    source: input.source ?? { kind: "manual" },
    created_at: now,
    updated_at: now,
    archived_at: null,
  });

  await ensureStore(options.storePath);
  await appendItem(item, options.storePath);
  return item;
}

export async function update(id: string, patch: UpdateItemInput, options: ItemStoreOptions = {}): Promise<Item> {
  const items = await readItems(options.storePath);
  const index = items.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new Error(`Item not found: ${id}`);
  }

  const existing = items[index];
  if (!existing) {
    throw new Error(`Item not found: ${id}`);
  }

  const sanitized = sanitizeUpdatePatch(patch);
  const next = ItemSchema.parse({
    ...existing,
    ...sanitized.itemPatch,
    fields: sanitized.fields ? { ...existing.fields, ...sanitized.fields } : existing.fields,
    source: sanitized.clearSource ? undefined : sanitized.source ?? existing.source,
    updated_at: new Date().toISOString(),
  });

  items[index] = next;
  await writeItems(items, options.storePath);
  return next;
}

export async function archive(id: string, options: ItemStoreOptions = {}): Promise<Item> {
  const now = new Date().toISOString();
  return update(id, { status: "archived", archived_at: now }, options);
}

export async function unarchive(id: string, options: ItemStoreOptions = {}): Promise<Item> {
  const existing = await get(id, options);
  return update(
    id,
    {
      archived_at: null,
      status: existing.status === "archived" ? defaultStatusForType(existing.type) : existing.status,
    },
    options,
  );
}

export async function exportCsv(options: ListItemsOptions = {}): Promise<string> {
  const items = await list(options);
  const headers = [
    "id",
    "type",
    "title",
    "description",
    "status",
    "due_date",
    "follow_up_date",
    "waiting_on",
    "follow_up_needed",
    "url",
    "tags",
    "category",
    "created_at",
    "updated_at",
    "archived_at",
  ];

  const rows = items.map((item) => [
    item.id,
    item.type,
    item.title,
    item.description ?? "",
    item.status,
    item.fields.due_date ?? "",
    item.fields.follow_up_date ?? "",
    item.fields.waiting_on ?? "",
    item.fields.follow_up_needed ?? "",
    item.fields.url ?? "",
    item.fields.tags?.join("|") ?? "",
    item.fields.category ?? "",
    item.created_at,
    item.updated_at,
    item.archived_at ?? "",
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

async function readItems(storePath = DEFAULT_STORE_PATH): Promise<Item[]> {
  await ensureStore(storePath);

  const content = await readFile(storePath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return ItemSchema.parse(JSON.parse(line));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid item JSONL at line ${index + 1}: ${message}`);
      }
    });
}

async function appendItem(item: Item, storePath = DEFAULT_STORE_PATH): Promise<void> {
  const existing = await readFile(storePath, "utf8").catch(() => "");
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await writeFile(storePath, `${existing}${prefix}${JSON.stringify(item)}\n`, "utf8");
}

async function writeItems(items: Item[], storePath = DEFAULT_STORE_PATH): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.tmp`;
  const content = items.map((item) => JSON.stringify(ItemSchema.parse(item))).join("\n");
  await writeFile(tempPath, content.length > 0 ? `${content}\n` : "", "utf8");
  await rename(tempPath, storePath);
}

async function ensureStore(storePath = DEFAULT_STORE_PATH): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, "", { flag: "a" });
}

function defaultStatusForType(type: ItemType): string {
  switch (type) {
    case "task":
      return "ready";
    case "exploration":
      return "open";
    case "idea":
    case "reference":
      return "saved";
  }
}

function sanitizeUpdatePatch(patch: UpdateItemInput): {
  itemPatch: Partial<Pick<Item, "type" | "title" | "description" | "status" | "archived_at">>;
  fields?: ItemFields;
  source?: Item["source"];
  clearSource?: boolean;
} {
  const itemPatch: Partial<Pick<Item, "type" | "title" | "description" | "status" | "archived_at">> = {};

  if (patch.type !== undefined) {
    itemPatch.type = ItemTypeSchema.parse(patch.type);
  }

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new Error("Item title is required.");
    itemPatch.title = title;
  }

  if (patch.description !== undefined) {
    const description = patch.description?.trim() ?? "";
    if (description) itemPatch.description = description;
    else itemPatch.description = undefined;
  }

  if (patch.status !== undefined) {
    const status = patch.status.trim();
    if (!status) throw new Error("Item status is required.");
    itemPatch.status = status;
  }

  if (patch.archived_at !== undefined) {
    itemPatch.archived_at = patch.archived_at;
  }

  return {
    itemPatch,
    fields: patch.fields,
    source: patch.source ?? undefined,
    clearSource: patch.source === null,
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { ItemSchema, ItemTypeSchema, type Item, type ItemFields, type ItemType } from "../schemas/item.js";

const DEFAULT_STORE_PATH = join(process.cwd(), "data", "items.jsonl");

export type ItemStoreOptions = {
  storePath?: string;
};

export type ListItemsOptions = ItemStoreOptions & {
  includeArchived?: boolean;
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
  return options.includeArchived ? items : items.filter((item) => !item.archived_at);
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

  const next = ItemSchema.parse({
    ...existing,
    ...omitNullishDescription(patch),
    fields: patch.fields ? { ...existing.fields, ...patch.fields } : existing.fields,
    source: patch.source === null ? undefined : patch.source ?? existing.source,
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

export async function exportCsv(options: ListItemsOptions = {}): Promise<string> {
  const items = await list(options);
  const headers = [
    "id",
    "type",
    "title",
    "description",
    "status",
    "due_date",
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

function omitNullishDescription(patch: UpdateItemInput): UpdateItemInput {
  const result = { ...patch };
  if (result.description === null) {
    delete result.description;
  }
  if (result.type !== undefined) {
    ItemTypeSchema.parse(result.type);
  }
  return result;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

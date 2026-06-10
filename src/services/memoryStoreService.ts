import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { MemoryEntrySchema, type MemoryEntry } from "../schemas/memory.js";

const DEFAULT_STORE_PATH = join(process.cwd(), "data", "memory.jsonl");
const DEFAULT_ACTIVE_MEMORY_LIMIT = 20;

export type MemoryStoreOptions = {
  storePath?: string;
};

export type ListMemoryOptions = MemoryStoreOptions & {
  includeArchived?: boolean;
};

export type UpdateMemoryInput = {
  text: string;
};

export async function addMemory(text: string, options: MemoryStoreOptions = {}): Promise<MemoryEntry> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Memory text is required.");

  const now = new Date().toISOString();
  const entry = MemoryEntrySchema.parse({
    id: `mem_${randomUUID()}`,
    text: trimmed,
    created_at: now,
    updated_at: now,
    archived_at: null,
  });

  await ensureStore(options.storePath);
  await appendMemory(entry, options.storePath);
  return entry;
}

export async function listMemory(options: ListMemoryOptions = {}): Promise<MemoryEntry[]> {
  const entries = await readMemory(options.storePath);
  return entries.filter((entry) => options.includeArchived || !entry.archived_at);
}

export async function getActiveMemory(options: MemoryStoreOptions & { limit?: number } = {}): Promise<MemoryEntry[]> {
  const limit = options.limit ?? DEFAULT_ACTIVE_MEMORY_LIMIT;
  const entries = await listMemory({ storePath: options.storePath });
  return [...entries]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, limit);
}

export async function updateMemory(
  id: string,
  updates: UpdateMemoryInput,
  options: MemoryStoreOptions = {},
): Promise<MemoryEntry> {
  const text = updates.text.trim();
  if (!text) throw new Error("Memory text is required.");

  const entries = await readMemory(options.storePath);
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) throw new Error(`Memory entry not found: ${id}`);

  const existing = entries[index];
  if (!existing) throw new Error(`Memory entry not found: ${id}`);

  const next = MemoryEntrySchema.parse({
    ...existing,
    text,
    updated_at: new Date().toISOString(),
  });

  entries[index] = next;
  await writeMemory(entries, options.storePath);
  return next;
}

export async function archiveMemory(id: string, options: MemoryStoreOptions = {}): Promise<MemoryEntry> {
  const entries = await readMemory(options.storePath);
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) throw new Error(`Memory entry not found: ${id}`);

  const existing = entries[index];
  if (!existing) throw new Error(`Memory entry not found: ${id}`);

  const now = new Date().toISOString();
  const next = MemoryEntrySchema.parse({
    ...existing,
    updated_at: now,
    archived_at: existing.archived_at ?? now,
  });

  entries[index] = next;
  await writeMemory(entries, options.storePath);
  return next;
}

export async function deleteMemory(id: string, options: MemoryStoreOptions = {}): Promise<void> {
  const entries = await readMemory(options.storePath);
  const next = entries.filter((entry) => entry.id !== id);
  if (next.length === entries.length) throw new Error(`Memory entry not found: ${id}`);
  await writeMemory(next, options.storePath);
}

async function readMemory(storePath = DEFAULT_STORE_PATH): Promise<MemoryEntry[]> {
  await ensureStore(storePath);

  const content = await readFile(storePath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return MemoryEntrySchema.parse(JSON.parse(line));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid memory JSONL at line ${index + 1}: ${message}`);
      }
    });
}

async function appendMemory(entry: MemoryEntry, storePath = DEFAULT_STORE_PATH): Promise<void> {
  const existing = await readFile(storePath, "utf8").catch(() => "");
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await writeFile(storePath, `${existing}${prefix}${JSON.stringify(entry)}\n`, "utf8");
}

async function writeMemory(entries: MemoryEntry[], storePath = DEFAULT_STORE_PATH): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.tmp`;
  const content = entries.map((entry) => JSON.stringify(MemoryEntrySchema.parse(entry))).join("\n");
  await writeFile(tempPath, content.length > 0 ? `${content}\n` : "", "utf8");
  await rename(tempPath, storePath);
}

async function ensureStore(storePath = DEFAULT_STORE_PATH): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, "", { flag: "a" });
}

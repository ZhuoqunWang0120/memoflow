import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DumpSchema, type Dump } from "../schemas/dump.js";

const DATA_DIR = process.env.MEMOFLOW_DATA_DIR ?? "data";
const DEFAULT_STORE_PATH = join(process.cwd(), DATA_DIR, "dumps.jsonl");

export type DumpStoreOptions = {
  storePath?: string;
};

export type ListDumpsOptions = DumpStoreOptions & {
  includeIgnored?: boolean;
  includeReviewed?: boolean;
};

export type AddDumpInput = {
  rawText: string;
  source?: string | null;
};

export async function listPending(options: ListDumpsOptions = {}): Promise<Dump[]> {
  const dumps = await readDumps(options.storePath);
  return dumps.filter((dump) => {
    if (dump.status === "pending") return true;
    if (dump.status === "ignored") return Boolean(options.includeIgnored);
    if (dump.status === "reviewed") return Boolean(options.includeReviewed);
    return false;
  });
}

export async function addDump(input: AddDumpInput, options: DumpStoreOptions = {}): Promise<Dump> {
  const rawText = input.rawText.trim();
  if (!rawText) throw new Error("rawText is required.");

  const now = new Date().toISOString();
  const dump = DumpSchema.parse({
    id: `dump_${randomUUID()}`,
    raw_text: rawText,
    status: "pending",
    created_at: now,
    updated_at: now,
    reviewed_at: null,
    ignored_at: null,
    source: input.source ?? null,
  });

  await ensureStore(options.storePath);
  await appendDump(dump, options.storePath);
  return dump;
}

export async function getDump(id: string, options: DumpStoreOptions = {}): Promise<Dump> {
  const dumps = await readDumps(options.storePath);
  const dump = dumps.find((candidate) => candidate.id === id);
  if (!dump) throw new Error(`Dump not found: ${id}`);
  return dump;
}

export async function markReviewed(id: string, options: DumpStoreOptions = {}): Promise<Dump> {
  return updateDump(id, {
    status: "reviewed",
    reviewed_at: new Date().toISOString(),
  }, options);
}

export async function ignoreDump(id: string, options: DumpStoreOptions = {}): Promise<Dump> {
  return updateDump(id, {
    status: "ignored",
    ignored_at: new Date().toISOString(),
  }, options);
}

async function updateDump(
  id: string,
  patch: Partial<Pick<Dump, "status" | "reviewed_at" | "ignored_at">>,
  options: DumpStoreOptions = {},
): Promise<Dump> {
  const dumps = await readDumps(options.storePath);
  const index = dumps.findIndex((dump) => dump.id === id);
  if (index === -1) throw new Error(`Dump not found: ${id}`);

  const existing = dumps[index];
  if (!existing) throw new Error(`Dump not found: ${id}`);

  const next = DumpSchema.parse({
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  });

  dumps[index] = next;
  await writeDumps(dumps, options.storePath);
  return next;
}

async function readDumps(storePath = DEFAULT_STORE_PATH): Promise<Dump[]> {
  await ensureStore(storePath);

  const content = await readFile(storePath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return DumpSchema.parse(JSON.parse(line));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid dump JSONL at line ${index + 1}: ${message}`);
      }
    });
}

async function appendDump(dump: Dump, storePath = DEFAULT_STORE_PATH): Promise<void> {
  const existing = await readFile(storePath, "utf8").catch(() => "");
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await writeFile(storePath, `${existing}${prefix}${JSON.stringify(dump)}\n`, "utf8");
}

async function writeDumps(dumps: Dump[], storePath = DEFAULT_STORE_PATH): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.tmp`;
  const content = dumps.map((dump) => JSON.stringify(DumpSchema.parse(dump))).join("\n");
  await writeFile(tempPath, content.length > 0 ? `${content}\n` : "", "utf8");
  await rename(tempPath, storePath);
}

async function ensureStore(storePath = DEFAULT_STORE_PATH): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, "", { flag: "a" });
}

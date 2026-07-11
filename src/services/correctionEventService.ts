import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Item, ItemFields } from "../schemas/item.js";
import type { Suggestion } from "../schemas/suggestion.js";
import { CorrectionEventSchema, type CorrectionEvent, type CorrectionSnapshot } from "../schemas/correctionEvent.js";
import { suggestionToAddItemInput, type SuggestionApprovalOverrides } from "./suggestionApprovalService.js";

const DATA_DIR = process.env.MEMOFLOW_DATA_DIR ?? "data";
const DEFAULT_STORE_PATH = join(process.cwd(), DATA_DIR, "correction_events.jsonl");

export type CorrectionEventStoreOptions = {
  storePath?: string;
};

export type ReviewCorrectionSource = "pending_review" | "suggestion_review" | "cli_review";

export type ReviewCorrectionContext = {
  source: ReviewCorrectionSource;
  proposalId?: string;
  dumpId?: string;
};

export type ReviewCorrectionEventInput = {
  rawText: string;
  suggestion: Suggestion;
  overrides?: SuggestionApprovalOverrides;
  savedItem: Item;
  reviewContext: ReviewCorrectionContext;
};

export function buildCorrectionSnapshots(input: {
  rawText: string;
  suggestion: Suggestion;
  savedItem: Item;
}): { before: CorrectionSnapshot; after: CorrectionSnapshot } {
  const before = buildBaselineProposalSnapshot(input.rawText, input.suggestion);
  const after = snapshotFromSavedItem(input.savedItem);
  return { before, after };
}

export function changedFieldsBetweenSnapshots(before: CorrectionSnapshot, after: CorrectionSnapshot): string[] {
  const changed = new Set<string>();

  if (before.type !== after.type) changed.add("type");
  if (before.title !== after.title) changed.add("title");
  if ((before.description ?? "") !== (after.description ?? "")) changed.add("description");
  if (before.status !== after.status) changed.add("status");

  const fieldKeys = new Set([
    ...Object.keys(before.fields ?? {}),
    ...Object.keys(after.fields ?? {}),
  ]);

  for (const key of fieldKeys) {
    const beforeValue = (before.fields ?? {})[key as keyof ItemFields];
    const afterValue = (after.fields ?? {})[key as keyof ItemFields];
    if (JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null)) {
      changed.add(`fields.${key}`);
    }
  }

  return [...changed];
}

export async function appendCorrectionEvent(
  input: ReviewCorrectionEventInput,
  options: CorrectionEventStoreOptions = {},
): Promise<CorrectionEvent | null> {
  const { before, after } = buildCorrectionSnapshots(input);
  const changedFields = changedFieldsBetweenSnapshots(before, after);
  if (changedFields.length === 0) return null;

  const event = CorrectionEventSchema.parse({
    id: `corr_${randomUUID()}`,
    created_at: new Date().toISOString(),
    source: input.reviewContext.source,
    proposal_id: input.reviewContext.proposalId ?? null,
    dump_id: input.reviewContext.dumpId ?? null,
    saved_item_id: input.savedItem.id ?? null,
    before,
    after,
    changed_fields: changedFields,
    learning_status: "unreviewed",
  });

  await ensureStore(options.storePath);
  await appendEvent(event, options.storePath);
  return event;
}

export async function listCorrectionEvents(options: CorrectionEventStoreOptions = {}): Promise<CorrectionEvent[]> {
  const storePath = options.storePath ?? DEFAULT_STORE_PATH;
  await ensureStore(storePath);
  const content = await readFile(storePath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return CorrectionEventSchema.parse(JSON.parse(line));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid correction event JSONL at line ${index + 1}: ${message}`);
      }
    });
}

function buildBaselineProposalSnapshot(rawText: string, suggestion: Suggestion): CorrectionSnapshot {
  try {
    const baseline = suggestionToAddItemInput({ suggestion, rawText });
    return sanitizeSnapshot({
      type: baseline.type,
      title: baseline.title,
      description: baseline.description,
      status: baseline.status ?? "",
      fields: baseline.fields ?? {},
    });
  } catch {
    return sanitizeSnapshot({
      type: suggestion.type,
      title: suggestion.title,
      description: suggestion.description,
      status: suggestion.status,
      fields: suggestion.suggested_fields ?? {},
    });
  }
}

function snapshotFromSavedItem(item: Item): CorrectionSnapshot {
  return sanitizeSnapshot({
    type: item.type,
    title: item.title,
    description: item.description,
    status: item.status,
    fields: item.fields ?? {},
  });
}

function sanitizeSnapshot(snapshot: CorrectionSnapshot): CorrectionSnapshot {
  const cleanedFields = Object.fromEntries(
    Object.entries(snapshot.fields ?? {}).filter(([, value]) => value !== undefined),
  );

  return CorrectionEventSchema.shape.before.parse({
    type: snapshot.type,
    title: snapshot.title,
    description: snapshot.description?.trim() || undefined,
    status: snapshot.status,
    fields: cleanedFields,
  });
}

async function appendEvent(event: CorrectionEvent, storePath = DEFAULT_STORE_PATH): Promise<void> {
  const existing = await readFile(storePath, "utf8").catch(() => "");
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await writeFile(storePath, `${existing}${prefix}${JSON.stringify(event)}\n`, "utf8");
}

async function ensureStore(storePath = DEFAULT_STORE_PATH): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, "", { flag: "a" });
}

import type { Item } from "../schemas/item.js";
import type { MemoryEntry } from "../schemas/memory.js";
import { list as listItems } from "./itemStoreService.js";
import { getActiveMemory } from "./memoryStoreService.js";

const RECENT_ACTIVE_ITEM_LIMIT = 20;
const KEYWORD_MATCH_LIMIT = 5;
const SEMANTIC_SCAN_ITEM_LIMIT = 100;
const ACTIVE_MEMORY_LIMIT = 20;
const MIN_DUPLICATE_OVERLAP = 2;
const MIN_DUPLICATE_RATIO = 0.5;
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "about",
  "be",
  "by",
  "for",
  "from",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
]);

export type SuggestionContext = {
  memoryEntries: MemoryEntry[];
  recentActiveItems: Item[];
  keywordMatchedItems: Item[];
  semanticScanItems: Item[];
};

export type BuildSuggestionContextOptions = {
  itemStorePath?: string;
  memoryStorePath?: string;
};

export async function buildSuggestionContext(
  rawText: string,
  options: BuildSuggestionContextOptions = {},
): Promise<SuggestionContext> {
  const [memoryEntries, allItems] = await Promise.all([
    getActiveMemory({ storePath: options.memoryStorePath, limit: ACTIVE_MEMORY_LIMIT }),
    listItems({ storePath: options.itemStorePath, archived: "show", sort: "updated_at_desc" }),
  ]);

  const activeItems = allItems.filter(isActiveItem);
  const keywordMatchedItems = keywordMatchItems(rawText, activeItems).slice(0, KEYWORD_MATCH_LIMIT);
  const keywordMatchedIds = new Set(keywordMatchedItems.map((item) => item.id));
  const recentActiveItems = activeItems
    .filter((item) => !keywordMatchedIds.has(item.id))
    .sort(compareItemUpdatedDesc)
    .slice(0, RECENT_ACTIVE_ITEM_LIMIT);
  const selectedIds = new Set([...keywordMatchedItems, ...recentActiveItems].map((item) => item.id));
  const olderActiveItemsByUpdatedAt = activeItems
    .filter((item) => !selectedIds.has(item.id))
    .sort(compareItemUpdatedDesc);
  const semanticScanItems = uniqueById([
    ...keywordMatchedItems,
    ...recentActiveItems,
    ...olderActiveItemsByUpdatedAt,
  ]).slice(0, SEMANTIC_SCAN_ITEM_LIMIT);

  debugSuggestionContext({ keywordMatchedItems, recentActiveItems, semanticScanItems });

  return {
    memoryEntries,
    recentActiveItems,
    keywordMatchedItems,
    semanticScanItems,
  };
}

export function keywordMatchItems(rawText: string, items: Item[]): Item[] {
  const rawTokens = tokenize(rawText);
  if (rawTokens.size === 0) return [];

  return items
    .filter((item) => !item.archived_at)
    .map((item, index) => ({
      item,
      index,
      score: overlapScore(rawTokens, tokenize(itemSearchText(item))),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((candidate) => candidate.item);
}

export function deterministicRelatedItems(rawText: string, items: Item[]): Array<{
  item_id: string;
  relationship: "possible_duplicate";
  reason: string;
  confidence: number;
}> {
  const rawTokens = tokenize(rawText);
  if (rawTokens.size === 0) return [];

  return items
    .filter((item) => !item.archived_at)
    .map((item, index) => {
      const overlap = overlappingTokens(rawTokens, tokenize(itemSearchText(item)));
      return {
        item,
        index,
        overlap,
        ratio: overlap.length / rawTokens.size,
      };
    })
    .filter((candidate) =>
      candidate.overlap.length >= MIN_DUPLICATE_OVERLAP &&
      candidate.ratio >= MIN_DUPLICATE_RATIO
    )
    .sort((left, right) => {
      if (right.overlap.length !== left.overlap.length) return right.overlap.length - left.overlap.length;
      if (right.ratio !== left.ratio) return right.ratio - left.ratio;
      return left.index - right.index;
    })
    .slice(0, KEYWORD_MATCH_LIMIT)
    .map((candidate) => ({
      item_id: candidate.item.id,
      relationship: "possible_duplicate" as const,
      reason: `Shares key terms: ${candidate.overlap.slice(0, 5).join(", ")}`,
      confidence: Math.min(0.9, 0.55 + candidate.ratio * 0.3),
    }));
}

export function isActiveItem(item: Item): boolean {
  if (item.archived_at) return false;
  const status = item.status.toLowerCase();
  return status !== "done" && status !== "archived";
}

function compareItemUpdatedDesc(left: Item, right: Item): number {
  const dateCompare = itemSortDate(right).localeCompare(itemSortDate(left));
  if (dateCompare !== 0) return dateCompare;
  return left.id.localeCompare(right.id);
}

function itemSortDate(item: Item): string {
  return item.updated_at || item.created_at || "";
}

function itemSearchText(item: Item): string {
  return [
    item.title,
    item.description ?? "",
    item.source?.raw_text ?? "",
  ].join(" ");
}

function overlapScore(left: Set<string>, right: Set<string>): number {
  let score = 0;
  for (const token of left) {
    if (right.has(token)) score += 1;
  }
  return score;
}

function overlappingTokens(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((token) => right.has(token));
}

function uniqueById(items: Item[]): Item[] {
  const seen = new Set<string>();
  const unique: Item[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  return unique;
}

function debugSuggestionContext(context: Pick<SuggestionContext, "keywordMatchedItems" | "recentActiveItems" | "semanticScanItems">): void {
  if (process.env.MEMOFLOW_DEBUG_CONTEXT !== "1") return;

  console.debug("Suggestion context item IDs", {
    keywordMatchedItems: context.keywordMatchedItems.map((item) => item.id),
    recentActiveItems: context.recentActiveItems.map((item) => item.id),
    semanticScanItems: context.semanticScanItems.map((item) => item.id),
  });
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

  return new Set(tokens);
}

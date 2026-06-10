import type { Item, ItemType } from "../schemas/item.js";

export const ItemSortOptionValues = [
  "created_at_desc",
  "created_at_asc",
  "updated_at_desc",
  "updated_at_asc",
  "due_date_asc",
  "follow_up_date_asc",
  "type_asc",
  "status_asc",
] as const;

export type ItemSortOption = (typeof ItemSortOptionValues)[number];
export type ArchivedVisibility = "hide" | "show" | "only";

export type ItemLedgerFilters = {
  type?: ItemType;
  status?: string;
  archived?: ArchivedVisibility;
};

export type ItemLedgerQuery = {
  filters?: ItemLedgerFilters;
  sort?: ItemSortOption;
  query?: string;
};

export function getVisibleItems(items: Item[], options: ItemLedgerQuery = {}): Item[] {
  const searched = searchItems(items, options.query);
  const filtered = filterItems(searched, options.filters);
  return sortItems(filtered, options.sort ?? "updated_at_desc");
}

export function searchItems(items: Item[], query?: string): Item[] {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return [...items];

  return items.filter((item) => {
    const haystack = [
      item.title,
      item.description,
      item.source?.raw_text,
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export function filterItems(items: Item[], filters: ItemLedgerFilters = {}): Item[] {
  const archived = filters.archived ?? "hide";

  return items.filter((item) => {
    if (archived === "hide" && item.archived_at) return false;
    if (archived === "only" && !item.archived_at) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.status && item.status !== filters.status) return false;
    return true;
  });
}

export function sortItems(items: Item[], sort: ItemSortOption): Item[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const compared = compareItems(left.item, right.item, sort);
      return compared === 0 ? left.index - right.index : compared;
    })
    .map(({ item }) => item);
}

function compareItems(left: Item, right: Item, sort: ItemSortOption): number {
  switch (sort) {
    case "created_at_desc":
      return compareDateDesc(left.created_at, right.created_at);
    case "created_at_asc":
      return compareDateAsc(left.created_at, right.created_at);
    case "updated_at_desc":
      return compareDateDesc(left.updated_at || left.created_at, right.updated_at || right.created_at);
    case "updated_at_asc":
      return compareDateAsc(left.updated_at || left.created_at, right.updated_at || right.created_at);
    case "due_date_asc":
      return compareOptionalDateAsc(left.fields.due_date, right.fields.due_date);
    case "follow_up_date_asc":
      return compareOptionalDateAsc(left.fields.follow_up_date, right.fields.follow_up_date);
    case "type_asc":
      return compareText(left.type, right.type);
    case "status_asc":
      return compareText(left.status, right.status);
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

function compareDateAsc(left: string | null | undefined, right: string | null | undefined): number {
  return dateValue(left) - dateValue(right);
}

function compareDateDesc(left: string | null | undefined, right: string | null | undefined): number {
  return dateValue(right) - dateValue(left);
}

function compareOptionalDateAsc(left: string | null | undefined, right: string | null | undefined): number {
  const leftMissing = !left;
  const rightMissing = !right;
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  return dateValue(left) - dateValue(right);
}

function dateValue(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

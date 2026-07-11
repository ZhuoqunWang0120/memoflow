import {
  SuggestionResultSchema,
  type Suggestion,
  type SuggestionResult,
  type SuggestionType,
} from "../schemas/suggestion.js";

const VALID_TYPES: SuggestionType[] = ["task", "exploration", "idea", "reference"];
const TASK_HINT_RE = /\b(email|call|text|send|submit|finish|complete|pay|book|schedule|remind|follow up|check|update|review|buy|ask|pick up|waiting on|waiting for)\b|投递|带\s*id|带\s*ID|发邮件|回复|开始找工作|还设备|买菜/i;
const EXPLORATION_HINT_RE = /\b(how|why|research|figure out|decide|compare|learn|investigate|look into|explore|should i|whether)\b|能不能|怎么|是否/i;
const IDEA_HINT_RE = /\b(maybe|idea|feature|could|should support|someday|later|would be nice|prototype|build)\b/i;
const REFERENCE_HINT_RE = /\b(note|reference|link|save this|fyi|info|remember)\b/i;

type RawSuggestion = Record<string, unknown>;
type RawSuggestionResult = {
  suggestions?: unknown;
};

export function normalizeSuggestionResult(value: unknown): SuggestionResult {
  const raw = asRawSuggestionResult(value);
  return SuggestionResultSchema.parse({
    suggestions: raw.suggestions.map((suggestion) => normalizeSuggestion(suggestion)),
  });
}

export function normalizeSuggestion(rawSuggestion: RawSuggestion): Suggestion {
  const suggestion = { ...rawSuggestion };
  const rawType = readString(suggestion.type);
  const rawStatus = readString(suggestion.status);
  const needsClarification = readBoolean(suggestion.needs_clarification)
    || rawType === "clarify_needed"
    || rawStatus === "clarify_needed"
    || rawStatus === "needs_clarification";

  const normalizedType = normalizeType(suggestion, rawType, rawStatus, needsClarification);
  const normalizedStatus = normalizeStatus(rawStatus, normalizedType, needsClarification);

  return SuggestionResultSchema.shape.suggestions.element.parse({
    ...suggestion,
    type: normalizedType,
    status: normalizedStatus,
    needs_clarification: needsClarification,
    clarification_question: normalizeClarificationQuestion(suggestion, needsClarification),
    missing_context: normalizeMissingContext(suggestion, needsClarification),
  });
}

function normalizeType(
  suggestion: RawSuggestion,
  rawType: string | null,
  rawStatus: string | null,
  needsClarification: boolean,
): SuggestionType {
  if (rawType && VALID_TYPES.includes(rawType as SuggestionType)) {
    return rawType as SuggestionType;
  }

  const text = [readString(suggestion.title), readString(suggestion.description)].filter(Boolean).join(" ");
  const url = readSuggestedFieldString(suggestion, "url");

  if (url) return "reference";
  if (TASK_HINT_RE.test(text)) return "task";
  if (EXPLORATION_HINT_RE.test(text)) return "exploration";
  if (IDEA_HINT_RE.test(text)) return "idea";
  if (REFERENCE_HINT_RE.test(text)) return "reference";
  if (rawStatus === "open") return "exploration";
  if (rawStatus === "ready" || rawStatus === "waiting" || rawStatus === "in_progress" || rawStatus === "done") return "task";
  if (rawStatus === "saved") return "reference";
  if (needsClarification) return "reference";
  return "task";
}

function normalizeStatus(
  rawStatus: string | null,
  type: SuggestionType,
  needsClarification: boolean,
): string {
  if (needsClarification) return "needs_clarification";
  if (rawStatus && rawStatus !== "clarify_needed") return rawStatus;
  return defaultStatusForType(type);
}

function normalizeClarificationQuestion(suggestion: RawSuggestion, needsClarification: boolean): string | undefined {
  const existing = readString(suggestion.clarification_question);
  if (existing) return existing;
  if (!needsClarification) return undefined;
  const title = readString(suggestion.title) || "this memo";
  return `What does "${title}" refer to, and should it be saved, explored, or turned into an action?`;
}

function normalizeMissingContext(suggestion: RawSuggestion, needsClarification: boolean): string[] | undefined {
  const existing = Array.isArray(suggestion.missing_context)
    ? suggestion.missing_context.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  if (existing.length > 0) return existing;
  if (!needsClarification) return undefined;
  const title = readString(suggestion.title) || "this memo";
  return [
    `Meaning of "${title}"`,
    "Whether this is a task, idea, exploration, or reference",
  ];
}

function defaultStatusForType(type: SuggestionType): string {
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

function readSuggestedFieldString(suggestion: RawSuggestion, field: string): string | null {
  const suggestedFields = isRecord(suggestion.suggested_fields) ? suggestion.suggested_fields : null;
  if (!suggestedFields) return null;
  return readString(suggestedFields[field]);
}

function asRawSuggestionResult(value: unknown): { suggestions: RawSuggestion[] } {
  if (!isRecord(value) || !Array.isArray(value.suggestions)) {
    throw new Error("Suggestion result must contain a suggestions array.");
  }

  return {
    suggestions: value.suggestions.map((entry) => {
      if (!isRecord(entry)) throw new Error("Suggestion entries must be objects.");
      return entry;
    }),
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

import type { Suggestion, SuggestionResult, SuggestionType } from "../schemas/suggestion.js";
import type { ParseSuggestionInput, SuggestionParser } from "./types.js";

const URL_RE = /^https?:\/\/\S+$/i;
const URL_IN_TEXT_RE = /https?:\/\/\S+/i;
const ACTION_START_RE = /\b(email|call|text|send|submit|finish|complete|pay|book|schedule|remind|follow up|check|update|review|buy|ask|pick up|waiting on|waiting for)\b|投递|带\s*id|带\s*ID|发邮件|回复|开始找工作|还设备|买菜/i;
const TASK_RE = ACTION_START_RE;
const IDEA_RE = /\b(maybe|idea|could|should support|feature|someday|later|would be nice)\b/i;
const EXPLORATION_RE = /\b(how|why|research|figure out|decide|compare|learn|investigate|look into|explore|should i|whether|can .+ apply)\b|能不能|怎么|是否/i;
const REFERENCE_RE = /\b(fyi|note|remember|reference|save this|fact:|info:)\b|机会|资产|财富|窗口|基本功/i;
const BARE_IDEA_RE = /\b(portfolio website|dissertation chatbot|chatbot|website|toolkit|app|project|项目|产品)\b/i;

export const stubSuggestionParser: SuggestionParser = {
  async parse(input: ParseSuggestionInput): Promise<SuggestionResult> {
    const chunks = splitMemo(input.rawText);

    if (chunks.length === 0) {
      return { suggestions: [clarifySuggestion("Clarify empty memo", "The memo is empty.")] };
    }

    return {
      suggestions: chunks.map((chunk) => buildSuggestion(chunk)),
    };
  },
};

function splitMemo(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (URL_RE.test(trimmed)) return [trimmed];

  // If text contains a URL, keep as one chunk to avoid splitting the URL out of context
  if (URL_IN_TEXT_RE.test(trimmed) && !trimmed.includes("\n")) return [trimmed];

  return rawText
    .split(/(?:\n+|[.;!?]+|\balso\b|,\s*(?=\b(?:email|call|text|send|submit|finish|complete|pay|book|schedule|remind|follow up|check|update|review|buy|ask|pick up|waiting on|waiting for)\b))/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function buildSuggestion(chunk: string): Suggestion {
  if (chunk.length < 4) {
    return clarifySuggestion("Clarify memo fragment", `The memo fragment "${chunk}" is too short to classify safely.`);
  }

  const type = classify(chunk);
  const title = titleCase(cleanTitle(chunk));
  const needsClarification = type === "clarify_needed";

  if (needsClarification) {
    return clarifySuggestion(
      `Clarify: ${title}`,
      `The memo appears to use shorthand without enough context to classify safely: ${chunk}`,
      chunk,
    );
  }

  const suggestedFields: Suggestion["suggested_fields"] = {
    category: categoryFor(type, chunk),
    follow_up_needed: followUpNeededFor(type, chunk),
    due_date: extractDueDate(chunk),
    waiting_on: extractWaitingOn(chunk),
  };

  if (URL_RE.test(chunk)) {
    suggestedFields.url = chunk;
  } else {
    const urlMatch = chunk.match(URL_IN_TEXT_RE);
    if (urlMatch) {
      suggestedFields.url = urlMatch[0];
    }
  }

  return {
    type,
    title,
    description: descriptionFor(type, chunk),
    status: statusFor(type),
    confidence: confidenceFor(type),
    needs_clarification: false,
    suggested_fields: suggestedFields,
  };
}

function classify(text: string): SuggestionType {
  if (URL_RE.test(text)) return "reference";
  if (TASK_RE.test(text)) return "task";
  if (EXPLORATION_RE.test(text)) return "exploration";
  if (IDEA_RE.test(text) || BARE_IDEA_RE.test(text)) return "idea";
  if (REFERENCE_RE.test(text)) return "reference";
  if (URL_IN_TEXT_RE.test(text)) return "reference";
  return "clarify_needed";
}

function cleanTitle(text: string): string {
  return text
    .replace(/^\s*(maybe|idea:|note:|fyi:)\s*/i, "")
    .replace(/\bfinal eval\b/i, "final evaluation")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(text: string): string {
  const keepUpper = new Set(["ID", "OPT", "SEVP", "UI", "API", "LLM", "RAG"]);
  const preserveCase = new Map([["IOS", "iOS"]]);

  return text
    .split(" ")
    .map((word, index) => {
      const cleaned = word.replace(/[^a-z0-9]/gi, "");
      const preserved = preserveCase.get(cleaned.toUpperCase());
      if (preserved) return preserved;
      if (keepUpper.has(cleaned.toUpperCase())) return cleaned.toUpperCase();
      if (index > 0 && ["a", "an", "the", "to", "for", "of", "and", "or", "about"].includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function descriptionFor(type: SuggestionType, chunk: string): string {
  switch (type) {
    case "task":
      return `Action to take: ${chunk}`;
    case "exploration":
      return `Open question or research direction: ${chunk}`;
    case "idea":
      return `Possible future idea to save: ${chunk}`;
    case "reference":
      return `Reference note to save: ${chunk}`;
    case "clarify_needed":
      return `Needs clarification before it can be classified safely: ${chunk}`;
  }
}

function followUpNeededFor(type: SuggestionType, chunk: string): boolean | null {
  if (type === "task") return /\bfollow up|waiting|ask|email|call|send|reply|回复|发邮件|投递\b/i.test(chunk);
  if (type === "exploration") return true;
  if (type === "idea" || type === "reference") return false;
  return null;
}

function statusFor(type: SuggestionType): Suggestion["status"] {
  switch (type) {
    case "task":
      return "ready";
    case "exploration":
      return "open";
    case "idea":
    case "reference":
      return "saved";
    case "clarify_needed":
      return "needs_clarification";
  }
}

function confidenceFor(type: SuggestionType): number {
  return type === "clarify_needed" ? 0.35 : 0.72;
}

function categoryFor(type: SuggestionType, text: string): string | null {
  if (/\bDuke|SEVP|OPT|immigration|eval\b/i.test(text)) return "admin/immigration";
  if (/\bsmart memo|memoflow|product|feature|status\b/i.test(text)) return "product";
  if (/linkedin/i.test(text)) return "networking";
  if (type === "reference") return "reference";
  return null;
}

function extractDueDate(text: string): string | null {
  const weekdayDueDate = extractWeekdayDueDate(text);
  if (weekdayDueDate) return weekdayDueDate;

  if (/今天或大后天/.test(text)) {
    return formatDate(addDays(new Date(), 3));
  }

  if (/\btoday\s+or\s+(?:tomorrow|tmr)\b/i.test(text)) {
    return formatDate(addDays(new Date(), 1));
  }

  if (/\b(?:tomorrow|tmr)\b/i.test(text)) {
    return formatDate(addDays(new Date(), 1));
  }

  if (/\btoday\b/i.test(text)) {
    return formatDate(new Date());
  }

  if (/今天或明天/.test(text)) {
    return formatDate(addDays(new Date(), 1));
  }

  if (/明后天/.test(text)) {
    return formatDate(addDays(new Date(), 2));
  }

  if (/大后天/.test(text)) {
    return formatDate(addDays(new Date(), 3));
  }

  if (/后天/.test(text)) {
    return formatDate(addDays(new Date(), 2));
  }

  if (/明天/.test(text)) {
    return formatDate(addDays(new Date(), 1));
  }

  if (/今天/.test(text)) {
    return formatDate(new Date());
  }

  const match = text.match(/\b(?:before|by|due)\s+([A-Za-z]+\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i);
  return match?.[1] ?? null;
}

function extractWeekdayDueDate(text: string): string | null {
  const weekdayMap = new Map<string, number>([
    ["monday", 1],
    ["mon", 1],
    ["tuesday", 2],
    ["tue", 2],
    ["wednesday", 3],
    ["wed", 3],
    ["thursday", 4],
    ["thu", 4],
    ["friday", 5],
    ["fri", 5],
    ["saturday", 6],
    ["sat", 6],
    ["sunday", 0],
    ["sun", 0],
    ["一", 1],
    ["二", 2],
    ["三", 3],
    ["四", 4],
    ["五", 5],
    ["六", 6],
    ["日", 0],
    ["天", 0],
  ]);

  const englishMatch = text.match(/\b(?:(next)\s+)?(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/i);
  if (englishMatch?.[2]) {
    const weekday = weekdayMap.get(englishMatch[2].toLowerCase());
    if (weekday !== undefined) return formatDate(nextWeekdayDate(weekday, Boolean(englishMatch[1])));
  }

  const chineseMatch = text.match(/(下)?(?:周|星期)([一二三四五六日天])/);
  if (chineseMatch?.[2]) {
    const weekday = weekdayMap.get(chineseMatch[2]);
    if (weekday !== undefined) return formatDate(nextWeekdayDate(weekday, Boolean(chineseMatch[1])));
  }

  return null;
}

function nextWeekdayDate(targetWeekday: number, forceNextWeek: boolean): Date {
  const today = new Date();
  const currentWeekday = today.getDay();
  let daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;

  if (forceNextWeek) {
    daysUntilTarget = daysUntilTarget === 0 ? 7 : daysUntilTarget + 7;
  } else if (daysUntilTarget === 0) {
    daysUntilTarget = 7;
  }

  return addDays(today, daysUntilTarget);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function extractWaitingOn(text: string): string | null {
  const match = text.match(/\bwaiting (?:on|for)\s+([A-Z][A-Za-z0-9_-]*)\b/);
  return match?.[1] ?? null;
}

function clarifySuggestion(title: string, description: string, originalText = "the memo"): Suggestion {
  return {
    type: "clarify_needed",
    title,
    description,
    status: "needs_clarification",
    confidence: 0.2,
    needs_clarification: true,
    clarification_question: `What does "${originalText}" refer to, and should it be saved, explored, or turned into an action?`,
    missing_context: [
      `Meaning of "${originalText}"`,
      "Whether this is a task, idea, exploration, or reference",
    ],
    suggested_fields: {
      category: null,
      follow_up_needed: false,
      due_date: null,
      waiting_on: null,
    },
  };
}

import "dotenv/config";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SuggestionResultSchema } from "../schemas/suggestion.js";
import { createSuggestionsFromDump } from "../services/suggestionService.js";
import type { ParserName } from "../parsers/types.js";

type GoldenExpectation = {
  type: string;
  status?: string;
  title_contains?: string[];
  title_not_contains?: string[];
  needs_clarification?: boolean;
  clarification_question_present?: boolean;
  missing_context_present?: boolean;
  due_date?: string | null;
  due_date_relative_days?: number;
  due_date_relative_days_any?: Array<number | null>;
  due_date_weekday?: number;
  waiting_on?: string | null;
  url?: string | null;
};

type GoldenCase = {
  id: string;
  input: string;
  expected_count?: number;
  expected: GoldenExpectation[];
};

type EvalArgs = {
  parser: ParserName;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cases = await loadGoldenCases(join(process.cwd(), "src", "eval", "golden_cases.jsonl"));

  let passed = 0;
  let typeChecks = 0;
  let typePasses = 0;

  for (const testCase of cases) {
    const result = await createSuggestionsFromDump(
      { rawText: testCase.input },
      { parser: args.parser },
    );
    SuggestionResultSchema.parse(result);

    const failures: string[] = [];

    if (testCase.expected_count !== undefined && result.suggestions.length !== testCase.expected_count) {
      failures.push(`Expected ${testCase.expected_count} suggestions, actual ${result.suggestions.length}`);
    }

    for (let index = 0; index < testCase.expected.length; index += 1) {
      const expected = testCase.expected[index];
      const actual = result.suggestions[index];

      if (!expected) continue;

      if (!actual) {
        failures.push(`Missing suggestion at index ${index}`);
        continue;
      }

      typeChecks += 1;
      if (actual.type === expected.type) {
        typePasses += 1;
      } else {
        failures.push(`Expected type ${expected.type} at index ${index}, actual ${actual.type}`);
      }

      if (expected.status !== undefined && actual.status !== expected.status) {
        failures.push(`Expected status ${expected.status} at index ${index}, actual ${actual.status}`);
      }

      for (const keyword of expected.title_contains ?? []) {
        if (!actual.title.toLowerCase().includes(keyword.toLowerCase())) {
          failures.push(`Expected title at index ${index} to contain "${keyword}", actual "${actual.title}"`);
        }
      }

      for (const keyword of expected.title_not_contains ?? []) {
        if (actual.title.toLowerCase().includes(keyword.toLowerCase())) {
          failures.push(`Expected title at index ${index} not to contain "${keyword}", actual "${actual.title}"`);
        }
      }

      if (
        expected.needs_clarification !== undefined &&
        actual.needs_clarification !== expected.needs_clarification
      ) {
        failures.push(
          `Expected needs_clarification ${expected.needs_clarification} at index ${index}, actual ${actual.needs_clarification}`,
        );
      }

      if (
        expected.clarification_question_present !== undefined &&
        Boolean(actual.clarification_question) !== expected.clarification_question_present
      ) {
        failures.push(
          `Expected clarification_question present=${expected.clarification_question_present} at index ${index}`,
        );
      }

      if (
        expected.missing_context_present !== undefined &&
        Boolean(actual.missing_context?.length) !== expected.missing_context_present
      ) {
        failures.push(`Expected missing_context present=${expected.missing_context_present} at index ${index}`);
      }

      const acceptableDueDates = expected.due_date_relative_days_any?.map((days) =>
        days === null ? null : formatDate(addDays(new Date(), days)),
      );
      const expectedDueDate =
        expected.due_date_relative_days !== undefined
          ? formatDate(addDays(new Date(), expected.due_date_relative_days))
          : expected.due_date_weekday !== undefined
            ? formatDate(nextWeekdayDate(expected.due_date_weekday, false))
          : expected.due_date;

      if (
        acceptableDueDates !== undefined &&
        !acceptableDueDates.includes(actual.suggested_fields.due_date ?? null)
      ) {
        failures.push(
          `Expected due_date to be one of ${acceptableDueDates.map(String).join(", ")} at index ${index}, actual ${String(actual.suggested_fields.due_date)}`,
        );
      }

      if (
        acceptableDueDates === undefined &&
        expectedDueDate !== undefined &&
        actual.suggested_fields.due_date !== expectedDueDate
      ) {
        failures.push(
          `Expected due_date ${String(expectedDueDate)} at index ${index}, actual ${String(actual.suggested_fields.due_date)}`,
        );
      }

      if (expected.waiting_on !== undefined && actual.suggested_fields.waiting_on !== expected.waiting_on) {
        failures.push(
          `Expected waiting_on ${String(expected.waiting_on)} at index ${index}, actual ${String(actual.suggested_fields.waiting_on)}`,
        );
      }

      if (expected.url !== undefined && actual.suggested_fields.url !== expected.url) {
        failures.push(
          `Expected url ${String(expected.url)} at index ${index}, actual ${String(actual.suggested_fields.url)}`,
        );
      }
    }

    if (failures.length === 0) {
      passed += 1;
      console.log(`${testCase.id} PASS`);
    } else {
      console.log(`${testCase.id} FAIL`);
      for (const failure of failures) {
        console.log(`  ${failure}`);
      }
    }
  }

  const typeAccuracy = typeChecks === 0 ? 0 : (typePasses / typeChecks) * 100;

  console.log("");
  console.log("Summary:");
  console.log(`${passed}/${cases.length} passed`);
  console.log(`Type accuracy: ${typeAccuracy.toFixed(1)}%`);

  if (passed !== cases.length) {
    process.exitCode = 1;
  }
}

async function loadGoldenCases(path: string): Promise<GoldenCase[]> {
  const content = await readFile(path, "utf8");

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoldenCase);
}

function parseArgs(argv: string[]): EvalArgs {
  let parser: ParserName = "stub";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--parser") {
      const value = argv[index + 1];
      if (value !== "stub" && value !== "llm") {
        throw new Error('--parser must be either "stub" or "llm".');
      }
      parser = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--parser=")) {
      const value = arg.slice("--parser=".length);
      if (value !== "stub" && value !== "llm") {
        throw new Error('--parser must be either "stub" or "llm".');
      }
      parser = value;
      continue;
    }
  }

  return { parser };
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

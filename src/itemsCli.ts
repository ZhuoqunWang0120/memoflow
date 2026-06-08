import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { add, archive, exportCsv, list, update, type AddItemInput, type UpdateItemInput } from "./services/itemStoreService.js";
import { ItemTypeSchema, type ItemFields, type ItemType } from "./schemas/item.js";
import { createSuggestionsFromDump } from "./services/suggestionService.js";
import { suggestionToAddItemInput, type SuggestionApprovalOverrides } from "./services/suggestionApprovalService.js";
import type { ParserName } from "./parsers/types.js";
import type { Suggestion } from "./schemas/suggestion.js";

type ParsedCommand =
  | { command: "list"; includeArchived: boolean }
  | { command: "add"; input: AddItemInput }
  | { command: "update"; id: string; patch: UpdateItemInput }
  | { command: "archive"; id: string }
  | { command: "export-csv"; includeArchived: boolean }
  | { command: "review-dump"; parser: ParserName; rawText: string };

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));

  switch (command.command) {
    case "list": {
      const items = await list({ includeArchived: command.includeArchived });
      console.log(JSON.stringify({ items }, null, 2));
      return;
    }
    case "add": {
      const item = await add(command.input);
      console.log(JSON.stringify(item, null, 2));
      return;
    }
    case "update": {
      const item = await update(command.id, command.patch);
      console.log(JSON.stringify(item, null, 2));
      return;
    }
    case "archive": {
      const item = await archive(command.id);
      console.log(JSON.stringify(item, null, 2));
      return;
    }
    case "export-csv": {
      const csv = await exportCsv({ includeArchived: command.includeArchived });
      console.log(csv);
      return;
    }
    case "review-dump": {
      await reviewDump(command.rawText, command.parser);
      return;
    }
  }
}

function parseCommand(argv: string[]): ParsedCommand {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case "list":
      return { command, includeArchived: hasFlag(rest, "--include-archived") };
    case "add":
      return { command, input: parseAdd(rest) };
    case "update": {
      const id = rest[0];
      if (!id) throw new Error("Item id is required for update.");
      return { command, id, patch: parseUpdate(rest.slice(1)) };
    }
    case "archive": {
      const id = rest[0];
      if (!id) throw new Error("Item id is required for archive.");
      return { command, id };
    }
    case "export-csv":
      return { command, includeArchived: hasFlag(rest, "--include-archived") };
    case "review-dump":
      return parseReviewDump(rest);
    default:
      printHelp();
      throw new Error(`Unknown item command: ${command}`);
  }
}

async function reviewDump(rawText: string, parser: ParserName): Promise<void> {
  const result = await createSuggestionsFromDump({ rawText }, { parser });
  const savedItems = [];
  const rl = createInterface({ input, output });

  try {
    for (let index = 0; index < result.suggestions.length; index += 1) {
      const suggestion = result.suggestions[index];
      if (!suggestion) continue;

      printSuggestion(suggestion, index, result.suggestions.length);

      while (true) {
        const action = normalizeAction(await rl.question("Choose [a]pprove, [e]dit, [r]eject, [q]uit: "));

        if (action === "q") {
          console.log(JSON.stringify({ saved_items: savedItems, quit: true }, null, 2));
          return;
        }

        if (action === "r") {
          console.log("Rejected.");
          break;
        }

        if (action === "a") {
          try {
            const item = await add(suggestionToAddItemInput({ suggestion, rawText }));
            savedItems.push(item);
            console.log(`Saved item: ${item.id}`);
            break;
          } catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            console.error("Use edit to change this suggestion before saving.");
            continue;
          }
        }

        if (action === "e") {
          const overrides = await promptForOverrides(rl, suggestion);
          const item = await add(suggestionToAddItemInput({ suggestion, rawText, overrides }));
          savedItems.push(item);
          console.log(`Saved item: ${item.id}`);
          break;
        }

        console.log("Unknown choice.");
      }
    }
  } finally {
    rl.close();
  }

  console.log(JSON.stringify({ saved_items: savedItems }, null, 2));
}

function parseReviewDump(argv: string[]): ParsedCommand {
  let parser: ParserName = "stub";
  const textParts: string[] = [];

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

    if (arg) textParts.push(arg);
  }

  const rawText = textParts.join(" ").trim();
  if (!rawText) {
    throw new Error("Raw memo text is required for review-dump.");
  }

  return { command: "review-dump", parser, rawText };
}

function printSuggestion(suggestion: Suggestion, index: number, total: number): void {
  console.log("");
  console.log(`Suggestion ${index + 1}/${total}`);
  console.log(`Type: ${suggestion.type}`);
  console.log(`Title: ${suggestion.title}`);
  if (suggestion.description) console.log(`Description: ${suggestion.description}`);
  console.log(`Status: ${suggestion.status}`);
  console.log(`Confidence: ${suggestion.confidence}`);
  console.log(`Needs clarification: ${suggestion.needs_clarification}`);
  if (suggestion.clarification_question) console.log(`Clarification: ${suggestion.clarification_question}`);
  console.log(`Fields: ${JSON.stringify(suggestion.suggested_fields)}`);
}

function normalizeAction(value: string): string {
  return value.trim().toLowerCase().charAt(0);
}

async function promptForOverrides(
  rl: ReturnType<typeof createInterface>,
  suggestion: Suggestion,
): Promise<SuggestionApprovalOverrides> {
  const defaultType = suggestion.type === "clarify_needed" ? "" : suggestion.type;
  const typeValue = await askWithDefault(rl, "Type", defaultType);
  const type = typeValue ? parseItemType(typeValue) : undefined;
  const title = await askWithDefault(rl, "Title", suggestion.title);
  const description = await askWithDefault(rl, "Description", suggestion.description ?? "");
  const status = await askWithDefault(rl, "Status", type ? defaultStatusForType(type) : suggestion.status);
  const dueDate = await askWithDefault(rl, "Due date", suggestion.suggested_fields.due_date ?? "");
  const waitingOn = await askWithDefault(rl, "Waiting on", suggestion.suggested_fields.waiting_on ?? "");
  const tags = await askWithDefault(rl, "Tags comma-separated", suggestion.suggested_fields.tags?.join(",") ?? "");
  const category = await askWithDefault(rl, "Category", suggestion.suggested_fields.category ?? "");

  const fields: ItemFields = {};
  if (dueDate) fields.due_date = dueDate;
  if (waitingOn) fields.waiting_on = waitingOn;
  if (tags) fields.tags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  if (category) fields.category = category;

  return {
    type,
    title,
    description: description || undefined,
    status,
    fields,
  };
}

async function askWithDefault(
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: string,
): Promise<string> {
  const answer = await rl.question(`${label}${defaultValue ? ` [${defaultValue}]` : ""}: `);
  return answer.trim() || defaultValue;
}

function parseAdd(argv: string[]): AddItemInput {
  const type = parseItemType(requiredOption(argv, "--type"));
  const title = requiredOption(argv, "--title");

  return {
    type,
    title,
    description: optionValue(argv, "--description"),
    status: optionValue(argv, "--status") ?? defaultStatusForType(type),
    fields: parseFields(argv),
    source: { kind: "manual" },
  };
}

function parseUpdate(argv: string[]): UpdateItemInput {
  const patch: UpdateItemInput = {};
  const type = optionValue(argv, "--type");
  const title = optionValue(argv, "--title");
  const description = optionValue(argv, "--description");
  const status = optionValue(argv, "--status");
  const fields = parseFields(argv);

  if (type !== undefined) patch.type = parseItemType(type);
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (status !== undefined) patch.status = status;
  if (Object.keys(fields).length > 0) patch.fields = fields;

  if (Object.keys(patch).length === 0) {
    throw new Error("At least one update field is required.");
  }

  return patch;
}

function parseFields(argv: string[]): ItemFields {
  const tags = optionValue(argv, "--tags");
  const followUpNeeded = optionValue(argv, "--follow-up-needed");

  const fields: ItemFields = {};
  const category = optionValue(argv, "--category");
  const dueDate = optionValue(argv, "--due-date");
  const waitingOn = optionValue(argv, "--waiting-on");
  const url = optionValue(argv, "--url");

  if (category !== undefined) fields.category = category;
  if (dueDate !== undefined) fields.due_date = dueDate;
  if (waitingOn !== undefined) fields.waiting_on = waitingOn;
  if (url !== undefined) fields.url = url;
  if (tags !== undefined) fields.tags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  if (followUpNeeded !== undefined) fields.follow_up_needed = parseBoolean(followUpNeeded);

  return fields;
}

function optionValue(argv: string[], name: string): string | undefined {
  const equalsPrefix = `${name}=`;
  const equalsMatch = argv.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsMatch) return equalsMatch.slice(equalsPrefix.length);

  const index = argv.indexOf(name);
  if (index === -1) return undefined;

  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Option ${name} requires a value.`);
  }
  return value;
}

function requiredOption(argv: string[], name: string): string {
  const value = optionValue(argv, name);
  if (!value) throw new Error(`Option ${name} is required.`);
  return value;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function parseItemType(value: string): ItemType {
  return ItemTypeSchema.parse(value);
}

function parseBoolean(value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Boolean options must be true or false.");
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

function printHelp(): void {
  console.log(`Usage:
  npm run items -- list [--include-archived]
  npm run items -- add --type task|exploration|idea|reference --title "Title" [options]
  npm run items -- update <id> [options]
  npm run items -- archive <id>
  npm run items -- export-csv [--include-archived]
  npm run items -- review-dump [--parser stub|llm] "raw memo text"

Options:
  --description "Text"
  --status "ready"
  --category "personal"
  --due-date YYYY-MM-DD
  --waiting-on "Name"
  --url "https://..."
  --tags "tag1,tag2"
  --follow-up-needed true|false
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

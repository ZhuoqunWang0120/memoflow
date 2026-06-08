import "dotenv/config";

import { createSuggestionsFromDump } from "./services/suggestionService.js";
import type { ParserName } from "./parsers/types.js";

type CliArgs = {
  parser: ParserName;
  rawText: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await createSuggestionsFromDump(
    { rawText: args.rawText },
    { parser: args.parser },
  );

  console.log(JSON.stringify(result, null, 2));
}

function parseArgs(argv: string[]): CliArgs {
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

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg) textParts.push(arg);
  }

  const rawText = textParts.join(" ").trim();
  if (!rawText) {
    printHelp();
    throw new Error("Raw memo text is required.");
  }

  return { parser, rawText };
}

function printHelp(): void {
  console.log(`Usage:
  npm run suggest -- [--parser stub|llm] "raw memo text"

Examples:
  npm run suggest -- "email Duke about final eval"
  npm run suggest -- --parser llm "maybe Smart Memo should support waiting status"
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

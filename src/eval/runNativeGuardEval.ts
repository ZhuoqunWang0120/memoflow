import { readFile } from "node:fs/promises";

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

const captureViewPath = "apps/ios/MemoFlowIOS/Views/CaptureView.swift";
const captureViewSource = await readFile(captureViewPath, "utf8");

const tests: TestCase[] = [
  {
    name: "type picker uses menu style",
    run: async () => {
      expect(
        captureViewSource.includes(".pickerStyle(.menu)"),
        "Expected the suggestion type picker to use .menu style.",
      );
    },
  },
  {
    name: "suggestion rows avoid enumerated index binding",
    run: async () => {
      expect(
        !captureViewSource.includes("ForEach(Array(viewModel.suggestions.enumerated())"),
        "Expected suggestion rows not to use enumerated array indices.",
      );
    },
  },
  {
    name: "approval uses stable suggestion ids",
    run: async () => {
      expect(
        captureViewSource.includes("try viewModel.approveSuggestion(id: suggestionID"),
        "Expected approval to route through stable suggestion IDs.",
      );
      expect(
        captureViewSource.includes("viewModel.discardSuggestion(id: suggestionID)"),
        "Expected discard to route through stable suggestion IDs.",
      );
    },
  },
  {
    name: "approval navigates to items tab",
    run: async () => {
      expect(
        captureViewSource.includes("appState.selectedTab = .items"),
        "Expected successful approval to navigate to the Items tab.",
      );
    },
  },
];

let passed = 0;

for (const test of tests) {
  try {
    await test.run();
    passed += 1;
    console.log(`${test.name} PASS`);
  } catch (error) {
    console.log(`${test.name} FAIL`);
    console.log(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log("");
console.log("Summary:");
console.log(`${passed}/${tests.length} passed`);

if (passed !== tests.length) {
  process.exitCode = 1;
}

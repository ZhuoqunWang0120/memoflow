/**
 * MemoFlow Demo Data Seed
 *
 * Creates isolated demo data in data/demo/ for the LinkedIn recording.
 * Safe to run repeatedly — overwrites existing demo data.
 */

import { mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEMO_DIR = resolve(ROOT, "data/demo");

mkdirSync(DEMO_DIR, { recursive: true });

// Seed item: "Pick up medicine"
writeFileSync(
  resolve(DEMO_DIR, "items.jsonl"),
  JSON.stringify({
    id: "demo_medicine",
    type: "task",
    title: "Pick up medicine",
    status: "ready",
    description: "Pick up the pharmacy order when ready.",
    created_at: "2026-06-09T10:00:00.000Z",
    updated_at: "2026-06-10T10:00:00.000Z",
    archived_at: null,
    source: { kind: "manual" },
    fields: {},
  }) + "\n"
);

// Seed memory: "Safeway is my usual pharmacy."
writeFileSync(
  resolve(DEMO_DIR, "memory.jsonl"),
  JSON.stringify({
    id: "demo_pharmacy",
    text: "Safeway is my usual pharmacy.",
    created_at: "2026-06-09T10:00:00.000Z",
    updated_at: "2026-06-10T10:00:00.000Z",
    archived_at: null,
  }) + "\n"
);

// Empty dumps (created during demo flow)
writeFileSync(resolve(DEMO_DIR, "dumps.jsonl"), "");

console.log("Demo data seeded in data/demo/");

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { z } from "zod";
import { CAPTURE_HTML } from "../webServerCaptureHtml.js";
import { addDump, listPending } from "../services/dumpStoreService.js";
import { addMemory, listMemory } from "../services/memoryStoreService.js";

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

// ── Helpers ────────────────────────────────────────────────────────────

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function expectRejects(fn: () => Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedMessage)) {
      throw new Error(`Expected error containing "${expectedMessage}", actual "${message}"`);
    }
    return;
  }
  throw new Error("Expected function to reject");
}

async function readJson(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function sendHtml(res: import("node:http").ServerResponse, html: string): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
}

const AddDumpRequestSchema = z.object({
  rawText: z.string().trim().min(1, "rawText is required"),
});

const AddMemoryRequestSchema = z.object({
  text: z.string().trim().min(1, "Memory text is required"),
});

// ── Setup ──────────────────────────────────────────────────────────────

const tempDir = await mkdtemp(join(tmpdir(), "memoflow-capture-eval-"));
const tempDumpStore = join(tempDir, "dumps.jsonl");
const tempMemoryStore = join(tempDir, "memory.jsonl");

// Minimal test server on random port
const testServer = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/capture") {
      sendHtml(res, CAPTURE_HTML);
      return;
    }
    if (req.method === "POST" && req.url === "/api/dumps") {
      const body = AddDumpRequestSchema.parse(await readJson(req));
      const dump = await addDump({ rawText: body.rawText, source: "capture" }, { storePath: tempDumpStore });
      sendJson(res, 201, dump);
      return;
    }
    if (req.method === "POST" && req.url === "/api/memory") {
      const body = AddMemoryRequestSchema.parse(await readJson(req));
      const mem = await addMemory(body.text, { storePath: tempMemoryStore });
      sendJson(res, 201, mem);
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof z.ZodError ? 400 : 500;
    sendJson(res, status, { error: message });
  }
});

await new Promise<void>((resolve) => testServer.listen(0, "127.0.0.1", () => resolve()));
const addr = testServer.address() as { port: number };
const baseUrl = `http://127.0.0.1:${addr.port}`;

// ── Tests ──────────────────────────────────────────────────────────────

const tests: TestCase[] = [
  {
    name: "/capture route renders with expected content",
    run: async () => {
      const res = await fetch(baseUrl + "/capture");
      expect(res.status === 200, "Expected 200");
      const html = await res.text();
      expect(html.includes("MemoFlow Capture"), "Expected title");
      expect(html.includes("Drop it now. Review later."), "Expected subtitle");
      expect(html.includes('id="memoText"'), "Expected memo textarea");
      expect(html.includes('id="saveDumpBtn"'), "Expected save dump button");
      expect(html.includes('id="memoryText"'), "Expected memory textarea");
      expect(html.includes('id="addMemoryBtn"'), "Expected add memory button");
      expect(html.includes("Open workspace"), "Expected workspace link");
    },
  },
  {
    name: "/capture does not contain suggestion generation UI",
    run: async () => {
      expect(!CAPTURE_HTML.includes("Generate suggestions"), "No suggestion generation");
      expect(!CAPTURE_HTML.includes("/api/suggestions"), "No suggestions API call");
    },
  },
  {
    name: "/capture does not show pending review, item ledger, or memory list",
    run: async () => {
      expect(!CAPTURE_HTML.includes("Pending Review"), "No pending review list");
      expect(!CAPTURE_HTML.includes("Saved Items"), "No item ledger");
      expect(!CAPTURE_HTML.includes("memoryList"), "No memory management list");
    },
  },
  {
    name: "empty raw memo is rejected (service)",
    run: async () => {
      await expectRejects(
        () => addDump({ rawText: "   ", source: "capture" }, { storePath: tempDumpStore }),
        "rawText is required",
      );
    },
  },
  {
    name: "saving raw memo calls existing dump save path (service)",
    run: async () => {
      const dump = await addDump({ rawText: "capture eval memo", source: "capture" }, { storePath: tempDumpStore });
      expect(dump.id.startsWith("dump_"), "Expected dump_ prefix");
      expect(dump.raw_text === "capture eval memo", "Expected raw_text preserved");
      expect(dump.status === "pending", "Expected pending status");

      const pending = await listPending({ storePath: tempDumpStore });
      expect(pending.some((d) => d.id === dump.id), "Expected dump in pending list");
    },
  },
  {
    name: "saving raw memo does not call suggestion generation or create items",
    run: async () => {
      const memBefore = await listMemory({ storePath: tempMemoryStore });
      await addDump({ rawText: "should not trigger suggestions", source: "capture" }, { storePath: tempDumpStore });
      const memAfter = await listMemory({ storePath: tempMemoryStore });
      expect(memBefore.length === memAfter.length, "Saving dump should not change memory count");
    },
  },
  {
    name: "empty memory is rejected (service)",
    run: async () => {
      await expectRejects(
        () => addMemory("   ", { storePath: tempMemoryStore }),
        "Memory text is required",
      );
    },
  },
  {
    name: "adding memory calls existing memory save path (service)",
    run: async () => {
      const entry = await addMemory("capture eval memory", { storePath: tempMemoryStore });
      expect(entry.id.startsWith("mem_"), "Expected mem_ prefix");
      expect(entry.text === "capture eval memory", "Expected text preserved");
      expect(entry.archived_at === null, "Expected no archived_at");

      const listed = await listMemory({ storePath: tempMemoryStore });
      expect(listed.some((m) => m.id === entry.id), "Expected memory in list");
    },
  },
  {
    name: "adding memory does not call LLM or create dumps",
    run: async () => {
      const dumpsBefore = await listPending({ storePath: tempDumpStore });
      await addMemory("another capture memory", { storePath: tempMemoryStore });
      const dumpsAfter = await listPending({ storePath: tempDumpStore });
      expect(dumpsBefore.length === dumpsAfter.length, "Adding memory should not create dumps");
    },
  },
  {
    name: "dump save via API returns 201 with valid dump",
    run: async () => {
      const res = await fetch(baseUrl + "/api/dumps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: "api capture dump" }),
      });
      expect(res.status === 201, "Expected 201");
      const body = (await res.json()) as Record<string, unknown>;
      expect(typeof body.id === "string", "Expected dump id");
      expect(body.status === "pending", "Expected pending");
    },
  },
  {
    name: "empty dump via API returns 400",
    run: async () => {
      const res = await fetch(baseUrl + "/api/dumps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: "   " }),
      });
      expect(res.status === 400, "Expected 400 for empty dump");
    },
  },
  {
    name: "memory save via API returns 201 with valid entry",
    run: async () => {
      const res = await fetch(baseUrl + "/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "api capture memory" }),
      });
      expect(res.status === 201, "Expected 201");
      const body = (await res.json()) as Record<string, unknown>;
      expect(typeof body.id === "string", "Expected memory id");
      expect(body.archived_at === null, "Expected no archived_at");
    },
  },
  {
    name: "empty memory via API returns 400",
    run: async () => {
      const res = await fetch(baseUrl + "/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   " }),
      });
      expect(res.status === 400, "Expected 400 for empty memory");
    },
  },
];

// ── Run ────────────────────────────────────────────────────────────────

let passed = 0;

try {
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
} finally {
  testServer.close();
  await rm(tempDir, { recursive: true, force: true });
}

console.log("");
console.log("Summary:");
console.log(`${passed}/${tests.length} passed`);

if (passed !== tests.length) {
  process.exitCode = 1;
}

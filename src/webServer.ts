import "dotenv/config";

import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import { createSuggestionsFromDump } from "./services/suggestionService.js";
import { add, archive, get, list, update } from "./services/itemStoreService.js";
import { suggestionToAddItemInput } from "./services/suggestionApprovalService.js";
import { ItemFieldsSchema, ItemTypeSchema } from "./schemas/item.js";
import { SuggestionSchema } from "./schemas/suggestion.js";
import { addDump, ignoreDump, listPending, markReviewed } from "./services/dumpStoreService.js";
import { ItemSortOptionValues, type ArchivedVisibility, type ItemSortOption } from "./services/itemLedgerQuery.js";
import { itemUpdatePatchFromRequest, UpdateItemRequestSchema } from "./services/itemUpdatePatch.js";
import {
  addMemory,
  archiveMemory,
  deleteMemory,
  getActiveMemory,
  listMemory,
  updateMemory,
} from "./services/memoryStoreService.js";
import { buildSuggestionContext } from "./services/suggestionContextService.js";
import { CAPTURE_HTML } from "./webServerCaptureHtml.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";
const CV_ROUTE = "/assets/carol-wang-cv-062026-webapp.pdf";
const CV_PATH = join(process.cwd(), "public", "carol-wang-cv-062026-webapp.pdf");

const GenerateSuggestionsRequestSchema = z.object({
  rawText: z.string().trim().min(1, "rawText is required"),
  parser: z.enum(["stub", "llm"]).optional().default("stub"),
  useMemory: z.boolean().optional().default(false),
  useContext: z.boolean().optional().default(false),
});

const ApprovalOverridesSchema = z.object({
  type: ItemTypeSchema.optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  status: z.string().trim().min(1).optional(),
  fields: ItemFieldsSchema.optional(),
});

const AddApprovedItemRequestSchema = z.object({
  rawText: z.string(),
  suggestion: SuggestionSchema,
  overrides: ApprovalOverridesSchema.optional(),
});

const AddDumpRequestSchema = z.object({
  rawText: z.string().trim().min(1, "rawText is required"),
});

const AddMemoryRequestSchema = z.object({
  text: z.string().trim().min(1, "Memory text is required"),
});

const UpdateMemoryRequestSchema = z.object({
  text: z.string().trim().min(1, "Memory text is required"),
});

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      sendHtml(res, APP_HTML);
      return;
    }

    if (req.method === "GET" && req.url === "/capture") {
      sendHtml(res, CAPTURE_HTML);
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && req.url === CV_ROUTE) {
      const pdf = await readFile(CV_PATH);
      sendPdf(res, pdf, req.method === "HEAD");
      return;
    }

    if (req.method === "POST" && req.url === "/api/suggestions") {
      const body = GenerateSuggestionsRequestSchema.parse(await readJson(req));
      const suggestionContext = body.useContext ? await buildSuggestionContext(body.rawText) : undefined;
      const memory = !body.useContext && body.useMemory ? await getActiveMemory({ limit: 20 }) : [];
      const result = await createSuggestionsFromDump(
        {
          rawText: body.rawText,
          context: body.useContext
            ? { suggestionContext }
            : body.useMemory
              ? { snippets: memory.map((entry) => entry.text) }
              : undefined,
        },
        { parser: body.parser },
      );
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && req.url?.startsWith("/api/memory")) {
      const params = new URL(req.url, `http://${HOST}:${PORT}`).searchParams;
      const memory = await listMemory({ includeArchived: params.get("archived") === "show" });
      sendJson(res, 200, { memory });
      return;
    }

    if (req.method === "POST" && req.url === "/api/memory") {
      const body = AddMemoryRequestSchema.parse(await readJson(req));
      const memory = await addMemory(body.text);
      sendJson(res, 201, memory);
      return;
    }

    const memoryArchiveMatch = req.url?.match(/^\/api\/memory\/([^/]+)\/archive$/);
    if (req.method === "POST" && memoryArchiveMatch?.[1]) {
      const memory = await archiveMemory(decodeURIComponent(memoryArchiveMatch[1]));
      sendJson(res, 200, memory);
      return;
    }

    const memoryMatch = req.url?.match(/^\/api\/memory\/([^/]+)$/);
    if (req.method === "PATCH" && memoryMatch?.[1]) {
      const body = UpdateMemoryRequestSchema.parse(await readJson(req));
      const memory = await updateMemory(decodeURIComponent(memoryMatch[1]), body);
      sendJson(res, 200, memory);
      return;
    }

    if (req.method === "DELETE" && memoryMatch?.[1]) {
      await deleteMemory(decodeURIComponent(memoryMatch[1]));
      sendJson(res, 200, { ok: true });
      return;
    }

    const itemMatch = req.url?.match(/^\/api\/items\/([^/]+)$/);
    if (req.method === "GET" && itemMatch?.[1]) {
      const item = await get(decodeURIComponent(itemMatch[1]));
      sendJson(res, 200, item);
      return;
    }

    if (req.method === "GET" && (req.url === "/api/items" || req.url?.startsWith("/api/items?"))) {
      const params = new URL(req.url, `http://${HOST}:${PORT}`).searchParams;
      const type = params.get("type");
      const items = await list({
        archived: parseArchivedVisibility(params.get("archived")),
        sort: parseItemSort(params.get("sort")),
        type: type ? ItemTypeSchema.parse(type) : undefined,
        status: params.get("status") || undefined,
        query: params.get("query") || undefined,
      });
      sendJson(res, 200, { items });
      return;
    }

    if (req.method === "GET" && req.url === "/api/dumps") {
      const dumps = await listPending();
      sendJson(res, 200, { dumps });
      return;
    }

    if (req.method === "POST" && req.url === "/api/dumps") {
      const body = AddDumpRequestSchema.parse(await readJson(req));
      const dump = await addDump({ rawText: body.rawText, source: "web" });
      sendJson(res, 201, dump);
      return;
    }

    const dumpIgnoreMatch = req.url?.match(/^\/api\/dumps\/([^/]+)\/ignore$/);
    if (req.method === "POST" && dumpIgnoreMatch?.[1]) {
      const dump = await ignoreDump(decodeURIComponent(dumpIgnoreMatch[1]));
      sendJson(res, 200, dump);
      return;
    }

    const dumpReviewedMatch = req.url?.match(/^\/api\/dumps\/([^/]+)\/reviewed$/);
    if (req.method === "POST" && dumpReviewedMatch?.[1]) {
      const dump = await markReviewed(decodeURIComponent(dumpReviewedMatch[1]));
      sendJson(res, 200, dump);
      return;
    }

    if (req.method === "POST" && req.url === "/api/items") {
      const body = AddApprovedItemRequestSchema.parse(await readJson(req));
      const input = suggestionToAddItemInput({
        rawText: body.rawText,
        suggestion: body.suggestion,
        overrides: body.overrides,
      });
      const item = await add(input);
      sendJson(res, 201, item);
      return;
    }

    const archiveMatch = req.url?.match(/^\/api\/items\/([^/]+)\/archive$/);
    if (req.method === "POST" && archiveMatch?.[1]) {
      const item = await archive(decodeURIComponent(archiveMatch[1]));
      sendJson(res, 200, item);
      return;
    }

    if (req.method === "PATCH" && itemMatch?.[1]) {
      const body = UpdateItemRequestSchema.parse(await readJson(req));
      const item = await update(decodeURIComponent(itemMatch[1]), itemUpdatePatchFromRequest(body));
      sendJson(res, 200, item);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof z.ZodError ? 400 : 500;
    sendJson(res, status, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MemoFlow webapp running at http://${HOST}:${PORT}`);
});

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function sendPdf(res: ServerResponse, pdf: Buffer, headOnly = false): void {
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'inline; filename="carol-wang-cv-062026-webapp.pdf"',
    "Content-Length": String(pdf.byteLength),
    "Cache-Control": "no-store",
  });
  res.end(headOnly ? undefined : pdf);
}

function parseArchivedVisibility(value: string | null): ArchivedVisibility {
  if (value === "show" || value === "only" || value === "hide") return value;
  return "hide";
}

function parseItemSort(value: string | null): ItemSortOption | undefined {
  if (!value) return undefined;
  if (ItemSortOptionValues.includes(value as ItemSortOption)) return value as ItemSortOption;
  throw new Error(`Invalid item sort: ${value}`);
}

const APP_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MemoFlow Local</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f7f4;
      --ink: #20211f;
      --muted: #686c63;
      --line: #d9d8cf;
      --panel: #ffffff;
      --accent: #256f5b;
      --accent-2: #334f8d;
      --danger: #9f3535;
      --shadow: 0 1px 2px rgba(30, 34, 31, 0.08);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 24px 0 48px;
    }
    header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    h1 {
      font-size: 24px;
      margin: 0;
      letter-spacing: 0;
    }
    h2 {
      font-size: 17px;
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    .muted {
      color: var(--muted);
      font-size: 13px;
    }
    .contact-block {
      display: grid;
      justify-items: end;
      gap: 7px;
      max-width: 420px;
      text-align: right;
    }
    .contact-title {
      font-size: 13px;
      color: var(--muted);
    }
    .contact-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .icon-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      min-width: 42px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--accent-2);
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      padding: 7px 10px;
    }
    .icon-link:hover {
      border-color: #aeb8d0;
      background: #f9fafc;
    }
    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
      gap: 18px;
      align-items: start;
    }
    section {
      min-width: 0;
    }
    .band {
      background: rgba(255,255,255,0.65);
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 14px 0;
      margin-bottom: 18px;
    }
    textarea, input, select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      font: inherit;
      padding: 9px 10px;
    }
    textarea {
      min-height: 130px;
      resize: vertical;
    }
    label {
      display: grid;
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
    }
    button {
      border: 1px solid transparent;
      border-radius: 6px;
      background: var(--accent);
      color: #fff;
      font: inherit;
      font-weight: 650;
      padding: 9px 12px;
      cursor: pointer;
    }
    button.secondary {
      background: #fff;
      color: var(--accent-2);
      border-color: var(--line);
    }
    button.danger {
      background: #fff;
      color: var(--danger);
      border-color: #e1c4c4;
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .parser {
      width: 120px;
    }
    .generation-settings {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .generation-settings.disabled {
      opacity: 0.55;
    }
    .checkbox-row {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 650;
    }
    .checkbox-row input {
      width: auto;
      margin: 0;
    }
    .memory-input {
      min-height: 74px;
    }
    .memory-edit {
      min-height: 82px;
    }
    .stack {
      display: grid;
      gap: 12px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      box-shadow: var(--shadow);
    }
    .card.archived {
      opacity: 0.62;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 8px;
      color: var(--muted);
      font-size: 12px;
      background: #fafaf8;
    }
    .error {
      display: none;
      border: 1px solid #e3b7b7;
      background: #fff3f3;
      color: #842323;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
      white-space: pre-wrap;
    }
    .empty {
      color: var(--muted);
      border: 1px dashed var(--line);
      border-radius: 8px;
      padding: 18px;
      background: rgba(255,255,255,0.5);
    }
    .row-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
      margin-bottom: 10px;
    }
    .row-title {
      font-weight: 750;
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .source {
      font-size: 12px;
      color: var(--muted);
      margin-top: 8px;
      overflow-wrap: anywhere;
    }
    @media (max-width: 860px) {
      main { width: min(100vw - 20px, 720px); }
      header { display: grid; }
      .contact-block {
        justify-items: start;
        text-align: left;
      }
      .contact-actions {
        justify-content: flex-start;
      }
      .workspace { grid-template-columns: 1fr; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>MemoFlow Local</h1>
        <div class="muted">Local file store: data/items.jsonl</div>
      </div>
      <aside class="contact-block" aria-label="Carol Wang contact">
        <div class="contact-title">Hey, this is Carol. I'm open to work: AI Eng, MLE, alternative data.</div>
        <div class="contact-actions">
          <a class="icon-link" href="mailto:zhuoqun.wang0120@gmail.com" aria-label="Email Carol Wang" title="Email Carol Wang">@</a>
          <a class="icon-link" href="${CV_ROUTE}" target="_blank" rel="noreferrer" aria-label="Open Carol Wang CV" title="Open Carol Wang CV">CV</a>
        </div>
      </aside>
    </header>

    <div id="error" class="error"></div>

    <div class="band">
      <section>
        <h2>Raw Memo</h2>
        <textarea id="rawText"></textarea>
        <div class="controls">
          <button id="saveLaterBtn" class="secondary">Save for later</button>
          <div id="generationSettings" class="generation-settings">
            <select id="parser" class="parser" aria-label="Parser">
              <option value="stub">stub</option>
              <option value="llm">llm</option>
            </select>
            <label class="checkbox-row">
              <input id="useMemory" type="checkbox" />
              Use memory
            </label>
            <label class="checkbox-row">
              <input id="useContext" type="checkbox" />
              Use context
            </label>
            <button id="generateBtn">Generate suggestions now</button>
          </div>
          <span id="status" class="muted"></span>
        </div>
      </section>
    </div>

    <section class="band">
      <h2>Memory</h2>
      <div class="card">
        <label>Add memory
          <textarea id="memoryText" class="memory-input" placeholder="Kiersten is my Duke DSO contact for STEM OPT questions."></textarea>
        </label>
        <div class="controls">
          <button id="addMemoryBtn" class="secondary">+ Add Memory</button>
          <label class="checkbox-row">
            <input id="showArchivedMemory" type="checkbox" />
            Show archived
          </label>
        </div>
      </div>
      <div id="memoryList" class="stack"></div>
    </section>

    <section class="band">
      <h2>Pending Review</h2>
      <div id="pendingDumps" class="stack"></div>
    </section>

    <div class="workspace">
      <section>
        <h2>Suggestions</h2>
        <div id="reviewControls"></div>
        <div id="suggestions" class="stack">
          <div class="empty">Generate suggestions from a memo dump, then approve, edit, or reject each card.</div>
        </div>
      </section>

      <section>
        <h2>Saved Items</h2>
        <div class="card">
          <div class="grid">
            <label>Search
              <input id="itemSearch" placeholder="Title, description, source memo" />
            </label>
            <label>Sort
              <select id="itemSort">
                <option value="updated_at_desc">Updated newest first</option>
                <option value="updated_at_asc">Updated oldest first</option>
                <option value="created_at_desc">Created newest first</option>
                <option value="created_at_asc">Created oldest first</option>
                <option value="due_date_asc">Due date soonest first</option>
                <option value="follow_up_date_asc">Follow-up date soonest first</option>
                <option value="type_asc">Type</option>
                <option value="status_asc">Status</option>
              </select>
            </label>
            <label>Type
              <select id="itemTypeFilter">
                <option value="">All types</option>
                <option value="task">task</option>
                <option value="exploration">exploration</option>
                <option value="idea">idea</option>
                <option value="reference">reference</option>
              </select>
            </label>
            <label>Status
              <select id="itemStatusFilter">
                <option value="">All statuses</option>
                <option value="ready">ready</option>
                <option value="open">open</option>
                <option value="saved">saved</option>
                <option value="waiting">waiting</option>
                <option value="in_progress">in_progress</option>
                <option value="done">done</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <label>Archived
              <select id="itemArchivedFilter">
                <option value="hide">Hide archived</option>
                <option value="show">Show archived</option>
                <option value="only">Archived only</option>
              </select>
            </label>
          </div>
          <div class="controls">
            <button id="clearItemFiltersBtn" class="secondary">Clear filters</button>
          </div>
        </div>
        <div id="items" class="stack"></div>
      </section>
    </div>
  </main>

  <script>
    const state = {
      rawText: "",
      reviewingDumpId: null,
      reviewingDump: null,
      reviewSetupDumpId: null,
      suggestions: [],
      rejected: new Set(),
      approved: new Set(),
      items: [],
      pendingDumps: [],
      memory: [],
      editingExistingForSuggestion: null,
      relatedItems: {},
      loadingRelatedItems: new Set(),
      editingItemId: null,
    };

    const $ = (id) => document.getElementById(id);
    const errorEl = $("error");
    const statusEl = $("status");
    const reviewControlsEl = $("reviewControls");
    const suggestionsEl = $("suggestions");
    const itemsEl = $("items");
    const pendingDumpsEl = $("pendingDumps");
    const memoryListEl = $("memoryList");

    $("generateBtn").addEventListener("click", () => {
      state.reviewingDumpId = null;
      state.reviewingDump = null;
      state.reviewSetupDumpId = null;
      renderReviewControls();
      renderPendingDumps();
      generateSuggestions();
    });
    $("saveLaterBtn").addEventListener("click", saveDumpForLater);
    $("addMemoryBtn").addEventListener("click", addMemoryEntry);
    $("showArchivedMemory").addEventListener("change", loadMemory);
    $("itemSearch").addEventListener("input", debounce(loadItems, 150));
    $("itemSort").addEventListener("change", loadItems);
    $("itemTypeFilter").addEventListener("change", loadItems);
    $("itemStatusFilter").addEventListener("change", loadItems);
    $("itemArchivedFilter").addEventListener("change", loadItems);
    $("clearItemFiltersBtn").addEventListener("click", clearItemFilters);

    loadItems();
    loadPendingDumps();
    loadMemory();

    async function saveDumpForLater() {
      clearError();
      const rawText = $("rawText").value.trim();
      if (!rawText) {
        showError("Enter a memo dump first.");
        return;
      }

      setBusy("Saving dump...", { disableGenerationSettings: true });
      try {
        await requestJson("/api/dumps", {
          method: "POST",
          body: { rawText },
        });
        $("rawText").value = "";
        state.rawText = "";
        state.reviewingDumpId = null;
        state.reviewingDump = null;
        state.reviewSetupDumpId = null;
        state.suggestions = [];
        state.rejected = new Set();
        state.approved = new Set();
        state.relatedItems = {};
        state.loadingRelatedItems = new Set();
        renderReviewControls();
        renderSuggestions();
        await loadPendingDumps();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    async function generateSuggestions(settings = {}) {
      clearError();
      const rawText = (settings.rawText ?? $("rawText").value).trim();
      const parser = settings.parser ?? $("parser").value;
      const useMemory = settings.useMemory ?? $("useMemory").checked;
      const useContext = settings.useContext ?? $("useContext").checked;
      if (!rawText) {
        showError("Enter a memo dump first.");
        return;
      }

      state.rawText = rawText;
      setBusy("Generating suggestions...", { disableGenerationSettings: true });
      try {
        const result = await requestJson("/api/suggestions", {
          method: "POST",
          body: { rawText, parser, useMemory, useContext },
        });
        state.suggestions = result.suggestions || [];
        state.rejected = new Set();
        state.approved = new Set();
        state.relatedItems = {};
        state.loadingRelatedItems = new Set();
        renderReviewControls();
        renderSuggestions();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    async function loadPendingDumps() {
      clearError();
      try {
        const result = await requestJson("/api/dumps");
        state.pendingDumps = (result.dumps || []).filter((dump) => dump.id !== state.reviewingDumpId);
        renderPendingDumps();
      } catch (error) {
        showError(error.message);
      }
    }

    async function loadItems() {
      clearError();
      try {
        const result = await requestJson("/api/items" + itemQueryString());
        state.items = result.items || [];
        renderItems();
      } catch (error) {
        showError(error.message);
      }
    }

    async function loadMemory() {
      clearError();
      try {
        const archived = $("showArchivedMemory").checked ? "?archived=show" : "";
        const result = await requestJson("/api/memory" + archived);
        state.memory = result.memory || [];
        renderMemory();
      } catch (error) {
        showError(error.message);
      }
    }

    async function addMemoryEntry() {
      clearError();
      const text = $("memoryText").value.trim();
      if (!text) {
        showError("Enter memory text first.");
        return;
      }

      setBusy("Saving memory...");
      try {
        await requestJson("/api/memory", {
          method: "POST",
          body: { text },
        });
        $("memoryText").value = "";
        await loadMemory();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    function renderMemory() {
      if (state.memory.length === 0) {
        memoryListEl.innerHTML = '<div class="empty">No memory entries yet.</div>';
        return;
      }

      memoryListEl.innerHTML = "";
      state.memory.forEach((entry) => {
        const card = document.createElement("div");
        card.className = "card" + (entry.archived_at ? " archived" : "");
        card.innerHTML = \`
          <div class="row-head">
            <div>
              <div class="muted">\${escapeHtml(entry.id)} · updated \${escapeHtml(entry.updated_at)}</div>
            </div>
            \${entry.archived_at ? '<span class="pill">archived</span>' : '<span class="pill">active</span>'}
          </div>
          <label>Memory text
            <textarea class="memory-edit" data-memory-text>\${escapeHtml(entry.text)}</textarea>
          </label>
          <div class="actions">
            <button class="secondary" data-action="save">Save Edit</button>
            <button class="secondary" data-action="archive" \${entry.archived_at ? "disabled" : ""}>Archive</button>
            <button class="danger" data-action="delete">Delete</button>
          </div>
        \`;
        card.querySelector('[data-action="save"]').addEventListener("click", () => updateMemoryEntry(entry.id, card));
        card.querySelector('[data-action="archive"]').addEventListener("click", () => archiveMemoryEntry(entry.id));
        card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteMemoryEntry(entry.id));
        memoryListEl.appendChild(card);
      });
    }

    async function updateMemoryEntry(id, card) {
      clearError();
      const text = card.querySelector("[data-memory-text]").value.trim();
      if (!text) {
        showError("Memory text cannot be empty.");
        return;
      }

      setBusy("Updating memory...");
      try {
        await requestJson("/api/memory/" + encodeURIComponent(id), {
          method: "PATCH",
          body: { text },
        });
        await loadMemory();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    async function archiveMemoryEntry(id) {
      clearError();
      setBusy("Archiving memory...");
      try {
        await requestJson("/api/memory/" + encodeURIComponent(id) + "/archive", {
          method: "POST",
          body: {},
        });
        await loadMemory();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    async function deleteMemoryEntry(id) {
      clearError();
      setBusy("Deleting memory...");
      try {
        await requestJson("/api/memory/" + encodeURIComponent(id), {
          method: "DELETE",
        });
        await loadMemory();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    function itemQueryString() {
      const params = new URLSearchParams();
      const query = $("itemSearch").value.trim();
      const sort = $("itemSort").value;
      const type = $("itemTypeFilter").value;
      const status = $("itemStatusFilter").value;
      const archived = $("itemArchivedFilter").value;

      if (query) params.set("query", query);
      if (sort) params.set("sort", sort);
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      if (archived) params.set("archived", archived);

      const text = params.toString();
      return text ? "?" + text : "";
    }

    function clearItemFilters() {
      $("itemSearch").value = "";
      $("itemSort").value = "updated_at_desc";
      $("itemTypeFilter").value = "";
      $("itemStatusFilter").value = "";
      $("itemArchivedFilter").value = "hide";
      loadItems();
    }

    function renderPendingDumps() {
      if (state.pendingDumps.length === 0) {
        pendingDumpsEl.innerHTML = '<div class="empty">No pending dumps.</div>';
        return;
      }

      pendingDumpsEl.innerHTML = "";
      state.pendingDumps.forEach((dump) => {
        const card = document.createElement("div");
        card.className = "card";
        const expanded = state.reviewSetupDumpId === dump.id;
        const reviewSetupHtml = expanded
          ? '<div class="card">' +
              '<div class="row-title">Review with</div>' +
              '<div class="controls">' +
                '<select data-review-parser class="parser" aria-label="Review parser">' +
                  '<option value="stub">stub</option>' +
                  '<option value="llm">llm</option>' +
                '</select>' +
                '<label class="checkbox-row">' +
                  '<input data-review-memory type="checkbox" />' +
                  'Use memory' +
                '</label>' +
                '<label class="checkbox-row">' +
                  '<input data-review-context type="checkbox" />' +
                  'Use context' +
                '</label>' +
                '<button data-action="generate-review">Generate review</button>' +
                '<button class="secondary" data-action="cancel-review-setup">Cancel</button>' +
              '</div>' +
            '</div>'
          : "";
        card.innerHTML = \`
          <div class="row-head">
            <div>
              <div class="row-title">\${escapeHtml(dump.raw_text)}</div>
              <div class="muted">\${escapeHtml(dump.id)} · saved \${escapeHtml(dump.created_at)}</div>
            </div>
            <span class="pill">\${escapeHtml(dump.status)}</span>
          </div>
          <div class="actions">
            <button data-action="review">Review now</button>
            <button class="danger" data-action="ignore">Ignore</button>
          </div>
          \${reviewSetupHtml}
        \`;
        card.querySelector('[data-action="review"]').addEventListener("click", () => showPendingReviewSetup(dump.id));
        card.querySelector('[data-action="ignore"]').addEventListener("click", () => ignorePendingDump(dump.id));
        card.querySelector('[data-action="generate-review"]')?.addEventListener("click", () => {
          const parser = card.querySelector("[data-review-parser]").value;
          const useMemory = card.querySelector("[data-review-memory]").checked;
          const useContext = card.querySelector("[data-review-context]").checked;
          startPendingDumpReview(dump, { parser, useMemory, useContext });
        });
        card.querySelector('[data-action="cancel-review-setup"]')?.addEventListener("click", () => {
          state.reviewSetupDumpId = null;
          renderPendingDumps();
        });
        pendingDumpsEl.appendChild(card);
      });
    }

    function showPendingReviewSetup(id) {
      state.reviewSetupDumpId = state.reviewSetupDumpId === id ? null : id;
      renderPendingDumps();
    }

    async function startPendingDumpReview(dump, settings) {
      $("rawText").value = dump.raw_text;
      state.reviewingDumpId = dump.id;
      state.reviewingDump = dump;
      state.reviewSetupDumpId = null;
      removePendingDumpFromView(dump.id);
      renderReviewControls();
      await generateSuggestions({
        rawText: dump.raw_text,
        parser: settings.parser,
        useMemory: settings.useMemory,
        useContext: settings.useContext,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function renderReviewControls() {
      if (!state.reviewingDump) {
        reviewControlsEl.innerHTML = "";
        return;
      }

      reviewControlsEl.innerHTML = \`
        <div class="card">
          <div class="row-head">
            <div>
              <div class="row-title">Reviewing pending dump</div>
              <div class="source">\${escapeHtml(state.reviewingDump.raw_text)}</div>
            </div>
            <span class="pill">in review</span>
          </div>
          <div class="actions">
            <button class="secondary" data-action="review-later">Review later</button>
            <button class="danger" data-action="abandon">Abandon</button>
          </div>
        </div>
      \`;
      reviewControlsEl.querySelector('[data-action="review-later"]').addEventListener("click", reviewLaterCurrentDump);
      reviewControlsEl.querySelector('[data-action="abandon"]').addEventListener("click", abandonCurrentDump);
    }

    function reviewLaterCurrentDump() {
      const dump = state.reviewingDump;
      clearCurrentReview();
      state.reviewSetupDumpId = null;
      if (dump && !state.pendingDumps.some((candidate) => candidate.id === dump.id)) {
        state.pendingDumps = [dump, ...state.pendingDumps];
      }
      renderPendingDumps();
      setStatus("Returned dump to pending review.");
    }

    async function abandonCurrentDump() {
      if (!state.reviewingDumpId) return;
      const dumpId = state.reviewingDumpId;
      clearError();
      setBusy("Abandoning review...");
      let abandoned = false;
      try {
        await requestJson("/api/dumps/" + encodeURIComponent(dumpId) + "/ignore", {
          method: "POST",
          body: {},
        });
        clearCurrentReview();
        await loadPendingDumps();
        abandoned = true;
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
      if (abandoned) setStatus("Abandoned pending dump.");
    }

    function clearCurrentReview() {
      state.reviewingDumpId = null;
      state.reviewingDump = null;
      state.reviewSetupDumpId = null;
      state.rawText = "";
      $("rawText").value = "";
      state.suggestions = [];
      state.rejected = new Set();
      state.approved = new Set();
      state.editingExistingForSuggestion = null;
      state.editingItemId = null;
      state.relatedItems = {};
      state.loadingRelatedItems = new Set();
      renderReviewControls();
      renderSuggestions();
    }

    async function ignorePendingDump(id) {
      clearError();
      setBusy("Ignoring dump...");
      try {
        await requestJson("/api/dumps/" + encodeURIComponent(id) + "/ignore", {
          method: "POST",
          body: {},
        });
        if (state.reviewingDumpId === id) {
          state.reviewingDumpId = null;
          state.reviewingDump = null;
          state.reviewSetupDumpId = null;
          renderReviewControls();
        }
        await loadPendingDumps();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    function renderSuggestions() {
      if (state.suggestions.length === 0) {
        suggestionsEl.innerHTML = '<div class="empty">No suggestions yet.</div>';
        return;
      }

      const visibleSuggestions = state.suggestions.filter((_, index) => !state.approved.has(index) && !state.rejected.has(index));
      if (visibleSuggestions.length === 0) {
        suggestionsEl.innerHTML = '<div class="empty">No suggestions left to review.</div>';
        return;
      }

      suggestionsEl.innerHTML = "";
      const relatedItemIdsToLoad = new Set();
      state.suggestions.forEach((suggestion, index) => {
        if (state.approved.has(index) || state.rejected.has(index)) return;
        const card = document.createElement("div");
        card.className = "card";
        card.dataset.index = String(index);
        const fields = suggestion.suggested_fields || {};
        const related = relatedExistingItemsFor(suggestion);
        related.forEach((item) => {
          if (!state.relatedItems[item.item_id] && !state.loadingRelatedItems.has(item.item_id)) {
            relatedItemIdsToLoad.add(item.item_id);
          }
        });
        const disabled = state.rejected.has(index) || state.approved.has(index);
        const approveLabel = related.length > 0 ? "Create new anyway" : "Approve";

        card.innerHTML = \`
          <div class="meta">
            <span class="pill">confidence \${escapeHtml(String(suggestion.confidence ?? ""))}</span>
            <span class="pill">clarify \${suggestion.needs_clarification ? "yes" : "no"}</span>
          </div>
          <div class="grid">
            <label>Type
              <select data-field="type" \${disabled ? "disabled" : ""}>
                \${typeOptions(suggestion.type)}
              </select>
            </label>
            <label>Status
              <input data-field="status" value="\${escapeAttr(suggestion.status || "")}" \${disabled ? "disabled" : ""} />
            </label>
          </div>
          <label>Title
            <input data-field="title" value="\${escapeAttr(suggestion.title || "")}" \${disabled ? "disabled" : ""} />
          </label>
          <label>Description
            <textarea data-field="description" \${disabled ? "disabled" : ""}>\${escapeHtml(suggestion.description || "")}</textarea>
          </label>
          \${suggestion.clarification_question ? '<div class="source">Clarification: ' + escapeHtml(suggestion.clarification_question) + '</div>' : ""}
          \${suggestion.missing_context?.length ? '<div class="source">Missing: ' + escapeHtml(suggestion.missing_context.join("; ")) + '</div>' : ""}
          <div class="grid">
            <label>Due date
              <input data-field="due_date" value="\${escapeAttr(fields.due_date || "")}" \${disabled ? "disabled" : ""} />
            </label>
            <label>Waiting on
              <input data-field="waiting_on" value="\${escapeAttr(fields.waiting_on || "")}" \${disabled ? "disabled" : ""} />
            </label>
            <label>Tags
              <input data-field="tags" value="\${escapeAttr((fields.tags || []).join(","))}" \${disabled ? "disabled" : ""} />
            </label>
            <label>Category
              <input data-field="category" value="\${escapeAttr(fields.category || "")}" \${disabled ? "disabled" : ""} />
            </label>
            <label>Follow up
              <select data-field="follow_up_needed" \${disabled ? "disabled" : ""}>
                <option value="" \${fields.follow_up_needed == null ? "selected" : ""}></option>
                <option value="true" \${fields.follow_up_needed === true ? "selected" : ""}>true</option>
                <option value="false" \${fields.follow_up_needed === false ? "selected" : ""}>false</option>
              </select>
            </label>
          </div>
          \${relatedExistingHtml(related)}
          \${existingItemEditorHtml(index)}
          <div class="actions">
            <button data-action="approve" \${disabled ? "disabled" : ""}>\${approveLabel}</button>
            <button class="danger" data-action="reject" \${disabled ? "disabled" : ""}>\${related.length > 0 ? "Discard" : "Reject"}</button>
            \${state.approved.has(index) ? '<span class="pill">saved</span>' : ""}
            \${state.rejected.has(index) ? '<span class="pill">rejected</span>' : ""}
          </div>
        \`;

        card.querySelector('[data-action="approve"]')?.addEventListener("click", () => approveSuggestion(index, card));
        card.querySelectorAll("[data-action='update-existing']").forEach((button) => {
          button.addEventListener("click", () => openExistingItemEditor(index, button.dataset.itemId));
        });
        card.querySelector("[data-action='save-existing']")?.addEventListener("click", () => saveExistingItemInstead(index, card));
        card.querySelector("[data-action='cancel-existing']")?.addEventListener("click", () => {
          state.editingExistingForSuggestion = null;
          renderSuggestions();
        });
        card.querySelector('[data-action="reject"]')?.addEventListener("click", () => {
          state.rejected.add(index);
          state.editingExistingForSuggestion = null;
          maybeMarkReviewComplete()
            .then(() => renderSuggestions())
            .catch((error) => showError(error.message));
        });
        suggestionsEl.appendChild(card);
      });

      if (relatedItemIdsToLoad.size > 0) {
        loadRelatedItems([...relatedItemIdsToLoad]);
      }
    }

    function relatedExistingItemsFor(suggestion) {
      return (suggestion.related_existing_items || [])
        .slice()
        .sort((left, right) => (right.confidence || 0) - (left.confidence || 0))
        .slice(0, 3);
    }

    function relatedExistingHtml(related) {
      if (related.length === 0) return "";

      return '<div class="card">' +
        '<div class="row-title">Looks related to existing item</div>' +
        related.map((item) => {
          const existingItem = state.relatedItems[item.item_id];
          const itemTitle = existingItem?.title || "Loading existing item...";
          return (
          '<div class="source">' +
            '<strong>' + escapeHtml(itemTitle) + '</strong> · ' +
            escapeHtml(item.relationship) + ' · confidence ' + escapeHtml(String(item.confidence ?? "")) +
            '<br />' + escapeHtml(item.reason || "") +
            '<div class="actions">' +
              '<button class="secondary" data-action="update-existing" data-item-id="' + escapeAttr(item.item_id) + '">Update existing instead</button>' +
            '</div>' +
          '</div>'
          );
        }).join("") +
      '</div>';
    }

    async function loadRelatedItems(itemIds) {
      const uniqueIds = itemIds.filter((id) => id && !state.relatedItems[id] && !state.loadingRelatedItems.has(id));
      if (uniqueIds.length === 0) return;

      uniqueIds.forEach((id) => state.loadingRelatedItems.add(id));
      try {
        const items = await Promise.all(uniqueIds.map((id) =>
          requestJson("/api/items/" + encodeURIComponent(id)).catch(() => null)
        ));
        let changed = false;
        items.forEach((item) => {
          if (!item?.id) return;
          state.relatedItems[item.id] = item;
          changed = true;
        });
        if (changed) renderSuggestions();
      } finally {
        uniqueIds.forEach((id) => state.loadingRelatedItems.delete(id));
      }
    }

    function existingItemEditorHtml(index) {
      const edit = state.editingExistingForSuggestion;
      if (!edit || edit.suggestionIndex !== index || !edit.item) return "";

      const item = edit.item;
      return '<div class="card">' +
        '<div class="row-title">Update existing item manually</div>' +
        '<div class="source">No new item will be created. Use the suggestion/raw dump as reference and edit the existing item yourself.</div>' +
        '<div class="grid">' +
          '<label>Type<select data-existing-field="type">' + itemTypeOptions(item.type) + '</select></label>' +
          '<label>Status<input data-existing-field="status" value="' + escapeAttr(item.status || "") + '" /></label>' +
        '</div>' +
        '<label>Title<input data-existing-field="title" value="' + escapeAttr(item.title || "") + '" /></label>' +
        '<label>Description<textarea data-existing-field="description">' + escapeHtml(item.description || "") + '</textarea></label>' +
        '<div class="grid">' +
          '<label>Due date<input data-existing-field="due_date" value="' + escapeAttr(item.fields?.due_date || "") + '" /></label>' +
          '<label>Follow-up date<input data-existing-field="follow_up_date" value="' + escapeAttr(item.fields?.follow_up_date || "") + '" /></label>' +
          '<label>Waiting on<input data-existing-field="waiting_on" value="' + escapeAttr(item.fields?.waiting_on || "") + '" /></label>' +
          '<label>Category<input data-existing-field="category" value="' + escapeAttr(item.fields?.category || "") + '" /></label>' +
        '</div>' +
        '<div class="actions">' +
          '<button data-action="save-existing">Save existing item</button>' +
          '<button class="secondary" data-action="cancel-existing">Cancel</button>' +
        '</div>' +
      '</div>';
    }

    async function openExistingItemEditor(index, itemId) {
      clearError();
      setBusy("Loading existing item...");
      try {
        const item = await requestJson("/api/items/" + encodeURIComponent(itemId));
        if (item?.id) state.relatedItems[item.id] = item;
        state.editingExistingForSuggestion = { suggestionIndex: index, item };
        renderSuggestions();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    async function saveExistingItemInstead(index, card) {
      const edit = state.editingExistingForSuggestion;
      if (!edit || edit.suggestionIndex !== index || !edit.item) return;

      clearError();
      setBusy("Updating existing item...");
      try {
        await requestJson("/api/items/" + encodeURIComponent(edit.item.id), {
          method: "PATCH",
          body: readExistingItemPatch(card),
        });
        state.rejected.add(index);
        state.editingExistingForSuggestion = null;
        await loadItems();
        await maybeMarkReviewComplete();
        renderSuggestions();
        setStatus("Updated existing item.");
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    function readExistingItemPatch(card) {
      const value = (field) => card.querySelector('[data-existing-field="' + field + '"]')?.value?.trim() || "";
      return {
        type: value("type") || undefined,
        title: value("title") || undefined,
        description: value("description") || "",
        status: value("status") || undefined,
        fields: {
          due_date: value("due_date") || null,
          follow_up_date: value("follow_up_date") || null,
          waiting_on: value("waiting_on") || null,
          category: value("category") || null,
        },
      };
    }

    async function approveSuggestion(index, card) {
      clearError();
      const original = state.suggestions[index];
      const overrides = readOverrides(card, original);
      const approveButton = card.querySelector('[data-action="approve"]');
      if (approveButton) {
        approveButton.disabled = true;
        approveButton.textContent = "Saving...";
      }
      setBusy("Saving item...");
      let savedTitle = "";
      try {
        const item = await requestJson("/api/items", {
          method: "POST",
          body: {
            rawText: state.rawText,
            suggestion: original,
            overrides,
          },
        });
        savedTitle = item.title || overrides.title || original.title || "item";
        state.approved.add(index);
        renderSuggestions();
        setStatus("Saved item: " + savedTitle);
        try {
          await loadItems();
          await maybeMarkReviewComplete();
        } catch (error) {
          showError("Item was saved, but the pending dump could not be marked reviewed: " + (error instanceof Error ? error.message : String(error)));
        }
        renderSuggestions();
      } catch (error) {
        if (approveButton) {
          approveButton.disabled = false;
          approveButton.textContent = "Approve";
        }
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    function readOverrides(card, original) {
      const value = (field) => card.querySelector('[data-field="' + field + '"]')?.value?.trim() || "";
      const type = value("type");
      const tags = value("tags");
      const followUp = value("follow_up_needed");
      return {
        type: type || undefined,
        title: value("title") || original.title,
        description: value("description") || undefined,
        status: value("status") || undefined,
        fields: {
          due_date: value("due_date") || null,
          waiting_on: value("waiting_on") || null,
          tags: tags ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : null,
          category: value("category") || null,
          follow_up_needed: followUp === "" ? null : followUp === "true",
        },
      };
    }

    async function maybeMarkReviewComplete() {
      if (!state.reviewingDumpId || state.suggestions.length === 0) return;

      const complete = state.suggestions.every((_, index) =>
        state.approved.has(index) || state.rejected.has(index)
      );
      if (!complete) return;

      await markCurrentDumpReviewed();
    }

    async function markCurrentDumpReviewed() {
      if (!state.reviewingDumpId) return;
      const dumpId = state.reviewingDumpId;
      removePendingDumpFromView(dumpId);
      try {
        await requestJson("/api/dumps/" + encodeURIComponent(dumpId) + "/reviewed", {
          method: "POST",
          body: {},
        });
        state.reviewingDumpId = null;
        state.reviewingDump = null;
        renderReviewControls();
        await loadPendingDumps();
      } catch (error) {
        state.reviewingDumpId = null;
        state.reviewingDump = null;
        renderReviewControls();
        await loadPendingDumps();
        throw error;
      }
    }

    function removePendingDumpFromView(id) {
      state.pendingDumps = state.pendingDumps.filter((dump) => dump.id !== id);
      renderPendingDumps();
    }

    function renderItems() {
      if (state.items.length === 0) {
        itemsEl.innerHTML = '<div class="empty">No saved items yet.</div>';
        return;
      }

      itemsEl.innerHTML = "";
      state.items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card" + (item.archived_at ? " archived" : "");
        const sourceMemo = item.source?.raw_text || "";
        const isEditing = state.editingItemId === item.id;
        card.innerHTML = \`
          <div class="row-head">
            <div>
              <div class="row-title">\${escapeHtml(item.title)}</div>
              <div class="muted">\${escapeHtml(item.type)} · updated \${escapeHtml(item.updated_at)}</div>
            </div>
            <span class="pill">\${escapeHtml(displayItemStatus(item.status))}</span>
          </div>
          \${item.description ? '<div>' + escapeHtml(item.description) + '</div>' : ""}
          \${sourceMemo ? '<div class="source">Source memo: ' + escapeHtml(sourceMemo) + '</div>' : ""}
          \${isEditing ? ledgerItemEditorHtml(item) : ""}
          <div class="actions">
            <select data-item-status>
              \${statusOptions(item.status)}
            </select>
            <button class="secondary" data-action="status">Update Status</button>
            <button class="secondary" data-action="edit">\${isEditing ? "Close edit" : "Edit"}</button>
            <button class="danger" data-action="archive">Archive</button>
          </div>
        \`;
        card.querySelector('[data-action="status"]').addEventListener("click", () => updateItemStatus(item.id, card));
        card.querySelector('[data-action="edit"]').addEventListener("click", () => {
          state.editingItemId = state.editingItemId === item.id ? null : item.id;
          renderItems();
        });
        card.querySelector('[data-action="save-edit"]')?.addEventListener("click", () => saveLedgerItemEdit(item.id, card));
        card.querySelector('[data-action="cancel-edit"]')?.addEventListener("click", () => {
          state.editingItemId = null;
          renderItems();
        });
        card.querySelector('[data-action="archive"]').addEventListener("click", () => archiveItem(item.id));
        itemsEl.appendChild(card);
      });
    }

    function ledgerItemEditorHtml(item) {
      return '<div class="card">' +
        '<div class="row-title">Edit item</div>' +
        '<div class="grid">' +
          '<label>Type<select data-ledger-field="type">' + itemTypeOptions(item.type) + '</select></label>' +
          '<label>Status<input data-ledger-field="status" value="' + escapeAttr(item.status || "") + '" /></label>' +
        '</div>' +
        '<label>Title<input data-ledger-field="title" value="' + escapeAttr(item.title || "") + '" /></label>' +
        '<label>Description<textarea data-ledger-field="description">' + escapeHtml(item.description || "") + '</textarea></label>' +
        '<div class="grid">' +
          '<label>Due date<input data-ledger-field="due_date" value="' + escapeAttr(item.fields?.due_date || "") + '" /></label>' +
          '<label>Follow-up date<input data-ledger-field="follow_up_date" value="' + escapeAttr(item.fields?.follow_up_date || "") + '" /></label>' +
        '</div>' +
        '<div class="actions">' +
          '<button data-action="save-edit">Save edit</button>' +
          '<button class="secondary" data-action="cancel-edit">Cancel</button>' +
        '</div>' +
      '</div>';
    }

    async function saveLedgerItemEdit(id, card) {
      clearError();
      setBusy("Saving item edit...");
      try {
        await requestJson("/api/items/" + encodeURIComponent(id), {
          method: "PATCH",
          body: readLedgerItemPatch(card),
        });
        state.editingItemId = null;
        await loadItems();
        setStatus("Updated item.");
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    function readLedgerItemPatch(card) {
      const value = (field) => card.querySelector('[data-ledger-field="' + field + '"]')?.value?.trim() || "";
      return {
        type: value("type") || undefined,
        title: value("title") || undefined,
        description: value("description") || "",
        status: value("status") || undefined,
        due_date: value("due_date") || null,
        follow_up_date: value("follow_up_date") || null,
      };
    }

    async function updateItemStatus(id, card) {
      clearError();
      const status = card.querySelector("[data-item-status]").value;
      setBusy("Updating item...");
      try {
        await requestJson("/api/items/" + encodeURIComponent(id), {
          method: "PATCH",
          body: { status },
        });
        await loadItems();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    async function archiveItem(id) {
      clearError();
      setBusy("Archiving item...");
      try {
        await requestJson("/api/items/" + encodeURIComponent(id) + "/archive", {
          method: "POST",
          body: {},
        });
        await loadItems();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    async function requestJson(url, options = {}) {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: options.body ? { "Content-Type": "application/json" } : {},
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(payload.error || "Request failed");
      }
      return payload;
    }

    function setBusy(message, options = {}) {
      statusEl.textContent = message;
      $("generateBtn").disabled = Boolean(message);
      $("saveLaterBtn").disabled = Boolean(message);
      $("addMemoryBtn").disabled = Boolean(message);
      $("parser").disabled = Boolean(options.disableGenerationSettings);
      $("useMemory").disabled = Boolean(options.disableGenerationSettings);
      $("useContext").disabled = Boolean(options.disableGenerationSettings);
      $("generationSettings").classList.toggle("disabled", Boolean(options.disableGenerationSettings));
    }

    function setStatus(message) {
      statusEl.textContent = message;
    }

    function showError(message) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
    }

    function clearError() {
      errorEl.textContent = "";
      errorEl.style.display = "none";
    }

    function typeOptions(current) {
      return ["task", "exploration", "idea", "reference", "clarify_needed"].map((type) =>
        '<option value="' + type + '" ' + (type === current ? "selected" : "") + '>' + type + '</option>'
      ).join("");
    }

    function itemTypeOptions(current) {
      return ["task", "exploration", "idea", "reference"].map((type) =>
        '<option value="' + type + '" ' + (type === current ? "selected" : "") + '>' + type + '</option>'
      ).join("");
    }

    function statusOptions(current) {
      const statuses = ["ready", "open", "saved", "waiting", "in_progress", "done", "archived"];
      if (!statuses.includes(current)) statuses.unshift(current);
      return statuses.map((status) =>
        '<option value="' + escapeAttr(status) + '" ' + (status === current ? "selected" : "") + '>' + escapeHtml(status) + '</option>'
      ).join("");
    }

    function displayItemStatus(status) {
      return ["ready", "open", "saved"].includes(status) ? "ready" : status;
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[char]));
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/\\n/g, " ");
    }

    function debounce(fn, delay) {
      let timeout = null;
      return (...args) => {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(() => fn(...args), delay);
      };
    }
  </script>
</body>
</html>`;

import "dotenv/config";

import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import { createSuggestionsFromDump } from "./services/suggestionService.js";
import { add, archive, get, list, unarchive, update } from "./services/itemStoreService.js";
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
import { saveReviewedSuggestion } from "./services/reviewedSuggestionSaveService.js";
import { getUiStrings, serializeUiStringsForInlineScript } from "./i18n/uiStrings.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";
const CV_ROUTE = "/assets/carol-wang-cv-062026-webapp.pdf";
const CV_PATH = join(process.cwd(), "public", "carol-wang-cv-062026-webapp.pdf");
const STATIC_ASSET_ROUTES: Record<string, { filePath: string; contentType: string; cacheControl?: string }> = {
  "/manifest.webmanifest": {
    filePath: join(process.cwd(), "public", "manifest.webmanifest"),
    contentType: "application/manifest+json; charset=utf-8",
    cacheControl: "no-cache",
  },
  "/sw.js": {
    filePath: join(process.cwd(), "public", "sw.js"),
    contentType: "application/javascript; charset=utf-8",
    cacheControl: "no-cache",
  },
  "/icons/icon.svg": {
    filePath: join(process.cwd(), "public", "icons", "icon.svg"),
    contentType: "image/svg+xml",
    cacheControl: "public, max-age=604800",
  },
  "/icons/icon-192.png": {
    filePath: join(process.cwd(), "public", "icons", "icon-192.png"),
    contentType: "image/png",
    cacheControl: "public, max-age=604800",
  },
  "/icons/icon-512.png": {
    filePath: join(process.cwd(), "public", "icons", "icon-512.png"),
    contentType: "image/png",
    cacheControl: "public, max-age=604800",
  },
  "/icons/apple-touch-icon-180.png": {
    filePath: join(process.cwd(), "public", "icons", "apple-touch-icon-180.png"),
    contentType: "image/png",
    cacheControl: "public, max-age=604800",
  },
};

const GenerateSuggestionsRequestSchema = z.object({
  rawText: z.string().trim().min(1, "rawText is required"),
  parser: z.enum(["stub", "llm"]).optional().default("llm"),
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
  reviewContext: z.object({
    source: z.enum(["pending_review", "suggestion_review", "cli_review"]),
    proposalId: z.string().min(1).optional(),
    dumpId: z.string().min(1).optional(),
  }).optional(),
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

    if ((req.method === "GET" || req.method === "HEAD") && req.url && STATIC_ASSET_ROUTES[req.url]) {
      const asset = STATIC_ASSET_ROUTES[req.url]!;
      const file = await readFile(asset.filePath);
      sendStaticFile(res, file, {
        contentType: asset.contentType,
        cacheControl: asset.cacheControl,
        headOnly: req.method === "HEAD",
      });
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
      const { item } = await saveReviewedSuggestion({
        rawText: body.rawText,
        suggestion: body.suggestion,
        overrides: body.overrides,
        reviewContext: body.reviewContext,
      });
      sendJson(res, 201, item);
      return;
    }

    const archiveMatch = req.url?.match(/^\/api\/items\/([^/]+)\/archive$/);
    if (req.method === "POST" && archiveMatch?.[1]) {
      const item = await archive(decodeURIComponent(archiveMatch[1]));
      sendJson(res, 200, item);
      return;
    }

    const unarchiveMatch = req.url?.match(/^\/api\/items\/([^/]+)\/unarchive$/);
    if (req.method === "POST" && unarchiveMatch?.[1]) {
      const item = await unarchive(decodeURIComponent(unarchiveMatch[1]));
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

function sendStaticFile(
  res: ServerResponse,
  file: Buffer,
  options: { contentType: string; cacheControl?: string; headOnly?: boolean },
): void {
  res.writeHead(200, {
    "Content-Type": options.contentType,
    "Content-Length": String(file.byteLength),
    "Cache-Control": options.cacheControl ?? "no-cache",
  });
  res.end(options.headOnly ? undefined : file);
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

const ui = getUiStrings();
const uiJson = serializeUiStringsForInlineScript();

const APP_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#f8f9ff" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="MemoFlow" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="format-detection" content="telephone=no" />
  <meta name="description" content="${ui.appMetaDescription}" />
  <title>${ui.appTitleLocal}</title>
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: light;
      --bg: #f8f9ff;
      --ink: #121c28;
      --muted: #424845;
      --line: #E8EDEB;
      --panel: #ffffff;
      --accent: #4e6058;
      --accent-2: #334f8d;
      --danger: #ba1a1a;
      --danger-bg: #ffdad6;
      --danger-text: #93000a;
      --surface-low: #eef4ff;
      --surface-mid: #e5eeff;
      --shadow: 0px 4px 20px rgba(0, 0, 0, 0.04);
      --radius-card: 12px;
      --radius-btn: 8px;
      --radius-input: 8px;
      --radius-pill: 9999px;
      --font-headline: 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif;
      --font-body: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    }

    html {
      max-width: 100%;
      overflow-x: hidden;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    body, #root {
      max-width: 100%;
      overflow-x: hidden;
    }
    * { box-sizing: border-box; margin: 0; }
    body {
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font-body);
      font-size: 16px;
      line-height: 1.5;
      min-height: 100vh;
    }
    main {
      width: min(1200px, 100%);
      max-width: calc(100% - 64px);
      margin: 0 auto;
      padding: 32px 0 64px;
    }
    header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--line);
    }
    h1 {
      font-family: var(--font-headline);
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--accent);
    }
    h2 {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      opacity: 0.7;
      margin-bottom: 12px;
    }
    .muted {
      color: var(--muted);
      font-size: 13px;
      opacity: 0.6;
    }
    .contact-block {
      display: grid;
      justify-items: end;
      gap: 8px;
      max-width: 420px;
      text-align: right;
    }
    .contact-title {
      font-size: 13px;
      color: var(--muted);
      opacity: 0.7;
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
      min-height: 36px;
      min-width: 44px;
      border: 1px solid var(--line);
      border-radius: var(--radius-btn);
      background: var(--panel);
      color: var(--accent-2);
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      padding: 8px 12px;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .icon-link:hover {
      border-color: var(--surface-mid);
      background: var(--surface-low);
    }
    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(380px, 0.9fr);
      gap: 24px;
      align-items: start;
    }
    section {
      min-width: 0;
    }
    .band {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-card);
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }
    .band.dump-band {
      background: var(--surface-low);
      border-color: #dde8f0;
    }
    textarea, input, select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: var(--radius-input);
      background: var(--panel);
      color: var(--ink);
      font-family: var(--font-body);
      font-size: 16px;
      padding: 10px 12px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      min-width: 0;
      max-width: 100%;
    }
    textarea:focus, input:focus, select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
    }
    textarea {
      min-height: 120px;
      resize: vertical;
    }
    input[type="date"] {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      display: block;
    }
    label {
      display: grid;
      gap: 4px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      min-width: 0;
    }
    button {
      border: none;
      border-radius: var(--radius-btn);
      background: var(--accent);
      color: #fff;
      font-family: var(--font-body);
      font-size: 15px;
      font-weight: 500;
      padding: 10px 16px;
      min-height: 40px;
      cursor: pointer;
      transition: opacity 0.15s ease, transform 0.1s ease;
    }
    button:hover { opacity: 0.88; }
    button:active { transform: scale(0.98); }
    button.secondary {
      background: var(--panel);
      color: var(--accent);
      border: 1px solid var(--line);
    }
    button.secondary:hover {
      background: var(--surface-low);
    }
    button.danger {
      background: var(--panel);
      color: var(--danger);
      border: 1px solid var(--danger-bg);
    }
    button.danger:hover {
      background: var(--danger-bg);
    }
    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }
    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 12px;
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
      opacity: 0.4;
    }
    .checkbox-row {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
    }
    .checkbox-row input {
      width: auto;
      margin: 0;
    }
    .memory-input {
      min-height: 70px;
    }
    .memory-edit {
      min-height: 78px;
    }
    .stack {
      display: grid;
      gap: 10px;
      min-width: 0;
      max-width: 100%;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-card);
      padding: 18px;
      box-shadow: var(--shadow);
      transition: box-shadow 0.25s ease;
    }
    .card.archived {
      opacity: 0.55;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .meta {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .pill {
      border: none;
      border-radius: var(--radius-pill);
      padding: 3px 10px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      background: var(--surface-mid);
    }
    .pill.status-active {
      background: #d4e7dd;
      color: #2d4a3e;
    }
    .pill.status-waiting {
      background: #e5e0d4;
      color: #5a4d2e;
    }
    .pill.status-done {
      background: var(--surface-mid);
      color: var(--muted);
      opacity: 0.7;
    }
    .error {
      display: none;
      border: 1px solid var(--danger-bg);
      background: var(--danger-bg);
      color: var(--danger-text);
      border-radius: var(--radius-btn);
      padding: 12px 16px;
      margin-bottom: 16px;
      font-size: 14px;
      white-space: pre-wrap;
    }
    .empty {
      color: var(--muted);
      border: 1px dashed var(--line);
      border-radius: var(--radius-card);
      padding: 24px;
      background: var(--surface-low);
      font-size: 14px;
      opacity: 0.7;
    }
    .row-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
      margin-bottom: 8px;
    }
    .row-title {
      font-weight: 600;
      font-size: 15px;
      overflow-wrap: anywhere;
      color: var(--ink);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .source {
      font-size: 12px;
      color: var(--muted);
      opacity: 0.6;
      margin-top: 8px;
      overflow-wrap: anywhere;
    }
    @media (max-width: 900px) {
      main { width: min(740px, 100%); max-width: calc(100% - 32px); padding: 24px 0 48px; }
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
    /* ===== Sidebar Layout ===== */
    .app-layout {
      display: flex;
      min-height: 100vh;
    }
    .sidebar {
      width: 220px;
      min-width: 220px;
      background: var(--panel);
      border-right: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      padding: 24px 0;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }
    .sidebar-header {
      padding: 0 20px 20px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 12px;
    }
    .sidebar-brand {
      font-family: var(--font-headline);
      font-size: 24px;
      font-weight: 600;
      color: var(--accent);
      letter-spacing: -0.01em;
    }
    .sidebar-subtitle {
      font-size: 13px;
      color: var(--muted);
      opacity: 0.6;
      margin-top: 4px;
    }
    .sidebar-nav {
      list-style: none;
      padding: 4px 12px;
      margin: 0;
      flex: 1;
    }
    .sidebar-nav li {
      padding: 10px 12px;
      border-radius: var(--radius-btn);
      font-size: 14px;
      font-weight: 500;
      color: var(--muted);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-icon {
      width: 20px;
      height: 20px;
      display: inline-block;
      flex-shrink: 0;
      font-size: 0;
      line-height: 0;
      color: currentColor;
      position: relative;
    }
    .nav-icon::before {
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      background: currentColor;
      mask-repeat: no-repeat;
      mask-position: center;
      mask-size: contain;
      -webkit-mask-repeat: no-repeat;
      -webkit-mask-position: center;
      -webkit-mask-size: contain;
    }
    .nav-label {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .sidebar-nav li[data-view="capture"] .nav-icon::before {
      mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8v8\"/><path d=\"M8 12h8\"/></svg>');
      -webkit-mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8v8\"/><path d=\"M8 12h8\"/></svg>');
    }
    .sidebar-nav li[data-view="items"] .nav-icon::before {
      mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6h11\"/><path d=\"M9 12h11\"/><path d=\"M9 18h11\"/><path d=\"M4 6h.01\"/><path d=\"M4 12h.01\"/><path d=\"M4 18h.01\"/></svg>');
      -webkit-mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6h11\"/><path d=\"M9 12h11\"/><path d=\"M9 18h11\"/><path d=\"M4 6h.01\"/><path d=\"M4 12h.01\"/><path d=\"M4 18h.01\"/></svg>');
    }
    .sidebar-nav li[data-view="memory"] .nav-icon::before {
      mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3a3 3 0 0 0-3 3v1.2a3.5 3.5 0 0 1-1.03 2.47L6.2 11.44A3 3 0 0 0 8.32 16h7.36a3 3 0 0 0 2.12-5.12l-1.77-1.77A3.5 3.5 0 0 1 15 7.64V6a3 3 0 0 0-3-3Z\"/><path d=\"M9.5 16a2.5 2.5 0 0 0 5 0\"/></svg>');
      -webkit-mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3a3 3 0 0 0-3 3v1.2a3.5 3.5 0 0 1-1.03 2.47L6.2 11.44A3 3 0 0 0 8.32 16h7.36a3 3 0 0 0 2.12-5.12l-1.77-1.77A3.5 3.5 0 0 1 15 7.64V6a3 3 0 0 0-3-3Z\"/><path d=\"M9.5 16a2.5 2.5 0 0 0 5 0\"/></svg>');
    }
    .sidebar-nav li[data-view="pending"] .nav-icon::before {
      mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 5h16v14H4z\"/><path d=\"M8 9h8\"/><path d=\"M8 13h8\"/></svg>');
      -webkit-mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 5h16v14H4z\"/><path d=\"M8 9h8\"/><path d=\"M8 13h8\"/></svg>');
    }
    .sidebar-nav li:hover {
      background: var(--surface-low);
      color: var(--ink);
    }
    .sidebar-nav li.active {
      background: var(--surface-mid);
      color: var(--ink);
      font-weight: 600;
    }
    .badge {
      display: none;
      font-size: 11px;
      font-weight: 600;
      background: var(--accent);
      color: #fff;
      border-radius: var(--radius-pill);
      padding: 1px 7px;
      min-width: 18px;
      text-align: center;
    }
    .sidebar-footer {
      padding: 16px 20px 0;
      border-top: 1px solid var(--line);
    }
    .sidebar-link {
      display: block;
      font-size: 13px;
      color: var(--accent-2);
      text-decoration: none;
      padding: 6px 0;
    }
    .sidebar-link:hover { text-decoration: underline; }
    .sidebar-contact {
      margin-top: 12px;
    }
    .sidebar-contact-text {
      font-size: 11px;
      color: var(--muted);
      opacity: 0.6;
      line-height: 1.4;
    }
    .sidebar-contact-links {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }
    .sidebar-contact-links a {
      font-size: 12px;
      color: var(--accent-2);
      text-decoration: none;
      padding: 3px 8px;
      border: 1px solid var(--line);
      border-radius: 4px;
    }
    .sidebar-contact-links a:hover {
      background: var(--surface-low);
    }

    /* ===== Main Content Override ===== */
    main.main-content {
      width: auto;
      margin: 0;
      padding: 32px 40px 64px;
      max-width: none;
      flex: 1;
      min-width: 0;
    }

    /* ===== View Switching ===== */
    .view { display: none; }
    .view.active { display: block; }
    .view {
      min-width: 0;
      max-width: 100%;
    }

    /* ===== Status Bar ===== */
    .status-bar {
      min-height: 20px;
      margin-bottom: 8px;
    }
    .status-bar span {
      font-size: 13px;
      color: var(--muted);
      opacity: 0.7;
    }

    /* ===== View Header ===== */
    .view-header {
      margin-bottom: 18px;
    }
    .view-title {
      font-family: var(--font-headline);
      font-size: 20px;
      font-weight: 600;
      color: var(--ink);
      letter-spacing: -0.01em;
    }

    /* ===== Capture Area (warm post-it feel) ===== */
    .capture-area {
      background: #fef9ef;
      border: 1px solid #f0e8d4;
      border-radius: var(--radius-card);
      padding: 20px;
      margin-bottom: 20px;
    }
    .capture-label {
      font-family: var(--font-headline);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--accent);
      opacity: 0.7;
      margin-bottom: 10px;
    }

    /* ===== Filter Bar ===== */
    .filter-bar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-bottom: 20px;
      min-width: 0;
      max-width: 100%;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 10px;
    }
    .filter-bar > * { min-width: 0; max-width: 100%; }
    .items-search-shell {
      margin-bottom: 12px;
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 10px;
      box-shadow: var(--shadow);
    }
    .items-chip-strip {
      display: none;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      padding-right: calc(16px + env(safe-area-inset-right));
      margin-bottom: 12px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .items-chip-strip::-webkit-scrollbar {
      display: none;
    }
    .filter-chip {
      border: 1px solid var(--line);
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.9);
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      padding: 10px 14px;
      white-space: nowrap;
    }
    .filter-chip.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .mobile-filter-details {
      margin-bottom: 20px;
    }
    .mobile-filter-details > summary {
      display: none;
    }
    .filter-search {
      width: 200px;
      min-width: 140px;
    }
    .filter-select {
      width: auto;
      min-width: 100px;
    }

    /* ===== Memory Input Area ===== */
    .memory-input-area {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-card);
      padding: 16px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }
    .memory-row-text {
      display: block;
      font-size: 16px;
      line-height: 1.5;
      min-width: 0;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    /* ===== Compact Rows ===== */
    .compact-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 16px;
      gap: 8px;
      transition: background 0.15s ease;
      max-width: 100%;
      min-width: 0;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: var(--shadow);
    }
    .compact-row:hover {
      background: var(--surface-low);
    }
    .compact-row.archived {
      opacity: 0.5;
    }
    .compact-row-main {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      flex: 1;
      min-width: 0;
      max-width: 100%;
    }
    .compact-row-text {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      color: var(--ink);
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .compact-row-title {
      flex: 1;
      min-width: 0;
      font-weight: 600;
      font-size: 17px;
      line-height: 1.32;
      color: var(--ink);
      max-width: 100%;
      white-space: normal;
      overflow-wrap: break-word;
      word-break: break-word;
      text-align: left;
    }
    .compact-row-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 1;
      flex-wrap: wrap;
      min-width: 0;
      max-width: 100%;
      justify-content: flex-start;
    }
    .compact-row-date {
      font-size: 12px;
      color: var(--muted);
      opacity: 0.6;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .compact-row-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
      opacity: 0.75;
      transition: opacity 0.15s ease;
      flex-wrap: wrap;
      min-width: 0;
      max-width: 100%;
    }
    .compact-row-action-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-width: 0;
      margin-right: auto;
    }
    .compact-row:hover .compact-row-actions {
      opacity: 1;
    }
    .compact-row-editor {
      width: 100%;
      padding: 12px 0 4px 0;
    }
    .compact-row-editor .card {
      margin-top: 8px;
    }
    .compact-row-editor-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .review-setup-panel {
      width: 100%;
      padding: 12px 0 4px 0;
    }
    .review-setup-panel .card {
      margin-top: 8px;
    }
    .suggestion-card {
      padding: 14px;
    }
    .suggestion-primary-grid,
    .suggestion-secondary-grid {
      min-width: 0;
    }
    .suggestion-secondary-grid {
      background: rgba(238, 244, 255, 0.72);
      border: 1px solid #dde8f0;
      border-radius: 14px;
      padding: 12px;
      margin-top: 12px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      overflow: hidden;
    }
    .suggestion-secondary-grid label {
      color: var(--muted);
      opacity: 0.9;
      font-size: 13px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
    }
    .suggestion-secondary-grid input,
    .suggestion-secondary-grid select {
      width: 100%;
      max-width: 100%;
      min-width: 0;
    }
    .suggestion-card .row-title {
      font-size: 18px;
      line-height: 1.32;
    }
    .suggestion-card [data-field="title"] {
      font-size: 18px;
      line-height: 1.32;
      font-weight: 600;
    }
    .suggestion-card .actions {
      margin-top: 16px;
    }

    /* ===== Type Chip ===== */
    .type-chip {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--accent);
      background: var(--surface-mid);
      border-radius: var(--radius-pill);
      padding: 2px 8px;
      flex-shrink: 0;
    }

    /* ===== Subtle Button (replaces danger) ===== */
    button.subtle-btn, .subtle-btn {
      border: 1px solid var(--line);
      border-radius: var(--radius-btn);
      background: transparent;
      color: var(--muted);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      padding: 5px 10px;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      min-height: unset;
    }
    button.subtle-btn:hover, .subtle-btn:hover {
      background: var(--surface-low);
      color: var(--ink);
    }

    /* ===== Responsive ===== */
    @media (max-width: 900px) {
      .app-layout { flex-direction: column; }
      .sidebar {
        width: 100%;
        min-width: unset;
        height: auto;
        position: static;
        flex-direction: column;
        flex-wrap: nowrap;
        align-items: stretch;
        padding: 0;
        gap: 0;
        overflow-x: hidden;
        background: transparent;
        border-right: none;
      }
      .sidebar-header {
        position: sticky;
        top: 0;
        z-index: 60;
        padding: calc(10px + env(safe-area-inset-top)) 16px 10px;
        border-bottom: 1px solid var(--line);
        margin-bottom: 0;
        min-width: 0;
        background: rgba(248, 249, 255, 0.92);
        backdrop-filter: blur(12px);
      }
      .sidebar-subtitle { display: none; }
      .sidebar-nav {
        display: flex;
        gap: 2px;
        padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
        flex: unset;
        flex-wrap: nowrap;
        width: auto;
        min-width: 0;
        overflow: visible;
        background: rgba(229, 238, 255, 0.75);
        border-top: 1px solid var(--line);
        border-radius: 20px 20px 0 0;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 70;
        justify-content: space-around;
        box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.06);
        backdrop-filter: blur(12px);
      }
      .sidebar-nav li {
        flex: 1 1 0;
        min-width: 0;
        white-space: normal;
        font-size: 12px;
        padding: 8px 6px;
        margin-bottom: 0;
        border-radius: 14px;
        flex-direction: column;
        justify-content: center;
        text-align: center;
        gap: 4px;
        position: relative;
      }
      .sidebar-nav li.active {
        background: var(--primary-fixed);
      }
      .nav-icon {
        width: 22px;
        height: 22px;
      }
      .nav-label {
        font-size: 12px;
        line-height: 1.15;
      }
      .badge {
        position: absolute;
        top: 4px;
        right: 14px;
      }
      .sidebar-footer { display: none; }
      main.main-content {
        padding:
          12px
          calc(16px + env(safe-area-inset-right))
          calc(120px + env(safe-area-inset-bottom))
          calc(16px + env(safe-area-inset-left));
      }
      .status-bar {
        min-height: 0;
        margin-bottom: 4px;
      }
      .items-chip-strip {
        display: flex;
      }
      .items-search-shell {
        padding: 8px 10px;
      }
      .mobile-filter-details > summary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        list-style: none;
        cursor: pointer;
        border: 1px solid var(--line);
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.9);
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
        padding: 10px 14px;
        margin-bottom: 10px;
      }
      .mobile-filter-details[open] > summary {
        margin-bottom: 10px;
      }
      .filter-bar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: stretch;
        gap: 8px;
        margin-bottom: 0;
      }
      .filter-search {
        width: 100%;
        grid-column: 1 / -1;
      }
      .filter-select {
        width: 100%;
        min-width: 0;
      }
    }

    @media (max-width: 600px) {
      .capture-area {
        padding: 16px;
      }
      .capture-area .controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: stretch;
      }
      .capture-area .controls > button.secondary {
        width: 100%;
      }
      .generation-settings {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        align-items: stretch;
      }
      .generation-settings .parser,
      .generation-settings .checkbox-row {
        width: 100%;
      }
      .generation-settings .checkbox-row {
        min-height: 44px;
        padding: 0 2px;
      }
      .generation-settings button {
        width: 100%;
        grid-column: 1 / -1;
      }
      .compact-row {
        padding: 14px;
      }
      .compact-row-main {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        grid-template-areas:
          "chip title"
          "meta meta"
          "actions actions";
        align-items: start;
        row-gap: 6px;
        column-gap: 8px;
      }
      .type-chip {
        grid-area: chip;
        align-self: start;
      }
      .compact-row-title,
      .compact-row-text {
        grid-area: title;
        align-self: start;
      }
      .compact-row-title {
        font-size: 17px;
        line-height: 1.3;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .compact-row-text {
        font-size: 16px;
        line-height: 1.45;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .compact-row-meta {
        grid-area: meta;
      }
      .compact-row-actions {
        grid-area: actions;
        opacity: 1;
        width: 100%;
        justify-content: flex-start;
        align-items: center;
        flex-wrap: nowrap;
        gap: 8px;
      }
      .compact-row-action-meta {
        width: auto;
        flex: 0 1 auto;
        margin-right: auto;
        flex-wrap: nowrap;
      }
      .compact-row-actions .subtle-btn {
        max-width: 100%;
        flex: 0 0 auto;
      }
      .memory-input-area .controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: stretch;
      }
      .memory-input-area .controls .checkbox-row {
        justify-content: flex-start;
      }
      .memory-row-text {
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      #reviewControls .row-head {
        flex-direction: column;
      }
      #reviewControls .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      #reviewControls .actions button {
        width: 100%;
      }
      .suggestion-card {
        padding: 14px;
      }
      .suggestion-card .meta {
        margin-bottom: 12px;
      }
      .suggestion-primary-grid {
        gap: 10px;
      }
      .suggestion-secondary-grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .suggestion-card .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .suggestion-card .actions button {
        width: 100%;
        min-height: 46px;
      }
    }
  </style>
</head>
<body>
  <div id="root" class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">MemoFlow</div>
        <div class="sidebar-subtitle">${ui.localFileStore}</div>
      </div>
      <ul class="sidebar-nav">
        <li class="active" data-view="capture"><span class="nav-icon">add_circle</span><span class="nav-label">${ui.navCapture}</span></li>
        <li data-view="items"><span class="nav-icon">list_alt</span><span class="nav-label">${ui.navItems}</span></li>
        <li data-view="memory"><span class="nav-icon">psychology</span><span class="nav-label">${ui.navMemory}</span></li>
        <li data-view="pending"><span class="nav-icon">inbox</span><span class="nav-label">${ui.navPending}</span><span class="badge" id="pendingBadge"></span></li>
      </ul>
      <div class="sidebar-footer">
        <a href="/capture" class="sidebar-link">${ui.openCapture}</a>
        <div class="sidebar-contact">
          <div class="sidebar-contact-text">Carol · open to work: AI Eng, MLE, alt data</div>
          <div class="sidebar-contact-links">
            <a href="mailto:zhuoqun.wang0120@gmail.com">@</a>
            <a href="${CV_ROUTE}" target="_blank" rel="noreferrer">CV</a>
          </div>
        </div>
      </div>
    </nav>
    <main class="main-content">
      <div id="error" class="error"></div>
      <div class="status-bar"><span id="status"></span></div>

      <div id="view-capture" class="view active">
        <div class="capture-area">
          <div class="capture-label">${ui.captureQuickCapture}</div>
          <textarea id="rawText" placeholder="${ui.capturePlaceholder}"></textarea>
          <div class="controls">
            <button id="saveLaterBtn" class="secondary">${ui.saveForLater}</button>
            <div id="generationSettings" class="generation-settings">
              <label class="checkbox-row">
                <input id="useMemory" type="checkbox" checked />
                ${ui.useMemory}
              </label>
              <label class="checkbox-row">
                <input id="useContext" type="checkbox" checked />
                ${ui.useContext}
              </label>
              <button id="generateBtn">${ui.generateSuggestionsNow}</button>
            </div>
          </div>
        </div>
        <div id="reviewControls"></div>
        <div id="suggestions" class="stack">
          <div class="empty">${ui.suggestionsEmptyInitial}</div>
        </div>
      </div>

      <div id="view-items" class="view">
        <div class="view-header">
          <h2 class="view-title">${ui.savedItemsHeading}</h2>
        </div>
        <div class="items-search-shell">
          <input id="itemSearch" placeholder="${ui.searchPlaceholder}" class="filter-search" />
        </div>
        <div class="items-chip-strip" id="itemQuickFilters">
          <button class="filter-chip active" data-type="" data-archived="hide">${ui.filterAll}</button>
          <button class="filter-chip" data-type="task" data-archived="hide">${ui.filterTasks}</button>
          <button class="filter-chip" data-type="idea" data-archived="hide">${ui.filterIdeas}</button>
          <button class="filter-chip" data-type="reference" data-archived="hide">${ui.filterReferences}</button>
          <button class="filter-chip" data-archived="only">${ui.filterArchived}</button>
        </div>
        <details class="mobile-filter-details">
          <summary>${ui.moreFilters}</summary>
          <div class="filter-bar">
          <select id="itemSort" class="filter-select">
            <option value="updated_at_desc">${ui.sortUpdatedNewest}</option>
            <option value="updated_at_asc">${ui.sortUpdatedOldest}</option>
            <option value="created_at_desc">${ui.sortCreatedNewest}</option>
            <option value="created_at_asc">${ui.sortCreatedOldest}</option>
            <option value="due_date_asc">${ui.sortDueSoonest}</option>
            <option value="follow_up_date_asc">${ui.sortFollowUpSoonest}</option>
            <option value="type_asc">${ui.sortType}</option>
            <option value="status_asc">${ui.sortStatus}</option>
          </select>
          <select id="itemTypeFilter" class="filter-select">
            <option value="">${ui.allTypes}</option>
            <option value="task">task</option>
            <option value="exploration">exploration</option>
            <option value="idea">idea</option>
            <option value="reference">reference</option>
          </select>
          <select id="itemStatusFilter" class="filter-select">
            <option value="">${ui.allStatuses}</option>
            <option value="ready">ready</option>
            <option value="open">open</option>
            <option value="saved">saved</option>
            <option value="waiting">waiting</option>
            <option value="in_progress">in_progress</option>
            <option value="done">done</option>
            <option value="archived">archived</option>
          </select>
          <select id="itemArchivedFilter" class="filter-select">
            <option value="hide">${ui.hideArchived}</option>
            <option value="show">${ui.showArchived}</option>
            <option value="only">${ui.archivedOnly}</option>
          </select>
          <button id="clearItemFiltersBtn" class="subtle-btn">${ui.clear}</button>
          </div>
        </details>
        <div id="items" class="stack"></div>
      </div>

      <div id="view-memory" class="view">
        <div class="view-header">
          <h2 class="view-title">${ui.memoryHeading}</h2>
        </div>
        <div class="memory-input-area">
          <textarea id="memoryText" class="memory-input" placeholder="${ui.memoryInputPlaceholder}"></textarea>
          <div class="controls">
            <button id="addMemoryBtn" class="secondary">${ui.addMemoryButtonMain}</button>
            <label class="checkbox-row">
              <input id="showArchivedMemory" type="checkbox" />
              ${ui.showArchived}
            </label>
          </div>
        </div>
        <div id="memoryList" class="stack"></div>
      </div>

      <div id="view-pending" class="view">
        <div class="view-header">
          <h2 class="view-title">${ui.pendingReviewHeading}</h2>
        </div>
        <div id="pendingDumps" class="stack"></div>
      </div>
    </main>
  </div>

  <script>
    const UI = ${uiJson};
    const t = (key) => UI[key] ?? key;

    if ("serviceWorker" in navigator && window.isSecureContext) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      });
    }

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
      currentView: "capture",
      editingMemoryId: null,
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
    document.querySelectorAll("#itemQuickFilters .filter-chip").forEach((button) => {
      button.addEventListener("click", () => applyQuickItemFilter(button));
    });

    initializeResponsiveUi();
    loadItems();
    loadPendingDumps();
    loadMemory();

    document.querySelectorAll(".sidebar-nav li").forEach((li) => {
      li.addEventListener("click", () => {
        if (li.dataset.view) switchView(li.dataset.view);
      });
    });

    async function saveDumpForLater() {
      clearError();
      const rawText = $("rawText").value.trim();
      if (!rawText) {
        showError(t("errorEnterMemoDumpFirst"));
        return;
      }

      setBusy(t("busySavingDump"), { disableGenerationSettings: true });
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
      const parser = settings.parser ?? "llm";
      const useMemory = settings.useMemory ?? $("useMemory").checked;
      const useContext = settings.useContext ?? $("useContext").checked;
      if (!rawText) {
        showError(t("errorEnterMemoDumpFirst"));
        return;
      }

      state.rawText = rawText;
      setBusy(t("busyGeneratingSuggestions"), { disableGenerationSettings: true });
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
        syncQuickItemFilters();
        renderItems();
        updateSidebarBadges();
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
        showError(t("errorEnterMemoryTextFirst"));
        return;
      }

      setBusy(t("busySavingMemory"));
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
        memoryListEl.innerHTML = '<div class="empty">' + escapeHtml(t("emptyNoMemoryEntries")) + '</div>';
        return;
      }

      memoryListEl.innerHTML = "";
      state.memory.forEach((entry) => {
        const wrap = document.createElement("div");
        wrap.className = "compact-row" + (entry.archived_at ? " archived" : "");
        const isEditing = state.editingMemoryId === entry.id;
        wrap.innerHTML = \`
          <div class="compact-row-main">
            <span class="compact-row-text memory-row-text">\${escapeHtml(entry.text)}</span>
            <span class="compact-row-meta">
              \${entry.archived_at ? '<span class="pill">' + escapeHtml(t("archived")) + '</span>' : '<span class="pill status-active">' + escapeHtml(t("active")) + '</span>'}
              <span class="compact-row-date">\${escapeHtml(formatDate(entry.updated_at))}</span>
            </span>
            <div class="compact-row-actions">
              <button class="subtle-btn" data-action="edit">\${isEditing ? escapeHtml(t("close")) : escapeHtml(t("edit"))}</button>
              <button class="subtle-btn" data-action="archive" \${entry.archived_at ? "disabled" : ""}>\${escapeHtml(t("archive"))}</button>
            </div>
          </div>
          \${isEditing ? \`
            <div class="compact-row-editor">
              <textarea class="memory-edit" data-memory-text>\${escapeHtml(entry.text)}</textarea>
              <div class="compact-row-editor-actions">
                <button class="secondary" data-action="save">\${escapeHtml(t("save"))}</button>
                <button class="subtle-btn" data-action="delete">\${escapeHtml(t("delete"))}</button>
              </div>
            </div>
          \` : ""}
        \`;
        wrap.querySelector('[data-action="edit"]').addEventListener("click", () => {
          state.editingMemoryId = state.editingMemoryId === entry.id ? null : entry.id;
          renderMemory();
        });
        wrap.querySelector('[data-action="save"]')?.addEventListener("click", () => updateMemoryEntry(entry.id, wrap));
        wrap.querySelector('[data-action="archive"]').addEventListener("click", () => archiveMemoryEntry(entry.id));
        wrap.querySelector('[data-action="delete"]')?.addEventListener("click", () => deleteMemoryEntry(entry.id));
        memoryListEl.appendChild(wrap);
      });
    }

    async function updateMemoryEntry(id, card) {
      clearError();
      const text = card.querySelector("[data-memory-text]").value.trim();
      if (!text) {
        showError(t("errorMemoryTextCannotBeEmpty"));
        return;
      }

      setBusy(t("busyUpdatingMemory"));
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
      setBusy(t("busyArchivingMemory"));
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
      setBusy(t("busyDeletingMemory"));
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

    function applyQuickItemFilter(button) {
      $("itemTypeFilter").value = button.dataset.type || "";
      $("itemArchivedFilter").value = button.dataset.archived || "hide";
      loadItems();
    }

    function syncQuickItemFilters() {
      const currentType = $("itemTypeFilter").value || "";
      const currentArchived = $("itemArchivedFilter").value || "hide";
      document.querySelectorAll("#itemQuickFilters .filter-chip").forEach((button) => {
        const matchesType = (button.dataset.type || "") === currentType;
        const matchesArchived = (button.dataset.archived || "hide") === currentArchived;
        button.classList.toggle("active", matchesType && matchesArchived);
      });
    }

    function initializeResponsiveUi() {
      const itemFilters = document.querySelector(".mobile-filter-details");
      if (!itemFilters) return;
      if (window.innerWidth > 900) {
        itemFilters.setAttribute("open", "");
        return;
      }
      const hasActiveAdvancedFilters =
        $("itemStatusFilter").value !== "" ||
        $("itemSort").value !== "updated_at_desc" ||
        $("itemArchivedFilter").value !== "hide" ||
        $("itemTypeFilter").value !== "";
      if (hasActiveAdvancedFilters) {
        itemFilters.setAttribute("open", "");
      } else {
        itemFilters.removeAttribute("open");
      }
    }

    function renderPendingDumps() {
      if (state.pendingDumps.length === 0) {
        pendingDumpsEl.innerHTML = '<div class="empty">' + escapeHtml(t("emptyNoPendingDumps")) + '</div>';
        updateSidebarBadges();
        return;
      }

      pendingDumpsEl.innerHTML = "";
      state.pendingDumps.forEach((dump) => {
        const wrap = document.createElement("div");
        wrap.className = "compact-row";
        const expanded = state.reviewSetupDumpId === dump.id;
        const truncatedText = dump.raw_text.length > 100 ? dump.raw_text.substring(0, 100) + "..." : dump.raw_text;
        const reviewSetupHtml = expanded
          ? '<div class="review-setup-panel">' +
              '<div class="card">' +
                '<div class="row-title">' + escapeHtml(t("reviewDump")) + '</div>' +
                '<div class="controls">' +
                  '<label class="checkbox-row">' +
                    '<input data-review-memory type="checkbox" />' +
                    escapeHtml(t("useMemory")) +
                  '</label>' +
                  '<label class="checkbox-row">' +
                    '<input data-review-context type="checkbox" />' +
                    escapeHtml(t("useContext")) +
                  '</label>' +
                  '<button data-action="generate-review">' + escapeHtml(t("generateReview")) + '</button>' +
                  '<button class="secondary" data-action="cancel-review-setup">' + escapeHtml(t("cancel")) + '</button>' +
                '</div>' +
              '</div>' +
            '</div>'
          : "";
        wrap.innerHTML = \`
          <div class="compact-row-main">
            <span class="compact-row-text">\${escapeHtml(truncatedText)}</span>
            <span class="compact-row-meta">
              <span class="pill">\${escapeHtml(dump.status)}</span>
              <span class="compact-row-date">\${escapeHtml(formatDate(dump.created_at))}</span>
            </span>
            <div class="compact-row-actions">
              <button class="secondary" data-action="review">\${escapeHtml(t("review"))}</button>
              <button class="subtle-btn" data-action="ignore">\${escapeHtml(t("ignore"))}</button>
            </div>
          </div>
          \${reviewSetupHtml}
        \`;
        wrap.querySelector('[data-action="review"]').addEventListener("click", () => showPendingReviewSetup(dump.id));
        wrap.querySelector('[data-action="ignore"]').addEventListener("click", () => ignorePendingDump(dump.id));
        wrap.querySelector('[data-action="generate-review"]')?.addEventListener("click", () => {
          const useMemory = wrap.querySelector("[data-review-memory]").checked;
          const useContext = wrap.querySelector("[data-review-context]").checked;
          startPendingDumpReview(dump, { parser: "llm", useMemory, useContext });
        });
        wrap.querySelector('[data-action="cancel-review-setup"]')?.addEventListener("click", () => {
          state.reviewSetupDumpId = null;
          renderPendingDumps();
        });
        pendingDumpsEl.appendChild(wrap);
      });
      updateSidebarBadges();
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
      switchView("capture");
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
              <div class="row-title">\${escapeHtml(t("reviewingPendingDump"))}</div>
              <div class="source">\${escapeHtml(state.reviewingDump.raw_text)}</div>
            </div>
            <span class="pill">\${escapeHtml(t("inReview"))}</span>
          </div>
          <div class="actions">
            <button class="secondary" data-action="review-later">\${escapeHtml(t("reviewLater"))}</button>
            <button class="danger" data-action="abandon">\${escapeHtml(t("abandon"))}</button>
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
      switchView("pending");
      setStatus(t("returnedDumpToPendingReview"));
    }

    async function abandonCurrentDump() {
      if (!state.reviewingDumpId) return;
      const dumpId = state.reviewingDumpId;
      clearError();
      setBusy(t("busyAbandoningReview"));
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
      if (abandoned) {
        setStatus(t("abandonedPendingDump"));
        switchView("pending");
      }
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
      setBusy(t("busyIgnoringDump"));
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
        suggestionsEl.innerHTML = '<div class="empty">' + escapeHtml(t("emptyNoSuggestionsYet")) + '</div>';
        return;
      }

      const visibleSuggestions = state.suggestions.filter((_, index) => !state.approved.has(index) && !state.rejected.has(index));
      if (visibleSuggestions.length === 0) {
        suggestionsEl.innerHTML = '<div class="empty">' + escapeHtml(t("emptyNoSuggestionsLeft")) + '</div>';
        return;
      }

      suggestionsEl.innerHTML = "";
      const relatedItemIdsToLoad = new Set();
      state.suggestions.forEach((suggestion, index) => {
        if (state.approved.has(index) || state.rejected.has(index)) return;
        const card = document.createElement("div");
        card.className = "card suggestion-card";
        card.dataset.index = String(index);
        const fields = suggestion.suggested_fields || {};
        const related = relatedExistingItemsFor(suggestion);
        related.forEach((item) => {
          if (!state.relatedItems[item.item_id] && !state.loadingRelatedItems.has(item.item_id)) {
            relatedItemIdsToLoad.add(item.item_id);
          }
        });
        const disabled = state.rejected.has(index) || state.approved.has(index);
        const approveLabel = related.length > 0 ? t("createNewAnyway") : t("approve");

        card.innerHTML = \`
          <div class="meta">
            <span class="pill">\${escapeHtml(t("confidence"))} \${escapeHtml(String(suggestion.confidence ?? ""))}</span>
            <span class="pill">\${escapeHtml(t("clarify"))} \${suggestion.needs_clarification ? escapeHtml(t("yes")) : escapeHtml(t("no"))}</span>
          </div>
          <div class="grid suggestion-primary-grid">
            <label>\${escapeHtml(t("labelType"))}
              <select data-field="type" \${disabled ? "disabled" : ""}>
                \${typeOptions(suggestion.type)}
              </select>
            </label>
            <label>\${escapeHtml(t("labelStatus"))}
              <select data-field="status" \${disabled ? "disabled" : ""}>
                \${statusOptions(suggestion.status || "", { includeClarify: true })}
              </select>
            </label>
          </div>
          <label>\${escapeHtml(t("labelTitle"))}
            <input data-field="title" value="\${escapeAttr(suggestion.title || "")}" \${disabled ? "disabled" : ""} />
          </label>
          <label>\${escapeHtml(t("labelDescription"))}
            <textarea data-field="description" \${disabled ? "disabled" : ""}>\${escapeHtml(suggestion.description || "")}</textarea>
          </label>
          \${suggestion.clarification_question ? '<div class="source">' + escapeHtml(t("clarificationPrefix")) + escapeHtml(suggestion.clarification_question) + '</div>' : ""}
          \${suggestion.missing_context?.length ? '<div class="source">' + escapeHtml(t("missingPrefix")) + escapeHtml(suggestion.missing_context.join("; ")) + '</div>' : ""}
          <div class="grid suggestion-secondary-grid">
            <label>\${escapeHtml(t("labelDueDate"))}
              <input type="date" data-field="due_date" value="\${escapeAttr(fields.due_date || "")}" \${disabled ? "disabled" : ""} />
            </label>
            <label>\${escapeHtml(t("labelWaitingOn"))}
              <input data-field="waiting_on" value="\${escapeAttr(fields.waiting_on || "")}" \${disabled ? "disabled" : ""} />
            </label>
            <label>\${escapeHtml(t("labelTags"))}
              <input data-field="tags" value="\${escapeAttr((fields.tags || []).join(","))}" \${disabled ? "disabled" : ""} />
            </label>
            <label>\${escapeHtml(t("labelCategory"))}
              <input data-field="category" value="\${escapeAttr(fields.category || "")}" \${disabled ? "disabled" : ""} />
            </label>
            <label>\${escapeHtml(t("labelUrl"))}
              <input data-field="url" value="\${escapeAttr(fields.url || "")}" \${disabled ? "disabled" : ""} />
            </label>
            <label>\${escapeHtml(t("labelFollowUp"))}
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
            <button data-action="approve" \${disabled ? "disabled" : ""}>\${escapeHtml(approveLabel)}</button>
            <button class="danger" data-action="reject" \${disabled ? "disabled" : ""}>\${related.length > 0 ? escapeHtml(t("discard")) : escapeHtml(t("reject"))}</button>
            \${state.approved.has(index) ? '<span class="pill">' + escapeHtml(t("saved")) + '</span>' : ""}
            \${state.rejected.has(index) ? '<span class="pill">' + escapeHtml(t("rejected")) + '</span>' : ""}
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
        '<div class="row-title">' + escapeHtml(t("relatedExistingItem")) + '</div>' +
        related.map((item) => {
          const existingItem = state.relatedItems[item.item_id];
          const itemTitle = existingItem?.title || t("loadingExistingItem");
          return (
          '<div class="source">' +
            '<strong>' + escapeHtml(itemTitle) + '</strong> · ' +
            escapeHtml(item.relationship) + ' · confidence ' + escapeHtml(String(item.confidence ?? "")) +
            '<br />' + escapeHtml(item.reason || "") +
            '<div class="actions">' +
              '<button class="secondary" data-action="update-existing" data-item-id="' + escapeAttr(item.item_id) + '">' + escapeHtml(t("updateExistingInstead")) + '</button>' +
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
        '<div class="row-title">' + escapeHtml(t("updateExistingManually")) + '</div>' +
        '<div class="source">' + escapeHtml(t("updateExistingManualNote")) + '</div>' +
        '<div class="grid">' +
          '<label>' + escapeHtml(t("labelType")) + '<select data-existing-field="type">' + itemTypeOptions(item.type) + '</select></label>' +
          '<label>' + escapeHtml(t("labelStatus")) + '<select data-existing-field="status">' + statusOptions(item.status || "") + '</select></label>' +
        '</div>' +
        '<label>' + escapeHtml(t("labelTitle")) + '<input data-existing-field="title" value="' + escapeAttr(item.title || "") + '" /></label>' +
        '<label>' + escapeHtml(t("labelDescription")) + '<textarea data-existing-field="description">' + escapeHtml(item.description || "") + '</textarea></label>' +
        '<div class="grid">' +
          '<label>' + escapeHtml(t("labelDueDate")) + '<input type="date" data-existing-field="due_date" value="' + escapeAttr(item.fields?.due_date || "") + '" /></label>' +
          '<label>' + escapeHtml(t("labelFollowUpDate")) + '<input type="date" data-existing-field="follow_up_date" value="' + escapeAttr(item.fields?.follow_up_date || "") + '" /></label>' +
          '<label>' + escapeHtml(t("labelWaitingOn")) + '<input data-existing-field="waiting_on" value="' + escapeAttr(item.fields?.waiting_on || "") + '" /></label>' +
          '<label>' + escapeHtml(t("labelCategory")) + '<input data-existing-field="category" value="' + escapeAttr(item.fields?.category || "") + '" /></label>' +
          '<label>' + escapeHtml(t("labelUrl")) + '<input data-existing-field="url" value="' + escapeAttr(item.fields?.url || "") + '" /></label>' +
        '</div>' +
        '<div class="actions">' +
          '<button data-action="save-existing">' + escapeHtml(t("saveExistingItem")) + '</button>' +
          '<button class="secondary" data-action="cancel-existing">' + escapeHtml(t("cancel")) + '</button>' +
        '</div>' +
      '</div>';
    }

    async function openExistingItemEditor(index, itemId) {
      clearError();
      setBusy(t("busyLoadingExistingItem"));
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
      setBusy(t("busyUpdatingExistingItem"));
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
        setStatus(t("updatedExistingItem"));
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
          url: value("url") || null,
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
        approveButton.textContent = t("saving");
      }
      setBusy(t("busySavingItem"));
      let savedTitle = "";
      try {
        const item = await requestJson("/api/items", {
          method: "POST",
          body: {
            rawText: state.rawText,
            suggestion: original,
            overrides,
            reviewContext: {
              source: state.reviewingDumpId ? "pending_review" : "suggestion_review",
              proposalId: state.reviewingDumpId
                ? state.reviewingDumpId + ":suggestion:" + index
                : "suggestion:" + index,
              dumpId: state.reviewingDumpId || undefined,
            },
          },
        });
        savedTitle = item.title || overrides.title || original.title || "item";
        state.approved.add(index);
        renderSuggestions();
        setStatus(t("savedItemPrefix") + savedTitle);
        try {
          await loadItems();
          await maybeMarkReviewComplete();
        } catch (error) {
          showError(t("itemSavedButPendingReviewMarkFailedPrefix") + (error instanceof Error ? error.message : String(error)));
        }
        renderSuggestions();
      } catch (error) {
        if (approveButton) {
          approveButton.disabled = false;
          approveButton.textContent = t("approve");
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
          url: value("url") || null,
          follow_up_needed: followUp === "" ? null : followUp === "true",
        },
      };
    }

    async function maybeMarkReviewComplete() {
      if (state.suggestions.length === 0) return;

      const complete = state.suggestions.every((_, index) =>
        state.approved.has(index) || state.rejected.has(index)
      );
      if (!complete) return;

      if (state.reviewingDumpId) {
        await markCurrentDumpReviewed();
      }
      state.rawText = "";
      $("rawText").value = "";
      state.suggestions = [];
      state.rejected = new Set();
      state.approved = new Set();
      state.editingExistingForSuggestion = null;
      state.relatedItems = {};
      state.loadingRelatedItems = new Set();
      renderSuggestions();
      renderReviewControls();
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
        itemsEl.innerHTML = '<div class="empty">' + escapeHtml(t("emptyNoSavedItemsYet")) + '</div>';
        updateSidebarBadges();
        return;
      }

      itemsEl.innerHTML = "";
      state.items.forEach((item) => {
        const wrap = document.createElement("div");
        wrap.className = "compact-row" + (item.archived_at ? " archived" : "");
        const isEditing = state.editingItemId === item.id;
        wrap.innerHTML = \`
          <div class="compact-row-main">
            <span class="compact-row-title">\${escapeHtml(item.title)}</span>
            <span class="compact-row-meta">
              <span class="compact-row-date">\${escapeHtml(itemListDateText(item))}</span>
            </span>
            <div class="compact-row-actions">
              <span class="compact-row-action-meta">
                <span class="type-chip">\${escapeHtml(item.type)}</span>
                <span class="pill \${statusPillClass(item.status)}">\${escapeHtml(displayItemStatus(item.status))}</span>
              </span>
              <button class="subtle-btn" data-action="edit">\${isEditing ? escapeHtml(t("close")) : escapeHtml(t("edit"))}</button>
              <button class="subtle-btn" data-action="\${item.archived_at ? "unarchive" : "archive"}">\${item.archived_at ? escapeHtml(t("unarchive")) : escapeHtml(t("archive"))}</button>
            </div>
          </div>
          \${isEditing ? '<div class="compact-row-editor">' + ledgerItemEditorHtml(item) + '</div>' : ""}
        \`;
        wrap.querySelector('[data-action="edit"]').addEventListener("click", () => {
          state.editingItemId = state.editingItemId === item.id ? null : item.id;
          renderItems();
        });
        wrap.querySelector('[data-action="save-edit"]')?.addEventListener("click", () => saveLedgerItemEdit(item.id, wrap));
        wrap.querySelector('[data-action="cancel-edit"]')?.addEventListener("click", () => {
          state.editingItemId = null;
          renderItems();
        });
        wrap.querySelector('[data-action="archive"]')?.addEventListener("click", () => archiveItem(item.id));
        wrap.querySelector('[data-action="unarchive"]')?.addEventListener("click", () => unarchiveItem(item.id));
        itemsEl.appendChild(wrap);
      });
      updateSidebarBadges();
    }

    function ledgerItemEditorHtml(item) {
      return '<div class="card">' +
        '<div class="row-title">' + escapeHtml(t("editItem")) + '</div>' +
        '<div class="grid">' +
          '<label>' + escapeHtml(t("labelType")) + '<select data-ledger-field="type">' + itemTypeOptions(item.type) + '</select></label>' +
          '<label>' + escapeHtml(t("labelStatus")) + '<select data-ledger-field="status">' + statusOptions(item.status || "") + '</select></label>' +
        '</div>' +
        '<label>' + escapeHtml(t("labelTitle")) + '<input data-ledger-field="title" value="' + escapeAttr(item.title || "") + '" /></label>' +
        '<label>' + escapeHtml(t("labelDescription")) + '<textarea data-ledger-field="description">' + escapeHtml(item.description || "") + '</textarea></label>' +
        '<div class="grid">' +
          '<label>' + escapeHtml(t("labelDueDate")) + '<input type="date" data-ledger-field="due_date" value="' + escapeAttr(item.fields?.due_date || "") + '" /></label>' +
          '<label>' + escapeHtml(t("labelFollowUpDate")) + '<input type="date" data-ledger-field="follow_up_date" value="' + escapeAttr(item.fields?.follow_up_date || "") + '" /></label>' +
          '<label>' + escapeHtml(t("labelUrl")) + '<input data-ledger-field="url" value="' + escapeAttr(item.fields?.url || "") + '" /></label>' +
        '</div>' +
        '<div class="actions">' +
          '<button data-action="save-edit">' + escapeHtml(t("saveEdit")) + '</button>' +
          '<button class="secondary" data-action="cancel-edit">' + escapeHtml(t("cancel")) + '</button>' +
        '</div>' +
      '</div>';
    }

    async function saveLedgerItemEdit(id, card) {
      clearError();
      setBusy(t("busySavingItemEdit"));
      try {
        await requestJson("/api/items/" + encodeURIComponent(id), {
          method: "PATCH",
          body: readLedgerItemPatch(card),
        });
        state.editingItemId = null;
        await loadItems();
        setStatus(t("updatedItem"));
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
        fields: {
          url: value("url") || null,
        },
      };
    }

    async function updateItemStatus(id, card) {
      clearError();
      const status = card.querySelector("[data-item-status]").value;
      setBusy(t("busyUpdatingItem"));
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
      setBusy(t("busyArchivingItem"));
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

    async function unarchiveItem(id) {
      clearError();
      setBusy(t("busyUnarchivingItem"));
      try {
        await requestJson("/api/items/" + encodeURIComponent(id) + "/unarchive", {
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
        throw new Error(payload.error || t("requestFailed"));
      }
      return payload;
    }

    function setBusy(message, options = {}) {
      statusEl.textContent = message;
      $("generateBtn").disabled = Boolean(message);
      $("saveLaterBtn").disabled = Boolean(message);
      $("addMemoryBtn").disabled = Boolean(message);
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
      return ["task", "exploration", "idea", "reference"].map((type) =>
        '<option value="' + type + '" ' + (type === current ? "selected" : "") + '>' + type + '</option>'
      ).join("");
    }

    function itemTypeOptions(current) {
      return ["task", "exploration", "idea", "reference"].map((type) =>
        '<option value="' + type + '" ' + (type === current ? "selected" : "") + '>' + type + '</option>'
      ).join("");
    }

    function statusOptions(current, options = {}) {
      const statuses = ["ready", "open", "saved", "waiting", "in_progress", "done"];
      if (options.includeArchived) statuses.push("archived");
      if (options.includeClarify) statuses.push("needs_clarification");
      if (!statuses.includes(current)) statuses.unshift(current);
      return statuses.map((status) =>
        '<option value="' + escapeAttr(status) + '" ' + (status === current ? "selected" : "") + '>' + escapeHtml(status) + '</option>'
      ).join("");
    }

    function formatDate(isoString) {
      if (!isoString) return "";
      try {
        const d = new Date(isoString);
        const now = new Date();
        const diffMs = now - d;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "today";
        if (diffDays === 1) return "yesterday";
        if (diffDays < 7) return diffDays + "d ago";
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } catch { return isoString; }
    }

    function itemListDateText(item) {
      if (item.fields?.due_date) return "Due " + item.fields.due_date;
      if (item.fields?.follow_up_date) return "Follow-up " + item.fields.follow_up_date;
      return "";
    }

    function displayItemStatus(status) {
      return ["ready", "open", "saved"].includes(status) ? "ready" : status;
    }

    function statusPillClass(status) {
      if (status === "ready" || status === "open" || status === "saved") return "status-active";
      if (status === "waiting" || status === "in_progress" || status === "needs_clarification") return "status-waiting";
      if (status === "done") return "status-done";
      return "";
    }

    function switchView(view) {
      state.currentView = view;
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      const target = document.getElementById("view-" + view);
      if (target) target.classList.add("active");
      document.querySelectorAll(".sidebar-nav li").forEach((li) => {
        li.classList.toggle("active", li.dataset.view === view);
      });
    }

    function updateSidebarBadges() {
      const pendingBadge = $("pendingBadge");
      if (pendingBadge) {
        const count = state.pendingDumps.length;
        pendingBadge.textContent = count > 0 ? String(count) : "";
        pendingBadge.style.display = count > 0 ? "inline" : "none";
      }
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

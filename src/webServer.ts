import "dotenv/config";

import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import { createSuggestionsFromDump } from "./services/suggestionService.js";
import { add, archive, list, update } from "./services/itemStoreService.js";
import { suggestionToAddItemInput } from "./services/suggestionApprovalService.js";
import { ItemFieldsSchema, ItemTypeSchema } from "./schemas/item.js";
import { SuggestionSchema } from "./schemas/suggestion.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";
const CV_ROUTE = "/assets/carol-wang-cv-062026-webapp.pdf";
const CV_PATH = join(process.cwd(), "public", "carol-wang-cv-062026-webapp.pdf");

const GenerateSuggestionsRequestSchema = z.object({
  rawText: z.string().trim().min(1, "rawText is required"),
  parser: z.enum(["stub", "llm"]).optional().default("stub"),
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

const UpdateItemRequestSchema = z.object({
  type: ItemTypeSchema.optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().trim().min(1).optional(),
  fields: ItemFieldsSchema.optional(),
});

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      sendHtml(res, APP_HTML);
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && req.url === CV_ROUTE) {
      const pdf = await readFile(CV_PATH);
      sendPdf(res, pdf, req.method === "HEAD");
      return;
    }

    if (req.method === "POST" && req.url === "/api/suggestions") {
      const body = GenerateSuggestionsRequestSchema.parse(await readJson(req));
      const result = await createSuggestionsFromDump({ rawText: body.rawText }, { parser: body.parser });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && req.url === "/api/items") {
      const items = await list();
      sendJson(res, 200, { items });
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

    const itemMatch = req.url?.match(/^\/api\/items\/([^/]+)$/);
    if (req.method === "PATCH" && itemMatch?.[1]) {
      const body = UpdateItemRequestSchema.parse(await readJson(req));
      const item = await update(decodeURIComponent(itemMatch[1]), body);
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
          <select id="parser" class="parser" aria-label="Parser">
            <option value="stub">stub</option>
            <option value="llm">llm</option>
          </select>
          <button id="generateBtn">Generate Suggestions</button>
          <span id="status" class="muted"></span>
        </div>
      </section>
    </div>

    <div class="workspace">
      <section>
        <h2>Suggestions</h2>
        <div id="suggestions" class="stack">
          <div class="empty">Generate suggestions from a memo dump, then approve, edit, or reject each card.</div>
        </div>
      </section>

      <section>
        <h2>Saved Items</h2>
        <div id="items" class="stack"></div>
      </section>
    </div>
  </main>

  <script>
    const state = {
      rawText: "",
      suggestions: [],
      rejected: new Set(),
      approved: new Set(),
      items: [],
    };

    const $ = (id) => document.getElementById(id);
    const errorEl = $("error");
    const statusEl = $("status");
    const suggestionsEl = $("suggestions");
    const itemsEl = $("items");

    $("generateBtn").addEventListener("click", generateSuggestions);

    loadItems();

    async function generateSuggestions() {
      clearError();
      const rawText = $("rawText").value.trim();
      const parser = $("parser").value;
      if (!rawText) {
        showError("Enter a memo dump first.");
        return;
      }

      state.rawText = rawText;
      setBusy("Generating suggestions...");
      try {
        const result = await requestJson("/api/suggestions", {
          method: "POST",
          body: { rawText, parser },
        });
        state.suggestions = result.suggestions || [];
        state.rejected = new Set();
        state.approved = new Set();
        renderSuggestions();
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy("");
      }
    }

    async function loadItems() {
      clearError();
      try {
        const result = await requestJson("/api/items");
        state.items = result.items || [];
        renderItems();
      } catch (error) {
        showError(error.message);
      }
    }

    function renderSuggestions() {
      if (state.suggestions.length === 0) {
        suggestionsEl.innerHTML = '<div class="empty">No suggestions yet.</div>';
        return;
      }

      suggestionsEl.innerHTML = "";
      state.suggestions.forEach((suggestion, index) => {
        const card = document.createElement("div");
        card.className = "card";
        card.dataset.index = String(index);
        const fields = suggestion.suggested_fields || {};
        const disabled = state.rejected.has(index) || state.approved.has(index);

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
          <div class="actions">
            <button data-action="approve" \${disabled ? "disabled" : ""}>Approve</button>
            <button class="danger" data-action="reject" \${disabled ? "disabled" : ""}>Reject</button>
            \${state.approved.has(index) ? '<span class="pill">saved</span>' : ""}
            \${state.rejected.has(index) ? '<span class="pill">rejected</span>' : ""}
          </div>
        \`;

        card.querySelector('[data-action="approve"]')?.addEventListener("click", () => approveSuggestion(index, card));
        card.querySelector('[data-action="reject"]')?.addEventListener("click", () => {
          state.rejected.add(index);
          renderSuggestions();
        });
        suggestionsEl.appendChild(card);
      });
    }

    async function approveSuggestion(index, card) {
      clearError();
      const original = state.suggestions[index];
      const overrides = readOverrides(card, original);
      setBusy("Saving item...");
      try {
        await requestJson("/api/items", {
          method: "POST",
          body: {
            rawText: state.rawText,
            suggestion: original,
            overrides,
          },
        });
        state.approved.add(index);
        await loadItems();
        renderSuggestions();
      } catch (error) {
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
        card.innerHTML = \`
          <div class="row-head">
            <div>
              <div class="row-title">\${escapeHtml(item.title)}</div>
              <div class="muted">\${escapeHtml(item.type)} · updated \${escapeHtml(item.updated_at)}</div>
            </div>
            <span class="pill">\${escapeHtml(item.status)}</span>
          </div>
          \${item.description ? '<div>' + escapeHtml(item.description) + '</div>' : ""}
          \${sourceMemo ? '<div class="source">Source memo: ' + escapeHtml(sourceMemo) + '</div>' : ""}
          <div class="actions">
            <select data-item-status>
              \${statusOptions(item.status)}
            </select>
            <button class="secondary" data-action="status">Update Status</button>
            <button class="danger" data-action="archive">Archive</button>
          </div>
        \`;
        card.querySelector('[data-action="status"]').addEventListener("click", () => updateItemStatus(item.id, card));
        card.querySelector('[data-action="archive"]').addEventListener("click", () => archiveItem(item.id));
        itemsEl.appendChild(card);
      });
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

    function setBusy(message) {
      statusEl.textContent = message;
      $("generateBtn").disabled = Boolean(message);
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

    function statusOptions(current) {
      const statuses = ["ready", "open", "saved", "waiting", "follow_up", "in_progress", "done", "archived"];
      if (!statuses.includes(current)) statuses.unshift(current);
      return statuses.map((status) =>
        '<option value="' + escapeAttr(status) + '" ' + (status === current ? "selected" : "") + '>' + escapeHtml(status) + '</option>'
      ).join("");
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
  </script>
</body>
</html>`;

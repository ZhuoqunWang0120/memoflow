export const CAPTURE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MemoFlow Capture</title>
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
      width: min(520px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 24px 0 48px;
    }
    header {
      margin-bottom: 18px;
    }
    h1 {
      font-size: 22px;
      margin: 0;
      letter-spacing: 0;
    }
    .muted {
      color: var(--muted);
      font-size: 13px;
    }
    section {
      min-width: 0;
      margin-bottom: 18px;
    }
    h2 {
      font-size: 15px;
      margin: 0 0 8px;
      letter-spacing: 0;
      color: var(--muted);
      font-weight: 650;
    }
    textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      font: inherit;
      padding: 9px 10px;
      min-height: 100px;
      resize: vertical;
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
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 8px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      box-shadow: var(--shadow);
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
    .success {
      display: none;
      border: 1px solid #b7e3c3;
      background: #f3fff6;
      color: #1a5c2a;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }
    .workspace-link {
      display: inline-block;
      margin-top: 12px;
      color: var(--accent-2);
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
    }
    .workspace-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>MemoFlow Capture</h1>
      <div class="muted">Drop it now. Review later.</div>
    </header>

    <div id="error" class="error"></div>
    <div id="success" class="success"></div>

    <section>
      <div class="card">
        <h2>Quick Memo</h2>
        <textarea id="memoText" placeholder="Dump a thought, idea, or reminder..."></textarea>
        <div class="controls">
          <button id="saveDumpBtn">Save for later</button>
        </div>
      </div>
    </section>

    <section>
      <div class="card">
        <h2>Add Memory</h2>
        <textarea id="memoryText" placeholder="A fact, context, or note for later..."></textarea>
        <div class="controls">
          <button id="addMemoryBtn">Add memory</button>
        </div>
      </div>
    </section>

    <a href="/" class="workspace-link">Open workspace</a>
  </main>

  <script>
    const errorEl = document.getElementById("error");
    const successEl = document.getElementById("success");

    document.getElementById("saveDumpBtn").addEventListener("click", saveDump);
    document.getElementById("addMemoryBtn").addEventListener("click", addMemory);

    async function saveDump() {
      clearMessages();
      const rawText = document.getElementById("memoText").value.trim();
      if (!rawText) {
        showError("Enter a memo first.");
        return;
      }

      setBusy(true);
      try {
        await requestJson("/api/dumps", {
          method: "POST",
          body: { rawText },
        });
        document.getElementById("memoText").value = "";
        showSuccess("Saved dump.");
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy(false);
      }
    }

    async function addMemory() {
      clearMessages();
      const text = document.getElementById("memoryText").value.trim();
      if (!text) {
        showError("Enter memory text first.");
        return;
      }

      setBusy(true);
      try {
        await requestJson("/api/memory", {
          method: "POST",
          body: { text },
        });
        document.getElementById("memoryText").value = "";
        showSuccess("Saved memory.");
      } catch (error) {
        showError(error.message);
      } finally {
        setBusy(false);
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

    function setBusy(busy) {
      document.getElementById("saveDumpBtn").disabled = busy;
      document.getElementById("addMemoryBtn").disabled = busy;
    }

    function showError(message) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
    }

    function showSuccess(message) {
      successEl.textContent = message;
      successEl.style.display = "block";
    }

    function clearMessages() {
      errorEl.textContent = "";
      errorEl.style.display = "none";
      successEl.textContent = "";
      successEl.style.display = "none";
    }
  </script>
</body>
</html>`;

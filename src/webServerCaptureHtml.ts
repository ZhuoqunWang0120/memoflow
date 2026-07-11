import { getUiStrings, serializeSelectedUiStringsForInlineScript, type UiStringKey } from "./i18n/uiStrings.js";

const ui = getUiStrings();
const captureInlineKeys: UiStringKey[] = [
  "errorEnterMemoFirst",
  "errorEnterMemoryTextFirst",
  "savedDumpSuccess",
  "savedMemorySuccess",
  "requestFailed",
];
const uiJson = serializeSelectedUiStringsForInlineScript(captureInlineKeys);

export const CAPTURE_HTML = `<!doctype html>
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
  <title>${ui.capturePageTitle}</title>
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
      --accent: #4e6058;
      --danger: #ba1a1a;
      --danger-bg: #ffdad6;
      --danger-text: #93000a;
      --success-border: #b8cbc2;
      --success-bg: #f0f8f4;
      --success-text: #1a3d2e;
      --font-headline: 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif;
      --font-body: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; }
    body {
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font-body);
      font-size: 16px;
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding:
        calc(24px + env(safe-area-inset-top))
        calc(16px + env(safe-area-inset-right))
        calc(24px + env(safe-area-inset-bottom))
        calc(16px + env(safe-area-inset-left));
    }
    main {
      width: min(440px, 100%);
      display: flex;
      flex-direction: column;
      gap: 28px;
      animation: fadeIn 0.4s ease forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    header h1 {
      font-family: var(--font-headline);
      font-size: 26px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--accent);
      margin-bottom: 4px;
    }
    .muted {
      color: var(--muted);
      font-size: 14px;
      opacity: 0.8;
    }
    section { min-width: 0; }

    /* Post-it note cards */
    .postit {
      border: none;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 4px 4px 12px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
    }
    .postit:hover {
      box-shadow: 6px 6px 16px rgba(0, 0, 0, 0.12);
    }
    .postit-memo {
      background: #fce4ec;
      transform: rotate(-1.2deg);
    }
    .postit-memo:hover { transform: rotate(-0.5deg); }
    .postit-memory {
      background: #e8f5e9;
      transform: rotate(1deg);
    }
    .postit-memory:hover { transform: rotate(0.3deg); }

    .postit-label {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-bottom: 12px;
      display: block;
    }
    textarea {
      width: 100%;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.6);
      color: var(--ink);
      font-family: var(--font-body);
      font-size: 15px;
      line-height: 1.6;
      padding: 12px 14px;
      min-height: 100px;
      resize: vertical;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }
    textarea::placeholder {
      color: var(--muted);
      opacity: 0.45;
      font-style: italic;
    }
    textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
      background: rgba(255, 255, 255, 0.85);
    }
    button {
      border: none;
      border-radius: 8px;
      background: var(--accent);
      color: #fff;
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 500;
      padding: 11px 20px;
      min-height: 44px;
      width: 100%;
      cursor: pointer;
      transition: opacity 0.15s ease, transform 0.1s ease;
    }
    button:hover { opacity: 0.88; }
    button:active { transform: scale(0.98); }
    button:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 14px;
    }
    .error {
      display: none;
      border: 1px solid var(--danger-bg);
      background: var(--danger-bg);
      color: var(--danger-text);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 14px;
      white-space: pre-wrap;
    }
    .success {
      display: none;
      border: 1px solid var(--success-border);
      background: var(--success-bg);
      color: var(--success-text);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 500;
    }
    .workspace-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--accent);
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      opacity: 0.6;
      transition: opacity 0.15s ease;
    }
    .workspace-link:hover { opacity: 1; }
    .workspace-link::before { content: "\\2190  "; }
    @media (max-width: 480px) {
      body {
        align-items: flex-start;
        padding:
          calc(24px + env(safe-area-inset-top))
          calc(16px + env(safe-area-inset-right))
          calc(24px + env(safe-area-inset-bottom))
          calc(16px + env(safe-area-inset-left));
      }
      main { width: 100%; }
      .postit-memo, .postit-memory { transform: none; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${ui.captureHeaderTitle}</h1>
      <div class="muted">${ui.captureHeaderSubtitle}</div>
    </header>

    <div id="error" class="error"></div>
    <div id="success" class="success"></div>

    <section>
      <div class="postit postit-memo">
        <span class="postit-label">${ui.captureQuickMemo}</span>
        <textarea id="memoText" placeholder="${ui.captureMemoPlaceholder}"></textarea>
        <div class="controls">
          <button id="saveDumpBtn">${ui.saveForLater}</button>
        </div>
      </div>
    </section>

    <section>
      <div class="postit postit-memory">
        <span class="postit-label">${ui.addMemoryLabel}</span>
        <textarea id="memoryText" placeholder="${ui.captureMemoryPlaceholder}"></textarea>
        <div class="controls">
          <button id="addMemoryBtn">${ui.addMemoryButton}</button>
        </div>
      </div>
    </section>

    <a href="/" class="workspace-link">${ui.openWorkspace}</a>
  </main>

  <script>
    const UI = ${uiJson};
    const t = (key) => UI[key] ?? key;

    if ("serviceWorker" in navigator && window.isSecureContext) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      });
    }

    const errorEl = document.getElementById("error");
    const successEl = document.getElementById("success");

    document.getElementById("saveDumpBtn").addEventListener("click", saveDump);
    document.getElementById("addMemoryBtn").addEventListener("click", addMemory);

    async function saveDump() {
      clearMessages();
      const rawText = document.getElementById("memoText").value.trim();
      if (!rawText) {
        showError(t("errorEnterMemoFirst"));
        return;
      }

      setBusy(true);
      try {
        await requestJson("/api/dumps", {
          method: "POST",
          body: { rawText },
        });
        document.getElementById("memoText").value = "";
        showSuccess(t("savedDumpSuccess"));
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
        showError(t("errorEnterMemoryTextFirst"));
        return;
      }

      setBusy(true);
      try {
        await requestJson("/api/memory", {
          method: "POST",
          body: { text },
        });
        document.getElementById("memoryText").value = "";
        showSuccess(t("savedMemorySuccess"));
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
        throw new Error(payload.error || t("requestFailed"));
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

/**
 * MemoFlow LinkedIn Demo Recording
 *
 * Records a 30-60s demo video showing:
 *   1. Capture a raw memo ("pick up ibuprofen at Safeway") on /capture
 *   2. Save for later → navigate to main workspace
 *   3. Pending review → generate suggestion with context
 *   4. Related existing item detected
 *   5. User chooses "Update existing instead"
 *   6. Editor opens for the existing item
 *
 * Data: isolated in data/demo/ via MEMOFLOW_DATA_DIR
 * Suggestions: mocked via Playwright route interception (no real LLM)
 */

import { chromium } from "playwright";
import { execSync, spawn } from "child_process";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ARTIFACTS = resolve(ROOT, "artifacts/demo");

// --- Mock suggestion response ---
const MOCK_SUGGESTION = {
  suggestions: [
    {
      type: "task",
      title: "Pick up ibuprofen at Safeway",
      description: "Pick up ibuprofen from Safeway pharmacy.",
      status: "ready",
      confidence: 0.9,
      needs_clarification: false,
      clarification_question: null,
      missing_context: [],
      suggested_fields: {},
      related_existing_items: [
        {
          item_id: "demo_medicine",
          relationship: "possible_duplicate",
          reason:
            "This appears to be a more specific pharmacy pickup related to your existing medicine pickup task.",
          confidence: 0.8,
        },
      ],
    },
  ],
};

// --- Cursor overlay (injected once per page) ---
const CURSOR_CSS = `
  #demo-cursor {
    position: fixed;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(78, 96, 88, 0.7);
    border: 2px solid rgba(78, 96, 88, 1);
    pointer-events: none;
    z-index: 99999;
    transition: left 0.25s ease, top 0.25s ease;
    display: none;
    box-shadow: 0 0 0 4px rgba(78, 96, 88, 0.2);
  }
`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Inject cursor dot into the page (call once after navigation).
 */
async function injectCursor(page) {
  await page.addStyleTag({ content: CURSOR_CSS });
  await page.evaluate(() => {
    const dot = document.createElement("div");
    dot.id = "demo-cursor";
    document.body.appendChild(dot);
  });
}

/**
 * Show cursor at a locator's position, pause, then click.
 */
async function pointAndClick(page, locator, label) {
  const box = await locator.boundingBox();
  if (box) {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.evaluate(
      ([cx, cy]) => {
        const dot = document.getElementById("demo-cursor");
        if (dot) {
          dot.style.display = "block";
          dot.style.left = cx - 9 + "px";
          dot.style.top = cy - 9 + "px";
        }
      },
      [x, y]
    );
    await sleep(400);
  }
  console.log(`  → click: ${label}`);
  await locator.click();
  await sleep(200);
}

/**
 * Smoothly scroll an element into view.
 */
async function scrollToElement(page, locator, label) {
  console.log(`  → scroll to: ${label}`);
  await locator.evaluate((el) =>
    el.scrollIntoView({ behavior: "smooth", block: "center" })
  );
  await sleep(600);
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });

  // 1. Build
  console.log("Building...");
  execSync("npm run build --silent", { cwd: ROOT, stdio: "inherit" });

  // 2. Reset demo data (re-seed)
  console.log("Seeding demo data...");
  execSync(`node ${resolve(ROOT, "scripts/demo-seed.mjs")}`, {
    cwd: ROOT,
    stdio: "inherit",
  });

  // 3. Start server
  console.log("Starting server with demo data...");
  const server = spawn("node", ["dist/webServer.js"], {
    cwd: ROOT,
    env: { ...process.env, MEMOFLOW_DATA_DIR: "data/demo", PORT: "3210" },
    stdio: "pipe",
  });
  await sleep(2000);
  console.log("Server ready on :3210");

  // 4. Launch browser with recording
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: ARTIFACTS, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // 5. Mock the suggestion API for deterministic output
  await page.route("**/api/suggestions", async (route) => {
    if (route.request().method() === "POST") {
      await sleep(1200); // simulate LLM latency
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTION),
      });
    } else {
      await route.continue();
    }
  });

  // ================================================================
  // SCENE 1: /capture — type memo, save for later
  // ================================================================
  console.log("Scene 1: Capture page");
  await page.goto("http://127.0.0.1:3210/capture");
  await injectCursor(page);
  await sleep(1500);

  // Click textarea, type slowly
  const textarea = page.locator("#memoText");
  await pointAndClick(page, textarea, "textarea");
  await sleep(300);
  await textarea.type("pick up ibuprofen at Safeway", { delay: 65 });
  await sleep(1000);

  // Save for later
  await pointAndClick(page, page.locator("#saveDumpBtn"), "Save for later");
  await sleep(2000);

  // ================================================================
  // SCENE 2: Navigate to main workspace
  // ================================================================
  console.log("Scene 2: Navigate to workspace");
  // Click the "Open workspace" link on the capture page
  await scrollToElement(page, page.locator('a[href="/"]'), "Open workspace link");
  await pointAndClick(page, page.locator('a[href="/"]'), "Open workspace");
  await injectCursor(page);
  await sleep(2000);

  // ================================================================
  // SCENE 3: Switch to Pending view
  // ================================================================
  console.log("Scene 3: Pending view");
  await pointAndClick(page, page.locator('li[data-view="pending"]'), "Pending nav");
  await sleep(1500);

  // Click Review on the pending dump
  await scrollToElement(page, page.locator('#pendingDumps [data-action="review"]'), "Review button");
  await pointAndClick(page, page.locator('#pendingDumps [data-action="review"]'), "Review");
  await sleep(1000);

  // ================================================================
  // SCENE 4: Generate suggestion
  // ================================================================
  console.log("Scene 4: Generate suggestion");

  // Select "llm" from the parser dropdown
  const parserSelect = page.locator("[data-review-parser]");
  await pointAndClick(page, parserSelect, "Parser dropdown");
  await parserSelect.selectOption("llm");
  await sleep(400);

  // Ensure context and memory are checked
  const memCheckbox = page.locator("[data-review-memory]");
  const ctxCheckbox = page.locator("[data-review-context]");
  if (!(await memCheckbox.isChecked())) {
    await pointAndClick(page, memCheckbox, "Use memory checkbox");
  }
  if (!(await ctxCheckbox.isChecked())) {
    await pointAndClick(page, ctxCheckbox, "Use context checkbox");
  }
  await sleep(500);

  // Click Generate review
  await scrollToElement(page, page.locator('[data-action="generate-review"]'), "Generate review button");
  await pointAndClick(page, page.locator('[data-action="generate-review"]'), "Generate review");
  await sleep(2000); // wait for mock response + render

  // ================================================================
  // SCENE 5: Related item detection
  // ================================================================
  console.log("Scene 5: Related item detection");
  // Wait for the suggestion card and related item to appear
  await page.waitForSelector('[data-action="update-existing"]', {
    timeout: 10000,
  });

  // Scroll to the suggestion card so viewer sees the related item
  await scrollToElement(page, page.locator('[data-action="update-existing"]').first(), "Update existing button");
  await sleep(3000);

  // ================================================================
  // SCENE 6: Update existing instead
  // ================================================================
  console.log("Scene 6: Update existing instead");
  await pointAndClick(page, page.locator('[data-action="update-existing"]').first(), "Update existing instead");
  await sleep(2000);

  // Wait for editor to load and scroll to it
  await page.waitForSelector("[data-existing-field='title']", {
    timeout: 10000,
  });
  await scrollToElement(page, page.locator("[data-existing-field='title']"), "Editor title field");
  await sleep(2000);

  // ================================================================
  // SCENE 7: Save the existing item to complete the loop
  // ================================================================
  console.log("Scene 7: Save existing item");
  await scrollToElement(page, page.locator('[data-action="save-existing"]'), "Save existing item button");
  await pointAndClick(page, page.locator('[data-action="save-existing"]'), "Save existing item");
  await sleep(2500);

  // ================================================================
  // SCENE 8: Hold on completed state
  // ================================================================
  console.log("Scene 8: Hold");
  await sleep(2000);

  // 6. Cleanup
  console.log("Saving recording...");
  const video = page.video();
  await context.close();
  await browser.close();

  const videoPath = await video.path();
  console.log(`Video saved: ${videoPath}`);

  // Convert to mp4 if ffmpeg is available
  try {
    const mp4Path = resolve(ARTIFACTS, "memoflow-demo.mp4");
    execSync(
      `ffmpeg -y -i "${videoPath}" -c:v libx264 -preset fast -crf 23 -an "${mp4Path}"`,
      { stdio: "pipe" }
    );
    console.log(`MP4 saved: ${mp4Path}`);
  } catch {
    console.log("ffmpeg not available, skipping MP4 conversion");
    console.log(`WebM available at: ${videoPath}`);
  }

  // Stop server
  server.kill();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Demo recording failed:", err);
  process.exit(1);
});

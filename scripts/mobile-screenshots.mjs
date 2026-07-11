import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCREENSHOT_DIR = resolve(ROOT, "screenshots", "mobile");
const DATA_DIR = resolve(ROOT, "data", "mobile-screenshots");
const DATA_DIR_REL = "data/mobile-screenshots";
const PORT = Number(process.env.MEMOFLOW_SCREENSHOT_PORT ?? 3310);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const VIEWPORTS = [
  { width: 375, height: 812, name: "375x812" },
  { width: 390, height: 844, name: "390x844" },
  { width: 430, height: 932, name: "430x932" },
];

const MOCK_SUGGESTIONS = {
  suggestions: [
    {
      type: "task",
      title: "Follow up with Lance about lunch plans and confirm the right item before updating it again",
      description:
        "Review the existing Lance-related item, confirm whether this is a duplicate or continuation, and then save the corrected item details.",
      status: "ready",
      confidence: 0.91,
      needs_clarification: false,
      clarification_question: null,
      missing_context: [],
      suggested_fields: {
        due_date: "2026-07-15",
        waiting_on: "Lance reply",
        tags: ["lunch", "follow-up"],
        category: "personal",
        url: "https://example.com/lance-lunch-context",
        follow_up_needed: true,
      },
      related_existing_items: [
        {
          item_id: "itm_lance_existing",
          relationship: "possible_duplicate",
          reason: "Looks related to your existing Lance lunch item from a previous capture.",
          confidence: 0.82,
        },
      ],
    },
  ],
};

const ITEMS = [
  {
    id: "itm_lance_existing",
    type: "task",
    title: "Lance lunch follow-up and next steps",
    status: "ready",
    description: "Keep the current Lance thread active until lunch details and next actions are resolved.",
    created_at: "2026-07-06T09:00:00.000Z",
    updated_at: "2026-07-07T12:15:00.000Z",
    archived_at: null,
    source: { kind: "manual" },
    fields: {
      due_date: "2026-07-12",
      tags: ["lance", "lunch"],
      category: "personal",
    },
  },
  {
    id: "itm_mobile_layout",
    type: "task",
    title: "Fix MemoFlow mobile PWA item title wrapping without turning the app into a desktop CRUD layout squeezed onto a phone",
    status: "ready",
    description: "Long task title intended to surface wrapping, clamping, and metadata layout issues on narrow screens.",
    created_at: "2026-07-05T09:00:00.000Z",
    updated_at: "2026-07-07T15:45:00.000Z",
    archived_at: null,
    source: { kind: "manual" },
    fields: {
      follow_up_date: "2026-07-18",
      category: "product",
      tags: ["mobile", "pwa", "ui"],
    },
  },
  {
    id: "itm_archived",
    type: "reference",
    title: "Archived MemoFlow note for regression checking",
    status: "archived",
    description: "Used to verify archived rows stay compact and reversible.",
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-03T10:00:00.000Z",
    archived_at: "2026-07-03T10:00:00.000Z",
    source: { kind: "manual" },
    fields: {},
  },
];

const MEMORY = [
  {
    id: "mem_long",
    text: "Lance usually prefers weekday lunch near the office, and the phone screenshot showed that long memory text was getting clipped instead of wrapping correctly across multiple lines on mobile.",
    created_at: "2026-07-06T10:00:00.000Z",
    updated_at: "2026-07-07T09:30:00.000Z",
    archived_at: null,
  },
  {
    id: "mem_short",
    text: "Safeway is still the usual pharmacy.",
    created_at: "2026-07-05T10:00:00.000Z",
    updated_at: "2026-07-05T10:00:00.000Z",
    archived_at: null,
  },
];

const DUMPS = [
  {
    id: "dump_mobile_review",
    raw_text: "Need to follow up with Lance about lunch and see if this should update the existing item.",
    status: "pending",
    created_at: "2026-07-07T18:00:00.000Z",
    updated_at: "2026-07-07T18:00:00.000Z",
    reviewed_at: null,
    ignored_at: null,
    source: "web",
  },
];

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function seedScreenshotData() {
  rmSync(DATA_DIR, { recursive: true, force: true });
  ensureDir(DATA_DIR);
  writeJsonl(resolve(DATA_DIR, "items.jsonl"), ITEMS);
  writeJsonl(resolve(DATA_DIR, "memory.jsonl"), MEMORY);
  writeJsonl(resolve(DATA_DIR, "dumps.jsonl"), DUMPS);
}

async function waitForServer(server) {
  await new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => {
      rejectReady(new Error("Timed out waiting for MemoFlow screenshot server."));
    }, 15000);

    server.stdout.on("data", (chunk) => {
      const text = String(chunk);
      process.stdout.write(text);
      if (text.includes("MemoFlow webapp running at")) {
        clearTimeout(timeout);
        resolveReady();
      }
    });

    server.stderr.on("data", (chunk) => {
      process.stderr.write(String(chunk));
    });

    server.on("exit", (code, signal) => {
      clearTimeout(timeout);
      rejectReady(new Error(`Screenshot server exited early (code=${code}, signal=${signal})`));
    });
  });
}

async function captureView(page, fileName) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  console.log(`${fileName} overflow: ${JSON.stringify(overflow)}`);
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, fileName),
    fullPage: false,
  });
}

async function openWorkspaceView(page, view) {
  await page.locator(`li[data-view="${view}"]`).click();
  await page.waitForTimeout(250);
}

async function captureViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    screen: { width: viewport.width, height: viewport.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  await page.route("**/api/suggestions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTIONS),
      });
      return;
    }
    await route.continue();
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.fill("#rawText", "Follow up with Lance about lunch and make sure the right item stays visible.");
  await captureView(page, `${viewport.name}-capture.png`);

  await openWorkspaceView(page, "items");
  await captureView(page, `${viewport.name}-items.png`);

  await openWorkspaceView(page, "memory");
  await captureView(page, `${viewport.name}-memory.png`);

  await openWorkspaceView(page, "pending");
  await captureView(page, `${viewport.name}-pending.png`);

  await page.locator('#pendingDumps [data-action="review"]').first().click();
  await page.locator('[data-review-parser]').selectOption("stub");
  await page.locator('[data-action="generate-review"]').click();
  await page.waitForSelector('.suggestion-card [data-field="due_date"]');
  await captureView(page, `${viewport.name}-pending-review.png`);
  await page.locator('.suggestion-card [data-field="due_date"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await captureView(page, `${viewport.name}-pending-review-form.png`);
  await page.locator('.suggestion-card [data-action="approve"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await captureView(page, `${viewport.name}-pending-review-actions.png`);

  await context.close();
}

async function main() {
  ensureDir(SCREENSHOT_DIR);
  seedScreenshotData();
  execSync("npm run build --silent", { cwd: ROOT, stdio: "inherit" });

  const server = spawn("node", ["dist/webServer.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      MEMOFLOW_DATA_DIR: DATA_DIR_REL,
      PORT: String(PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(server);
    const browser = await chromium.launch({
      headless: true,
      channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    });
    try {
      for (const viewport of VIEWPORTS) {
        console.log(`Capturing ${viewport.name}...`);
        await captureViewport(browser, viewport);
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function findFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine free port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function waitForServer(baseUrl: string, server: ChildProcessWithoutNullStreams): Promise<void> {
  const start = Date.now();
  let lastError = "Server did not start";

  while (Date.now() - start < 15000) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited early with code ${server.exitCode}`);
    }

    try {
      const res = await fetch(baseUrl + "/");
      if (res.ok) return;
      lastError = `Unexpected status ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for server: ${lastError}`);
}

async function fetchOk(url: string, contentTypeIncludes?: string): Promise<void> {
  const res = await fetch(url);
  expect(res.status === 200, `Expected 200 for ${url}, got ${res.status}`);
  if (contentTypeIncludes) {
    const contentType = res.headers.get("content-type") ?? "";
    expect(
      contentType.includes(contentTypeIncludes),
      `Expected content-type containing "${contentTypeIncludes}" for ${url}, got "${contentType}"`,
    );
  }
}

const tempDir = await mkdtemp(join(tmpdir(), "memoflow-smoke-eval-"));
const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn("node", ["dist/webServer.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    MEMOFLOW_DATA_DIR: tempDir,
  },
  stdio: "pipe",
});

let stderr = "";
server.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

const tests: TestCase[] = [
  {
    name: "/ loads",
    run: async () => {
      await fetchOk(baseUrl + "/", "text/html");
    },
  },
  {
    name: "/capture loads",
    run: async () => {
      await fetchOk(baseUrl + "/capture", "text/html");
    },
  },
  {
    name: "/manifest.webmanifest loads",
    run: async () => {
      await fetchOk(baseUrl + "/manifest.webmanifest", "application/manifest+json");
    },
  },
  {
    name: "/sw.js loads",
    run: async () => {
      await fetchOk(baseUrl + "/sw.js", "application/javascript");
    },
  },
  {
    name: "icons load",
    run: async () => {
      await fetchOk(baseUrl + "/icons/icon.svg", "image/svg+xml");
      await fetchOk(baseUrl + "/icons/icon-192.png", "image/png");
      await fetchOk(baseUrl + "/icons/icon-512.png", "image/png");
      await fetchOk(baseUrl + "/icons/apple-touch-icon-180.png", "image/png");
    },
  },
];

let passed = 0;

try {
  await waitForServer(baseUrl, server);

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
  server.kill("SIGINT");
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (server.exitCode === null) {
    server.kill("SIGKILL");
  }
  await rm(tempDir, { recursive: true, force: true });
}

console.log("");
console.log("Summary:");
console.log(`${passed}/${tests.length} passed`);

if (stderr.trim()) {
  console.log("");
  console.log("Server stderr:");
  console.log(stderr.trim());
}

if (passed !== tests.length) {
  process.exitCode = 1;
}

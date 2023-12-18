import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { UnstableDevWorker } from "wrangler";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { unstable_dev } from "wrangler";

describe("Test D1 Worker endpoint", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    try {
      rmSync(".wrangler", { recursive: true, force: true });
      execSync("wrangler d1 migrations apply attend-stamp --local");
      execSync(
        "wrangler d1 execute attend-stamp --local --file=tests/simple-case.sql",
      );
    } catch (ignore) {
      console.error(ignore);
    }

    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  test("logout will be done successfully", async () => {
    const resp = await worker.fetch("/logout", {
      method: "POST",
    });
    expect(resp.status).toBe(200);
  });
});

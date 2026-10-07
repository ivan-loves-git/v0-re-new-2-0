import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

describe("M&A QA command safety", () => {
  it("rejects a remote database in its default disposable mode without echoing credentials", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", resolve("scripts/qa-ma-directory.ts")],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          MA_QA_DATABASE_URL:
            "postgresql://private-user:never-print-password@db.example.com/postgres",
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Disposable M&A QA requires loopback /directory",
    );
    for (const privateText of [
      "never-print-password",
      "private-user",
      "db.example.com",
    ]) {
      expect(result.stdout + result.stderr).not.toContain(privateText);
    }
  });
  it("blocks live write commands before connecting when their treatment is absent", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve("scripts/qa-ma-directory.ts"),
        "cleanup",
        "--target",
        "live",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          MA_QA_ALLOW_LIVE_CLEANUP: "",
          MA_QA_DATABASE_URL:
            "postgresql://private-user:never-print-password@db.example.com/postgres",
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires explicit treatment");
    for (const privateText of [
      "never-print-password",
      "private-user",
      "db.example.com",
    ]) {
      expect(result.stdout + result.stderr).not.toContain(privateText);
    }
  });
});

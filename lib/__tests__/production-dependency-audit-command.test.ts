import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

function audit(report: string, status = 1) {
  const root = mkdtempSync(join(tmpdir(), "renew-audit-command-"));
  roots.push(root);
  const checkout = join(root, "checkout with spaces");
  mkdirSync(checkout);
  const command = join(checkout, "audit.mjs");
  copyFileSync(resolve("scripts/verify-production-dependency-audit.mjs"), command);
  writeFileSync(join(root, "pnpm"), '#!/bin/sh\nprintf "%s" "$RENEW_AUDIT_REPORT"\nexit "$RENEW_AUDIT_STATUS"\n', { mode: 0o755 });
  return spawnSync(process.execPath, [command, "--run"], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${root}:${process.env.PATH}`, RENEW_AUDIT_REPORT: report, RENEW_AUDIT_STATUS: String(status) },
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("production dependency audit command", () => {
  it("blocks a High finding even when the checkout path contains spaces", () => {
    const result = audit(JSON.stringify({ advisories: { vulnerability: {
      module_name: "unsafe-production-module", severity: "high", id: "GHSA-synthetic",
    } } }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("production-dependency-audit-failed");
  });

  it("accepts Moderate-only findings despite pnpm's nonzero audit exit", () => {
    const result = audit(JSON.stringify({ advisories: { vulnerability: {
      module_name: "moderate-module", severity: "moderate", id: "GHSA-synthetic",
    } } }));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Production dependency audit passed.");
  });

  it.each(["not json", JSON.stringify({ error: "registry unavailable" })])("blocks an invalid registry report: %s", (report) => {
    expect(audit(report).status).toBe(1);
  });

  it("blocks an unexpected audit-process failure with an empty report", () => {
    expect(audit(JSON.stringify({ advisories: {} }), 2).status).toBe(1);
  });
});

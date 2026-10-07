import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
const checker = resolve("scripts/check-commit-message.mjs");
const installer = resolve("scripts/install-git-hooks.mjs");
function temporary() {
  const root = mkdtempSync(join(tmpdir(), "renew-commit-command-"));
  roots.push(root);
  return root;
}
function run(root: string, command: string, args: string[]) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8" });
}
function git(root: string, ...args: string[]) {
  const result = run(root, "git", args);
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
function repository() {
  const root = temporary();
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Synthetic QA");
  git(root, "config", "user.email", "qa@re-new.invalid");
  git(root, "config", "commit.gpgsign", "false");
  git(root, "commit", "--allow-empty", "-m", "Historical message before enforcement");
  return root;
}
function message(value: string) {
  const root = temporary();
  const path = join(root, "message.txt");
  writeFileSync(path, value);
  return run(root, process.execPath, [checker, path]);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("commit message command", () => {
  it("accepts each documented type and an optional explanation", () => {
    for (const type of ["feat", "fix", "refactor", "style", "docs", "chore"]) {
      expect(message(`${type}: make the verification result clear\n\nExplain the reason.\n`).status).toBe(0);
    }
  });

  it("rejects undocumented types and missing descriptions", () => {
    for (const value of ["test: add a fixture", "fix:", "fix: ", "fix(scope): change", "change without a type"]) {
      expect(message(value).status).toBe(1);
    }
  });

  it("accepts 71 characters and rejects 72 on the first line", () => {
    expect(message(`fix: ${"a".repeat(66)}`).status).toBe(0);
    expect(message(`fix: ${"a".repeat(67)}`).status).toBe(1);
  });

  it("rejects generated attribution in the body", () => {
    expect(message("fix: validate a fixture\n\nGenerated with Claude Code").status).toBe(1);
  });

  it("checks only new authored commits, skips actual merges and rejects a bypassed invalid commit", () => {
    const root = repository();
    const base = git(root, "rev-parse", "HEAD");
    git(root, "switch", "-c", "topic");
    git(root, "commit", "--allow-empty", "-m", "fix: validate a fixture");
    git(root, "switch", "main");
    git(root, "commit", "--allow-empty", "-m", "docs: explain fixture setup");
    git(root, "merge", "--no-ff", "topic", "-m", "Merge branch topic");
    const valid = run(root, process.execPath, [checker, "--range", `${base}..HEAD`]);
    expect(valid.status).toBe(0);
    expect(valid.stdout).toContain("2 authored commit messages passed.");
    git(root, "commit", "--allow-empty", "-m", "test: invalid prefix bypassing a local hook");
    const invalid = run(root, process.execPath, [checker, "--range", `${base}..HEAD`]);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain(git(root, "rev-parse", "--short=12", "HEAD"));
  });

  it("installs the native Git hook and blocks an invalid commit before it exists", () => {
    const root = repository();
    mkdirSync(join(root, "scripts"));
    copyFileSync(checker, join(root, "scripts/check-commit-message.mjs"));
    cpSync(resolve(".githooks"), join(root, ".githooks"), { recursive: true });
    const before = git(root, "rev-parse", "HEAD");
    expect(run(root, process.execPath, [installer]).status).toBe(0);
    expect(run(root, "git", ["commit", "--allow-empty", "-m", "test: invalid prefix"]).status).not.toBe(0);
    expect(git(root, "rev-parse", "HEAD")).toBe(before);
    git(root, "commit", "--allow-empty", "-m", "chore: install verification checks");
    expect(git(root, "rev-parse", "HEAD")).not.toBe(before);
  });

  it("preserves an existing different hooks path", () => {
    const root = repository();
    git(root, "config", "core.hooksPath", "existing-hooks");
    expect(run(root, process.execPath, [installer]).status).toBe(1);
    expect(git(root, "config", "--get", "core.hooksPath")).toBe("existing-hooks");
  });

  it("preserves an active default hook", () => {
    const root = repository();
    const path = join(root, ".git/hooks/commit-msg");
    const original = "#!/bin/sh\nexit 0\n";
    writeFileSync(path, original, { mode: 0o755 });
    expect(run(root, process.execPath, [installer]).status).toBe(1);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("blocks a native Git push with a High audit finding and permits Moderate-only findings", () => {
    const root = repository();
    mkdirSync(join(root, "scripts"));
    for (const file of ["check-commit-message.mjs", "verify-production-dependency-audit.mjs", "production-dependency-audit-policy.json"]) {
      copyFileSync(resolve("scripts", file), join(root, "scripts", file));
    }
    cpSync(resolve(".githooks"), join(root, ".githooks"), { recursive: true });
    const manifest = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ private: true, packageManager: manifest.packageManager, scripts: { "security:audit": manifest.scripts["security:audit"] } }));
    git(root, "add", ".");
    git(root, "commit", "-m", "chore: install verification checks");
    expect(run(root, process.execPath, [installer]).status).toBe(0);

    const remote = temporary();
    git(remote, "init", "--bare");
    git(root, "remote", "add", "origin", remote);
    const registry = temporary();
    const pnpm = run(root, "which", ["pnpm"]).stdout.trim();
    expect(pnpm).not.toBe("");
    writeFileSync(join(registry, "pnpm"), '#!/bin/sh\nif [ "$1" = "audit" ]; then\n  printf "%s" "$RENEW_AUDIT_REPORT"\n  exit 1\nfi\nexec "$RENEW_REAL_PNPM" "$@"\n', { mode: 0o755 });
    const push = (severity: string) => spawnSync("git", ["push", "origin", "main"], {
      cwd: root, encoding: "utf8",
      env: { ...process.env, PATH: `${registry}:${process.env.PATH}`, RENEW_REAL_PNPM: pnpm,
        RENEW_AUDIT_REPORT: JSON.stringify({ advisories: { synthetic: { module_name: "registry-fixture", id: "GHSA-synthetic", severity } } }) },
    });
    const blocked = push("high");
    expect(blocked.status).not.toBe(0);
    expect(blocked.stderr).toContain("production-dependency-audit-failed");
    expect(git(root, "ls-remote", "origin", "refs/heads/main")).toBe("");
    const allowed = push("moderate");
    expect(allowed.status, allowed.stderr + allowed.stdout).toBe(0);
    expect(git(root, "ls-remote", "origin", "refs/heads/main")).toContain(git(root, "rev-parse", "HEAD"));
  }, 15_000);
});

import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const script = resolve("scripts/vercel-ignore-build.mjs");
const repositories: string[] = [];

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "renew-build-filter-"));
  repositories.push(cwd);
  const git = (...args: string[]) => execFileSync("git", args, {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const write = (file: string, text = "updated") => {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), text);
  };
  const commit = () => {
    git("add", "--all");
    git("commit", "-qm", "synthetic change");
    return git("rev-parse", "HEAD");
  };
  git("init", "-q");
  git("config", "user.name", "Synthetic Test");
  git("config", "user.email", "test@example.invalid");
  write("app/page.tsx", "original");
  write("README.md", "original");
  const base = commit();
  const run = (env: Record<string, string> = {}) => spawnSync(process.execPath, [script], {
    cwd, encoding: "utf8",
    env: {
      ...process.env,
      RENEW_FORCE_BUILD: "0",
      VERCEL_GIT_PREVIOUS_SHA: base,
      VERCEL_GIT_COMMIT_SHA: git("rev-parse", "HEAD"),
      ...env,
    },
  });
  return { cwd, git, write, commit, base, run };
}

afterEach(() => {
  for (const cwd of repositories.splice(0)) rmSync(cwd, { recursive: true, force: true });
});

describe("Vercel build storage prevention", () => {
  it("skips only repository documentation and agent instructions", () => {
    const repo = fixture();
    repo.write("README.md");
    repo.write("docs/a document\nwith spaces.md");
    repo.write(".agents/skills/example/SKILL.md");
    repo.commit();
    const result = repo.run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("only repository documentation");
  });

  it.each([
    "app/page.tsx", "components/guide/roadmap.tsx", "lib/rules.ts",
    "public/instructions.md", "docs/runtime.json", "package.json",
    "pnpm-lock.yaml", "next.config.mjs", "vercel.json", "scripts/helper.mjs",
    "new-directory/content.md",
  ])("builds when %s changes, even alongside documentation", (file) => {
    const repo = fixture();
    repo.write("README.md");
    repo.write(file);
    repo.commit();
    expect(repo.run().status).toBe(1);
  });

  it("includes application changes before the last documentation commit in a push", () => {
    const repo = fixture();
    repo.write("app/page.tsx");
    repo.commit();
    repo.write("README.md");
    repo.commit();
    expect(repo.run().status).toBe(1);
  });

  it("builds when application code is deleted or renamed into documentation", () => {
    const repo = fixture();
    mkdirSync(join(repo.cwd, "docs"));
    renameSync(join(repo.cwd, "app/page.tsx"), join(repo.cwd, "docs/retired.md"));
    repo.commit();
    expect(repo.run().status).toBe(1);
  });

  it("allows same-commit redeployments for environment changes", () => {
    const repo = fixture();
    expect(repo.run().status).toBe(1);
  });

  it("allows an explicit rebuild of a documentation-only change", () => {
    const repo = fixture();
    repo.write("README.md");
    repo.commit();
    expect(repo.run({ RENEW_FORCE_BUILD: "1" }).status).toBe(1);
  });

  it.each(["", "HEAD^", "0".repeat(40), "a".repeat(40)])("builds when the previous deployment cannot be verified: %s", (previous) => {
    const repo = fixture();
    repo.write("README.md");
    repo.commit();
    expect(repo.run({ VERCEL_GIT_PREVIOUS_SHA: previous }).status).toBe(1);
  });

  it("builds when the deployment metadata does not match the checkout", () => {
    const repo = fixture();
    repo.write("README.md");
    repo.commit();
    expect(repo.run({ VERCEL_GIT_COMMIT_SHA: "b".repeat(40) }).status).toBe(1);
  });

  it("builds when Git inspection fails", () => {
    const repo = fixture();
    repo.write("README.md");
    const current = repo.commit();
    rmSync(join(repo.cwd, ".git"), { recursive: true });
    const result = spawnSync(process.execPath, [script], {
      cwd: repo.cwd,
      env: { ...process.env, RENEW_FORCE_BUILD: "0", VERCEL_GIT_PREVIOUS_SHA: repo.base, VERCEL_GIT_COMMIT_SHA: current },
    });
    expect(result.status).toBe(1);
  });
});

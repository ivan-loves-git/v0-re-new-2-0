#!/usr/bin/env node

// Vercel runs this before installing dependencies: 0 skips, 1 builds.
import { execFileSync } from "node:child_process";

const documentationFiles = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "DESIGN.md",
  "README.md",
  "START-HERE.md",
]);

function isDocumentation(path) {
  return documentationFiles.has(path) ||
    /^(docs|\.agents|\.agent|\.codex|\.claude|\.cursor|\.gemini|\.opencode)\/.*\.md$/s.test(path);
}

function decide() {
  if (process.env.RENEW_FORCE_BUILD === "1") {
    return "RENEW_FORCE_BUILD requested a build";
  }

  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const current = process.env.VERCEL_GIT_COMMIT_SHA;
  const isCommit = (value) => /^[a-f0-9]{40}$/i.test(value ?? "");
  if (!isCommit(previous) || !isCommit(current)) {
    return "no verified previous/current Git deployment pair";
  }
  if (previous === current) {
    return "same-commit redeployment may contain environment changes";
  }

  const git = (args) => execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
    maxBuffer: 4 * 1024 * 1024,
  });

  try {
    if (git(["rev-parse", "HEAD"]).trim() !== current) {
      return "checkout does not match the requested deployment";
    }
    // Compare the last successful deployment, not HEAD^: a push may contain
    // several commits, including an application change followed by docs.
    // --no-renames keeps BOTH paths when code is moved into a docs directory.
    const files = git([
      "diff", "--name-only", "--no-renames", "-z", previous, current, "--",
    ]).split("\0").filter(Boolean);
    if (files.length === 0) return "empty diff may be an intentional rebuild";
    if (!files.every(isDocumentation)) return "application, configuration or unknown files changed";
    return null;
  } catch {
    // Vercel uses shallow clones. Missing history or any inspection error
    // must permit the build; never fetch or guess a replacement baseline.
    return "Git history could not be checked safely";
  }
}

const reason = decide();
console.log(reason ? `Build: ${reason}.` : "Skip: only repository documentation changed since the last successful deployment.");
process.exitCode = reason ? 1 : 0;

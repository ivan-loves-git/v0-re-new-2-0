import { existsSync } from "node:fs"
import { execFileSync, spawnSync } from "node:child_process"

const configured = spawnSync("git", ["config", "--get", "core.hooksPath"], { encoding: "utf8" })
if (configured.error || ![0, 1].includes(configured.status)) throw new Error("git-hooks-config-unavailable")
const hooksPath = configured.stdout.trim()
if (hooksPath && hooksPath !== ".githooks") throw new Error("git-hooks-existing-path-preserved")
if (!hooksPath) {
  const defaultPath = execFileSync("git", ["rev-parse", "--git-path", "hooks"], { encoding: "utf8" }).trim()
  if (["commit-msg", "pre-push"].some((hook) => existsSync(`${defaultPath}/${hook}`))) {
    throw new Error("git-hooks-existing-default-hooks-preserved")
  }
}
execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"])
process.stdout.write("Repository-local commit-message and pre-push checks installed.\n")

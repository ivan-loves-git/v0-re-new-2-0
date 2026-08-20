import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { prepareReleaseBuildNumber } from "../lib/release-build-bump.mjs"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const releaseBuildPath = resolve(root, "lib/release-build.mjs")
const currentCommitCount = Number(execFileSync("git", ["rev-list", "--count", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim())
let releaseBuildSource

try {
  releaseBuildSource = readFileSync(releaseBuildPath, "utf8")
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
}

const prepared = prepareReleaseBuildNumber({ releaseBuildSource, currentCommitCount })
writeFileSync(releaseBuildPath, prepared.source)

console.log(`Prepared release build ${prepared.buildNumber}. Commit this file with the production change.`)

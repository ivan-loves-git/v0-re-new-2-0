import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { checkReleaseBuildNumber } from "../lib/release-build-check.mjs"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const releaseBuildSource = readFileSync(resolve(root, "lib/release-build.mjs"), "utf8")
const runGit = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" })

console.log(checkReleaseBuildNumber({ releaseBuildSource, runGit }))

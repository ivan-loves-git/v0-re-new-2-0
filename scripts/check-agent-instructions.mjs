import { lstatSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const entrypoints = ["AGENTS.md", "CLAUDE.md", "START-HERE.md", "docs/TESTING_RELEASE_PROTOCOL.md"]
const retiredDirectives = [
  ["retired_sprint_orchestration", /Renew Sprint supplies orchestration/i],
  ["retired_model_trial", /\bcurrent model\/usage trial\b/i],
  ["retired_fixed_supervisor", /\bOne supervisor owns tracker state, integration and release\b/i],
  ["retired_worker_duties", /\b(?:mandatory|required)\s+(?:quota readings|worker-model overrides?|sprint supervisor|wave plan)\b/i],
]

export function checkInstructions(root = process.cwd()) {
  const findings = []
  for (const file of entrypoints) {
    try {
      const full = resolve(root, file)
      if (!lstatSync(full).isFile() || lstatSync(full).isSymbolicLink()) throw new Error("not_regular")
      // Historical ADRs are deliberately outside these active entrypoints.
      const lines = readFileSync(full, "utf8").split(/\r?\n/)
      for (let line = 0; line < lines.length; line++) {
        for (const [rule, pattern] of retiredDirectives) {
          if (pattern.test(lines[line])) findings.push({ file, line: line + 1, rule })
        }
      }
    } catch {
      findings.push({ file, line: null, rule: "entrypoint_missing_or_unreadable" })
    }
  }
  return { state: findings.length ? "fail" : "pass", findings }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== "--root")) {
    process.stderr.write("Usage: node scripts/check-agent-instructions.mjs [--root path]\n")
    process.exitCode = 2
  } else {
    const result = checkInstructions(args[1])
    process.stdout.write(`${JSON.stringify(result)}\n`)
    process.exitCode = result.state === "pass" ? 0 : 1
  }
}

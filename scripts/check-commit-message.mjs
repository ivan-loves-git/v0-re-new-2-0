import { readFileSync } from "node:fs"
import { execFileSync, spawnSync } from "node:child_process"

function check(message) {
  const subject = message.split(/\r?\n/, 1)[0]
  if (!/^(feat|fix|refactor|style|docs|chore): \S.*$/.test(subject)) {
    throw new Error("commit-message-requires-documented-type-and-description")
  }
  if ([...subject].length >= 72) throw new Error("commit-message-first-line-must-be-under-72-characters")
  if (/generated with claude code/i.test(message)) throw new Error("commit-message-generated-attribution-forbidden")
}

const args = process.argv.slice(2)
try {
  if (args.length === 1 && args[0] !== "--range") {
    check(readFileSync(args[0], "utf8"))
    process.stdout.write("Commit message passed.\n")
  } else if (args.length === 2 && args[0] === "--range") {
    const refs = args[1].split("..")
    if (refs.length !== 2 || refs.some((ref) => !ref)) throw new Error("commit-message-range-invalid")
    const [base, head] = refs.map((ref) => execFileSync("git", ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], { encoding: "utf8" }).trim())
    const adoption = execFileSync("git", ["log", "--reverse", "--diff-filter=A", "--format=%H", head, "--", "scripts/check-commit-message.mjs"], { encoding: "utf8" }).trim().split("\n").filter(Boolean)[0]
    const commits = execFileSync("git", ["rev-list", "--no-merges", "--reverse", `${base}..${head}`], { encoding: "utf8" }).trim().split("\n").filter(Boolean).filter((sha) => {
      if (!adoption) return true
      const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", adoption, sha])
      if (ancestry.status === 0) return true
      if (ancestry.status === 1) return false
      throw new Error("commit-message-adoption-ancestry-unavailable")
    })
    for (const sha of commits) {
      const message = execFileSync("git", ["show", "-s", "--format=%B", sha], { encoding: "utf8" })
      try { check(message) } catch (error) {
        throw new Error(`${sha.slice(0, 12)}: ${error.message}`)
      }
    }
    process.stdout.write(`${commits.length} authored commit messages passed.\n`)
  } else {
    throw new Error("Usage: pnpm commit:check <message-file> | --range <base>..<head>")
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}

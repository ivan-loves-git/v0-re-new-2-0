import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const roots = ["app", "components", "lib"]
const extensions = new Set([".js", ".jsx", ".ts", ".tsx", ".css"])
const ignoredPrefixes = ["components/evilcharts/"]
const ignoredFiles = new Set(["app/twitter-image.tsx"])

const ruleExceptions = {
  "decorative-gradient": new Set([
    "components/dashboard/activity-heatmap.tsx",
    "components/dashboard/card-skeleton.tsx",
  ]),
  "unmanaged-micro-label": new Set(["components/ui/table.tsx"]),
}

const rules = [
  {
    id: "decorative-accent-edge",
    pattern: /border-(?:l|r|t)-(?:[2-9]|\[[^\]]+\])/,
    message: "Use a complete one-pixel border, a semantic tint, or no accent edge.",
  },
  {
    id: "ghost-card",
    pattern: /shadow-(?:xl|2xl)/,
    message: "Persistent product surfaces cannot use wide soft shadows.",
  },
  {
    id: "oversized-card-radius",
    pattern: /rounded-(?:2xl|3xl)/,
    message: "Persistent product surfaces top out at the governed 12px radius.",
  },
  {
    id: "decorative-gradient",
    pattern: /bg-gradient-to-|repeating-linear-gradient/,
    message: "Use a flat surface or semantic tint. Gradients are reserved for approved functional cues and chart internals.",
  },
  {
    id: "staggered-page-load",
    pattern: /animate-fade-in|animationDelay/,
    message: "Operational content must be immediately visible. Motion is for state feedback, not page choreography.",
  },
  {
    id: "isolated-purple-treatment",
    pattern: /\b(?:text|bg|border|from|via|to)-purple-/,
    message: "Use Re-New semantic tokens rather than a one-off purple treatment.",
  },
  {
    id: "unmanaged-micro-label",
    pattern: /(?:uppercase[^\n]*tracking|tracking[^\n]*uppercase)/,
    message: "Use the approved .wave-micro-label class instead of inventing local uppercase and tracking values.",
  },
]

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(absolute))
    if (entry.isFile() && extensions.has(path.extname(entry.name))) files.push(absolute)
  }

  return files
}

const files = (await Promise.all(roots.map(walk))).flat()
const findings = []

for (const file of files) {
  const relative = file.split(path.sep).join("/")
  if (ignoredFiles.has(relative) || ignoredPrefixes.some((prefix) => relative.startsWith(prefix))) continue

  const lines = (await readFile(file, "utf8")).split("\n")
  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (path.extname(relative) === ".css" && rule.id !== "decorative-gradient") continue
      if (ruleExceptions[rule.id]?.has(relative)) continue
      if (rule.pattern.test(line)) {
        findings.push({ file: relative, line: index + 1, rule: rule.id, message: rule.message })
      }
    }
  })
}

if (findings.length > 0) {
  console.error("WAVE visual policy failed:\n")
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`)
  }
  process.exitCode = 1
} else {
  console.log("WAVE visual policy: clean")
}

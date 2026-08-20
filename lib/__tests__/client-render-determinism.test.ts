import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

const root = resolve(process.cwd())

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8")
}

function clientSources(directory: string): Array<{ path: string; source: string }> {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return clientSources(path)
    if (!/\.[jt]sx?$/.test(entry.name)) return []
    const fileSource = source(path)
    return fileSource.startsWith('"use client"') || fileSource.startsWith("'use client'")
      ? [{ path, source: fileSource }]
      : []
  })
}

describe("client first-render determinism", () => {
  it("keeps sidebar skeleton dimensions stable across server render and hydration", () => {
    const sidebar = source("components/ui/sidebar.tsx")

    expect(sidebar).not.toContain("Math.random()")
    expect(sidebar).toContain('const SIDEBAR_MENU_SKELETON_WIDTH = "70%"')
    expect(sidebar).toContain('"--skeleton-width": SIDEBAR_MENU_SKELETON_WIDTH')
  })

  it("does not derive rendered keys or filter options from the host locale", () => {
    for (const { path, source: clientSource } of [
      ...clientSources("components"),
      ...clientSources("app"),
      ...clientSources("hooks"),
    ]) {
      expect(clientSource, path).not.toContain(".toLocaleLowerCase()")
      expect(clientSource, path).not.toContain(".toLocaleUpperCase()")
      expect(clientSource, path).not.toContain(".toLocaleString()")
      expect(clientSource, path).not.toContain(".toLocaleDateString()")
      expect(clientSource, path).not.toContain(".toLocaleTimeString()")
      expect(clientSource, path).not.toMatch(/\.localeCompare\([^,\n)]+\)/)
      expect(clientSource, path).not.toMatch(/useRef\([^\n]*crypto\.randomUUID\(\)/)
    }
  })
})

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"


import { RELEASE_BUILD_NUMBER } from "../release-build.mjs"
import { checkReleaseBuildNumber } from "../release-build-check.mjs"
import { prepareReleaseBuildNumber } from "../release-build-bump.mjs"


describe("release build identity", () => {
  it("hardens stale QA recovery against the audited legacy manifest as release build 873", () => {
    expect(RELEASE_BUILD_NUMBER).toBe("873")
  })


  it("keeps the next production build number above the last published build when Git history is shallow", () => {
    // Production previously displayed Vercel's shallow-clone depth (10) instead
    // of the last published full-history build (765). This literal is the
    // release boundary being protected; the committed release source must be
    // advanced before the next production commit.
    expect(Number(RELEASE_BUILD_NUMBER)).toBeGreaterThan(765)
  })


  it("does not derive the displayed build number from Git history", () => {
    const nextConfig = readFileSync(new URL("../../next.config.mjs", import.meta.url), "utf8")


    expect(nextConfig).toContain("RELEASE_BUILD_NUMBER")
    expect(nextConfig).not.toMatch(/rev-list[\s\S]*--count/)
  })


  it("rejects a shallow production build that reuses its parent's number", () => {
    expect(() => checkReleaseBuildNumber({
      releaseBuildSource: 'export const RELEASE_BUILD_NUMBER = "767"\n',
      runGit: (args: string[]) => {
        if (args[0] === "rev-parse") return "true"
        if (args[0] === "show") return 'export const RELEASE_BUILD_NUMBER = "767"\n'
        throw new Error(`Unexpected git command: ${args.join(" ")}`)
      },
    })).toThrow("must be greater than its parent")

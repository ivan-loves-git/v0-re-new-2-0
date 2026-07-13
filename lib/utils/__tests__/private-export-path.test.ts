import { describe, expect, it } from "vitest"
import { resolvePrivateExportDirectory } from "@/lib/utils/private-export-path"

describe("private CRM export directory", () => {
  const repositoryRoot = "/workspace/re-new/platform"

  it("defaults to a temporary directory outside the repository", () => {
    expect(
      resolvePrivateExportDirectory(repositoryRoot, undefined, "/tmp"),
    ).toBe("/tmp/re-new-exports")
  })

  it("rejects repository and child paths", () => {
    expect(() => resolvePrivateExportDirectory(repositoryRoot, repositoryRoot)).toThrow()
    expect(() => resolvePrivateExportDirectory(repositoryRoot, `${repositoryRoot}/data/exports`)).toThrow()
  })

  it("accepts an explicit directory outside the repository", () => {
    expect(
      resolvePrivateExportDirectory(repositoryRoot, "/secure/re-new-exports"),
    ).toBe("/secure/re-new-exports")
  })
})

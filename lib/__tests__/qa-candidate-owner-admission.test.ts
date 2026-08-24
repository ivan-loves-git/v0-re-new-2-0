import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Golden candidate admission controller", () => {
  it("admits the repository owner without a collaborator API lookup and keeps other actors fail-closed", () => {
    const validator = readFileSync(`${process.cwd()}/scripts/qa/validate-candidate.mjs`, "utf8")

    expect(validator).toContain('const repositoryOwner = repository?.split("/")[0]')
    expect(validator).toContain("actor === repositoryOwner")
    expect(validator).toContain('Promise.resolve({ permission: "admin" })')
    expect(validator).toContain('github(`/collaborators/${encodeURIComponent(actor)}/permission`, "actor-permission")')
    expect(validator).toContain('QA candidate failed: lookup-${label}-${response.status}')
    expect(validator).toContain('message.startsWith("QA candidate contract failed:")')
    expect(validator).toContain('"QA candidate failed: internal"')
    expect(validator).not.toContain('"QA candidate failed: lookup"')
  })
})

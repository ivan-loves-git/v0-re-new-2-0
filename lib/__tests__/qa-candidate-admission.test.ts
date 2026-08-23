import { createHash } from "node:crypto"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { validateCandidateContractAdmission } from "@/lib/qa/candidate-admission.mjs"

const REVIEW_VERSION = "qa-schema-review-v1"

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

async function writeContractRoot(
  root: string,
  sql: string,
  version = "test-contract-v1",
  structureFingerprint = "b".repeat(64),
) {
  const sqlPath = "supabase/schema/example.sql"
  const contract = `${JSON.stringify({
    version,
    structureFingerprint,
    files: [{ path: sqlPath, sha256: sha256(sql) }],
  }, null, 2)}\n`
  await mkdir(join(root, "supabase/schema"), { recursive: true })
  await writeFile(join(root, sqlPath), sql)
  await writeFile(join(root, "supabase/qa-contract.json"), contract)
  return { contract, contractSha256: sha256(contract) }
}

async function roots({
  candidateSql = "select 1;\n",
  candidateVersion = "test-contract-v1",
  candidateFingerprint = "b".repeat(64),
}: {
  candidateSql?: string
  candidateVersion?: string
  candidateFingerprint?: string
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "renew-qa-admission-"))
  const trustedRoot = join(root, "trusted")
  const candidateRoot = join(root, "candidate")
  const trusted = await writeContractRoot(trustedRoot, "select 1;\n")
  const candidate = await writeContractRoot(candidateRoot, candidateSql, candidateVersion, candidateFingerprint)
  return { trustedRoot, candidateRoot, trusted, candidate }
}

describe("QA candidate database contract admission", () => {
  it("refuses automatic workflow_run admission completely", async () => {
    const input = await roots()
    await expect(validateCandidateContractAdmission({
      eventName: "workflow_run",
      trustedRoot: input.trustedRoot,
      candidateRoot: input.candidateRoot,
    })).rejects.toThrow("QA candidate contract failed: event")
  })

  it("accepts explicit identical-contract admission through repository_dispatch", async () => {
    const input = await roots()
    await expect(validateCandidateContractAdmission({
      eventName: "repository_dispatch",
      trustedRoot: input.trustedRoot,
      candidateRoot: input.candidateRoot,
    })).resolves.toEqual({
      admission: "trusted-main-identical",
      contractSha256: input.candidate.contractSha256,
    })
  })

  it("accepts explicit identical-contract admission through workflow_dispatch", async () => {
    const input = await roots()
    await expect(validateCandidateContractAdmission({
      eventName: "workflow_dispatch",
      trustedRoot: input.trustedRoot,
      candidateRoot: input.candidateRoot,
    })).resolves.toEqual({
      admission: "trusted-main-identical",
      contractSha256: input.candidate.contractSha256,
    })
  })

  it("refuses changed candidate SQL during explicit identical admission", async () => {
    const input = await roots({ candidateSql: "select 2;\n" })
    await expect(validateCandidateContractAdmission({
      eventName: "workflow_dispatch",
      trustedRoot: input.trustedRoot,
      candidateRoot: input.candidateRoot,
    })).rejects.toThrow("QA candidate contract failed: explicit-identical-required")
  })

  it("refuses missing or incorrect reviewed-dispatch contract hashes", async () => {
    const input = await roots({ candidateSql: "select 2;\n" })
    const base = {
      eventName: "repository_dispatch",
      trustedRoot: input.trustedRoot,
      candidateRoot: input.candidateRoot,
      dispatch: { schemaReviewed: true, schemaReviewVersion: REVIEW_VERSION },
    }
    await expect(validateCandidateContractAdmission(base)).rejects.toThrow("QA candidate contract failed: dispatch-contract-sha256")
    await expect(validateCandidateContractAdmission({
      ...base,
      dispatch: { ...base.dispatch, contractSha256: "c".repeat(64) },
    })).rejects.toThrow("QA candidate contract failed: dispatch-contract-sha256")
  })

  it("rejects an explicitly reviewed dispatch identical to trusted main", async () => {
    const input = await roots()
    await expect(validateCandidateContractAdmission({
      eventName: "repository_dispatch",
      trustedRoot: input.trustedRoot,
      candidateRoot: input.candidateRoot,
      dispatch: {
        schemaReviewed: true,
        schemaReviewVersion: REVIEW_VERSION,
        contractSha256: input.candidate.contractSha256,
      },
    })).rejects.toThrow("QA candidate contract failed: dispatch-no-schema-change")
  })

  it("accepts an exact explicitly reviewed contract delta with identical listed SQL", async () => {
    const input = await roots({
      candidateVersion: "771-permanent-qa-v3",
      candidateFingerprint: "c".repeat(64),
    })
    await expect(validateCandidateContractAdmission({
      eventName: "workflow_dispatch",
      trustedRoot: input.trustedRoot,
      candidateRoot: input.candidateRoot,
      dispatch: {
        schemaReviewed: true,
        schemaReviewVersion: REVIEW_VERSION,
        contractSha256: input.candidate.contractSha256,
      },
    })).resolves.toEqual({
      admission: "reviewed-schema-change",
      contractSha256: input.candidate.contractSha256,
      schemaReviewVersion: REVIEW_VERSION,
    })
  })
})

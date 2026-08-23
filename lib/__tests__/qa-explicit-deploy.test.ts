import { describe, expect, it } from "vitest"
import {
  EXPLICIT_QA_DEPLOY,
  assertAliasServesAdmittedSha,
  assertExplicitDeployCredential,
  assertExplicitQaDeploymentReady,
  assertJobSecretIsolation,
  assertOneValidationDeployPerCandidate,
  assertOrdinaryPushCreatesNoValidationDeploy,
  assertSanitizedProviderDeployEvidence,
  buildExplicitDeployRollback,
  buildExplicitQaDeployRequest,
  buildSanitizedProviderDeployEvidence,
  buildStableAliasAssignment,
  extractDeploymentIdentity,
  qaStableAliasHostname,
  qaValidationProjectId,
} from "@/lib/qa/explicit-deploy.mjs"

const SHA = "a".repeat(40)
const BRANCH = "codex/m2-rc-c-draft-activation-final-20260823"
const DEPLOYMENT_ID = "dpl_ExplicitQaCandidate001"
const PROJECT_ID = "prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y"

function readyDeployment(overrides: Record<string, unknown> = {}) {
  return {
    id: DEPLOYMENT_ID,
    projectId: PROJECT_ID,
    readyState: "READY",
    target: "preview",
    url: "renew-overnight-validation-abc.vercel.app",
    gitSource: { type: "github", ref: BRANCH, sha: SHA },
    meta: {
      githubCommitSha: SHA,
      githubCommitRef: BRANCH,
      renewQaController: "explicit-v1",
    },
    ...overrides,
  }
}

describe("QA explicit validation deploy controller", () => {
  it("builds a preview-only admitted-candidate deploy request for the candidate branch and SHA", () => {
    expect(buildExplicitQaDeployRequest({ candidateSha: SHA, candidateBranch: BRANCH })).toEqual({
      name: "renew-overnight-validation-20260820",
      project: PROJECT_ID,
      target: "preview",
      gitSource: {
        type: "github",
        org: "ivan-loves-git",
        repo: "v0-re-new-2-0",
        ref: BRANCH,
        sha: SHA,
      },
      gitMetadata: {
        commitRef: BRANCH,
        commitSha: SHA,
        remoteUrl: "https://github.com/ivan-loves-git/v0-re-new-2-0.git",
        dirty: false,
        ci: true,
        ciType: "github-actions",
      },
      meta: {
        githubCommitSha: SHA,
        githubCommitRef: BRANCH,
        renewQaController: "explicit-v1",
      },
    })
  })

  it("rejects unsafe deploy request inputs before any provider call", () => {
    expect(() => buildExplicitQaDeployRequest({ candidateSha: "short", candidateBranch: BRANCH })).toThrow("QA explicit deploy failed: candidate-sha")
    expect(() => buildExplicitQaDeployRequest({ candidateSha: SHA, candidateBranch: "qa" })).toThrow("QA explicit deploy failed: git-ref")
    expect(() => buildExplicitQaDeployRequest({ candidateSha: SHA, candidateBranch: "main" })).toThrow("QA explicit deploy failed: git-ref")
    expect(() => buildExplicitQaDeployRequest({ candidateSha: SHA, candidateBranch: BRANCH, projectId: "prj_other" })).toThrow("QA explicit deploy failed: project-id")
    expect(() => buildExplicitQaDeployRequest({ candidateSha: SHA, candidateBranch: BRANCH, repository: "other/repo" })).toThrow("QA explicit deploy failed: repository")
  })

  it("requires a QA-only rotatable token before creating a deployment", () => {
    expect(assertExplicitDeployCredential({ token: "v".repeat(24), projectId: PROJECT_ID })).toBe(true)
    expect(() => assertExplicitDeployCredential({ token: "short", projectId: PROJECT_ID })).toThrow("QA explicit deploy failed: token")
    expect(() => assertExplicitDeployCredential({ token: "v".repeat(24), projectId: "prj_other" })).toThrow("QA explicit deploy failed: project-id")
  })

  it("accepts only a READY preview deployment for the admitted SHA and branch", () => {
    expect(assertExplicitQaDeploymentReady({
      deployment: readyDeployment(),
      expectedSha: SHA,
      expectedBranch: BRANCH,
    })).toMatchObject({
      deploymentId: DEPLOYMENT_ID,
      projectId: PROJECT_ID,
      metaGithubCommitSha: SHA,
      metaGithubCommitRef: BRANCH,
      controller: EXPLICIT_QA_DEPLOY.controllerMetaValue,
    })
  })

  it.each([
    ["ready-state", { readyState: "BUILDING" }],
    ["project-id", { projectId: "prj_other" }],
    ["commit-sha", { meta: { githubCommitSha: "b".repeat(40), githubCommitRef: BRANCH, renewQaController: "explicit-v1" }, gitSource: { ref: BRANCH, sha: "b".repeat(40) } }],
    ["git-ref", { meta: { githubCommitSha: SHA, githubCommitRef: "main", renewQaController: "explicit-v1" }, gitSource: { ref: "main", sha: SHA } }],
    ["controller-meta", { meta: { githubCommitSha: SHA, githubCommitRef: BRANCH } }],
    ["production-target", { target: "production" }],
  ])("rejects a deployment with the wrong %s before database work", (_label, mutation) => {
    expect(() => assertExplicitQaDeploymentReady({
      deployment: readyDeployment(mutation),
      expectedSha: SHA,
      expectedBranch: BRANCH,
    })).toThrow(/QA explicit deploy failed:/)
  })

  it("builds sanitized provider evidence without secret residue", () => {
    const evidence = buildSanitizedProviderDeployEvidence({
      deploymentId: DEPLOYMENT_ID,
      candidateSha: SHA,
      candidateBranch: BRANCH,
      aliasServedSha: SHA,
      readyAt: "2026-08-23T10:00:00.000Z",
      providerUrl: "https://example.vercel.app",
    })
    expect(assertSanitizedProviderDeployEvidence(evidence, {
      deploymentId: DEPLOYMENT_ID,
      candidateSha: SHA,
      candidateBranch: BRANCH,
    })).toMatchObject({
      deploymentId: DEPLOYMENT_ID,
      projectId: PROJECT_ID,
      gitRef: BRANCH,
      candidateSha: SHA,
      target: "preview",
      readyState: "READY",
      alias: qaStableAliasHostname(),
    })
    expect(JSON.stringify(evidence)).not.toMatch(/QA_VERCEL_TOKEN|Bearer /)
  })

  it("assigns only the preserved stable alias and builds an exact rollback", () => {
    expect(qaStableAliasHostname()).toBe("renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app")
    expect(qaValidationProjectId()).toBe(PROJECT_ID)
    expect(buildStableAliasAssignment({ deploymentId: DEPLOYMENT_ID })).toEqual({
      alias: qaStableAliasHostname(),
      deploymentId: DEPLOYMENT_ID,
      redirect: null,
    })
    expect(() => buildStableAliasAssignment({
      deploymentId: DEPLOYMENT_ID,
      alias: "renew-overnight-validation-git-qa-myworkmail4-pngs-projects.vercel.app",
    })).toThrow("QA explicit deploy failed: alias")
    expect(buildExplicitDeployRollback({ previousDeploymentId: "dpl_PreviousReady001" }).deploymentId).toBe("dpl_PreviousReady001")
  })

  it("proves ordinary source pushes create zero validation deployments after disconnect", () => {
    expect(assertOrdinaryPushCreatesNoValidationDeploy({
      sourceRepositoryPush: true,
      validationProjectDeployments: [],
      productProjectDeployments: [{ name: "v0-re-new-2-0", projectId: "prj_product" }],
    })).toEqual({
      validationDeployments: 0,
      productDeployments: 1,
      productProject: "v0-re-new-2-0",
    })
    expect(() => assertOrdinaryPushCreatesNoValidationDeploy({
      sourceRepositoryPush: true,
      validationProjectDeployments: [{ id: DEPLOYMENT_ID }],
      productProjectDeployments: [],
    })).toThrow("QA explicit deploy failed: validation-deploy-count")
  })

  it("requires exactly one validation deployment per admitted candidate", () => {
    expect(assertOneValidationDeployPerCandidate({
      admittedCandidate: true,
      expectedSha: SHA,
      createdDeployments: [readyDeployment()],
    })).toEqual({ deploymentId: DEPLOYMENT_ID, candidateSha: SHA })
  })

  it("requires the stable alias to serve the admitted SHA", () => {
    expect(assertAliasServesAdmittedSha({
      aliasOrigin: "https://renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app",
      servedSha: SHA,
      expectedSha: SHA,
    })).toEqual({
      origin: "https://renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app",
      candidateSha: SHA,
    })
  })

  it("keeps Vercel deploy token out of database jobs", () => {
    expect(assertJobSecretIsolation({
      jobName: "deploy-qa",
      envKeys: ["QA_VERCEL_TOKEN", "VERCEL_AUTOMATION_BYPASS_SECRET", "QA_EXPECTED_SHA"],
    })).toEqual({ jobName: "deploy-qa", vercelToken: true, databaseSecrets: false })
    expect(assertJobSecretIsolation({
      jobName: "schema-sync",
      envKeys: ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_AUTOMATION_BYPASS_SECRET"],
    })).toEqual({ jobName: "schema-sync", vercelToken: false, databaseSecrets: true })
    expect(() => assertJobSecretIsolation({
      jobName: "schema-sync",
      envKeys: ["QA_VERCEL_TOKEN", "DATABASE_URL"],
    })).toThrow("QA explicit deploy failed: secret-coexistence")
  })

  it("extracts provider identity fields used by the waiter and evidence collector", () => {
    expect(extractDeploymentIdentity(readyDeployment())).toMatchObject({
      deploymentId: DEPLOYMENT_ID,
      readyState: "READY",
      metaGithubCommitSha: SHA,
      controller: "explicit-v1",
    })
  })
})

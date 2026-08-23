import { describe, expect, it } from "vitest"
import {
  EXPLICIT_QA_DEPLOY,
  assertAliasServesAdmittedSha,
  assertExplicitDeployCredential,
  assertExplicitQaDeploymentReady,
  assertOneValidationDeployPerCandidate,
  assertOrdinaryPushCreatesNoValidationDeploy,
  buildExplicitDeployRollback,
  buildExplicitQaDeployRequest,
  buildStableAliasAssignment,
  extractDeploymentIdentity,
  qaStableAliasHostname,
  qaValidationProjectId,
} from "@/lib/qa/explicit-deploy.mjs"

const SHA = "a".repeat(40)
const DEPLOYMENT_ID = "dpl_ExplicitQaCandidate001"
const PROJECT_ID = "prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y"

function readyDeployment(overrides: Record<string, unknown> = {}) {
  return {
    id: DEPLOYMENT_ID,
    projectId: PROJECT_ID,
    readyState: "READY",
    target: "preview",
    url: "renew-overnight-validation-abc.vercel.app",
    gitSource: { type: "github", ref: "qa", sha: SHA },
    meta: {
      githubCommitSha: SHA,
      githubCommitRef: "qa",
      renewQaController: "explicit-v1",
    },
    ...overrides,
  }
}

describe("QA explicit validation deploy controller", () => {
  it("builds a preview-only admitted-candidate deploy request bound to qa and the validation project", () => {
    expect(buildExplicitQaDeployRequest({ candidateSha: SHA })).toEqual({
      name: "renew-overnight-validation-20260820",
      project: PROJECT_ID,
      target: "preview",
      gitSource: {
        type: "github",
        org: "ivan-loves-git",
        repo: "v0-re-new-2-0",
        ref: "qa",
        sha: SHA,
      },
      gitMetadata: {
        commitRef: "qa",
        commitSha: SHA,
        remoteUrl: "https://github.com/ivan-loves-git/v0-re-new-2-0.git",
        dirty: false,
        ci: true,
        ciType: "github-actions",
      },
      meta: {
        githubCommitSha: SHA,
        githubCommitRef: "qa",
        renewQaController: "explicit-v1",
      },
    })
  })

  it("rejects unsafe deploy request inputs before any provider call", () => {
    expect(() => buildExplicitQaDeployRequest({ candidateSha: "short" })).toThrow("QA explicit deploy failed: candidate-sha")
    expect(() => buildExplicitQaDeployRequest({ candidateSha: SHA, gitRef: "main" })).toThrow("QA explicit deploy failed: git-ref")
    expect(() => buildExplicitQaDeployRequest({ candidateSha: SHA, projectId: "prj_other" })).toThrow("QA explicit deploy failed: project-id")
    expect(() => buildExplicitQaDeployRequest({ candidateSha: SHA, repository: "other/repo" })).toThrow("QA explicit deploy failed: repository")
  })

  it("requires a QA-only rotatable token before creating a deployment", () => {
    expect(assertExplicitDeployCredential({ token: "v".repeat(24), projectId: PROJECT_ID })).toBe(true)
    expect(() => assertExplicitDeployCredential({ token: "short", projectId: PROJECT_ID })).toThrow("QA explicit deploy failed: token")
    expect(() => assertExplicitDeployCredential({ token: "v".repeat(24), projectId: "prj_other" })).toThrow("QA explicit deploy failed: project-id")
  })

  it("accepts only a READY preview deployment for the admitted SHA with controller meta", () => {
    expect(assertExplicitQaDeploymentReady({
      deployment: readyDeployment(),
      expectedSha: SHA,
    })).toMatchObject({
      deploymentId: DEPLOYMENT_ID,
      projectId: PROJECT_ID,
      metaGithubCommitSha: SHA,
      metaGithubCommitRef: "qa",
      controller: EXPLICIT_QA_DEPLOY.controllerMetaValue,
    })
  })

  it.each([
    ["ready-state", { readyState: "BUILDING" }],
    ["project-id", { projectId: "prj_other" }],
    ["commit-sha", { meta: { githubCommitSha: "b".repeat(40), githubCommitRef: "qa", renewQaController: "explicit-v1" }, gitSource: { ref: "qa", sha: "b".repeat(40) } }],
    ["git-ref", { meta: { githubCommitSha: SHA, githubCommitRef: "main", renewQaController: "explicit-v1" }, gitSource: { ref: "main", sha: SHA } }],
    ["controller-meta", { meta: { githubCommitSha: SHA, githubCommitRef: "qa" } }],
    ["production-target", { target: "production" }],
  ])("rejects a deployment with the wrong %s before database work", (_label, mutation) => {
    expect(() => assertExplicitQaDeploymentReady({
      deployment: readyDeployment(mutation),
      expectedSha: SHA,
    })).toThrow(/QA explicit deploy failed:/)
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
    expect(buildExplicitDeployRollback({ previousDeploymentId: "dpl_PreviousReady001" })).toEqual({
      action: "reassign-stable-alias",
      alias: qaStableAliasHostname(),
      deploymentId: "dpl_PreviousReady001",
      reconnectGit: false,
      note: "Reassign the preserved stable alias to the prior READY non-production deployment. Do not reconnect automatic Git until a reviewed rollback restores the legacy waiter.",
    })
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
    expect(() => assertOneValidationDeployPerCandidate({
      admittedCandidate: true,
      expectedSha: SHA,
      createdDeployments: [readyDeployment(), readyDeployment({ id: "dpl_Second" })],
    })).toThrow("QA explicit deploy failed: deploy-count")
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
    expect(() => assertAliasServesAdmittedSha({
      aliasOrigin: "https://renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app",
      servedSha: "b".repeat(40),
      expectedSha: SHA,
    })).toThrow("QA explicit deploy failed: alias-sha")
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

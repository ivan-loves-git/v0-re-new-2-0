#!/usr/bin/env node
import { appendFile } from "node:fs/promises"
import { assertAuthorizedCandidate, assertCandidatePointer } from "../../lib/qa/permanent-contract.mjs"
import { validateCandidateContractAdmission } from "../../lib/qa/candidate-admission.mjs"

const repository = process.env.GITHUB_REPOSITORY
const candidateBranch = process.env.QA_CANDIDATE_BRANCH
const candidateSha = process.env.QA_EXPECTED_SHA
const token = process.env.GITHUB_TOKEN
const actor = process.env.GITHUB_ACTOR
const verifyRunId = process.env.QA_VERIFY_RUN_ID

async function github(path, label) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
  if (!response.ok) throw new Error(`QA candidate failed: lookup-${label}`)
  return response.json()
}

try {
  if (!token) throw new Error("QA candidate failed: token")
  if (!/^\d+$/.test(verifyRunId || "")) throw new Error("QA candidate failed: verify-run")
  if (process.env.GITHUB_REF !== "refs/heads/main") throw new Error("QA candidate failed: controller-ref")
  const [main, branch, permission, pulls, checks, verifyRun] = await Promise.all([
    github("/branches/main", "main"),
    github(`/branches/${encodeURIComponent(candidateBranch)}`, "candidate-branch"),
    github(`/collaborators/${encodeURIComponent(actor)}/permission`, "actor-permission"),
    github(`/pulls?state=open&base=main&head=${encodeURIComponent(`ivan-loves-git:${candidateBranch}`)}&per_page=20`, "pull-request"),
    github(`/commits/${candidateSha}/check-runs?per_page=100`, "verify-check"),
    github(`/actions/runs/${verifyRunId}`, "verify-run"),
  ])
  const pull = pulls.find((item) => item.base?.ref === "main" && item.head?.ref === candidateBranch && item.head?.sha === candidateSha && item.head?.repo?.full_name === repository && item.draft === false)
  if (verifyRun.name !== "Verify" || verifyRun.path !== ".github/workflows/verify.yml" || verifyRun.event !== "pull_request" || verifyRun.conclusion !== "success" || verifyRun.head_sha !== candidateSha || verifyRun.head_branch !== candidateBranch || verifyRun.repository?.full_name !== repository) {
    throw new Error("QA candidate failed: verify-run")
  }
  const verify = checks.check_runs?.find((check) => check.name === "Verify" && check.conclusion === "success" && check.head_sha === candidateSha && check.app?.slug === "github-actions" && check.app?.id === 15368 && String(check.details_url || "").includes(`/actions/runs/${verifyRunId}/`))
  assertAuthorizedCandidate({
    controllerRef: process.env.GITHUB_REF,
    controllerSha: process.env.GITHUB_SHA,
    mainSha: main.commit?.sha,
    actor,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    actorPermission: permission.permission,
    pull,
    verifyCheck: verify,
    candidateBranch,
    candidateSha,
  })
  const result = assertCandidatePointer({ repository, candidateBranch, candidateSha, branchHeadSha: branch.commit?.sha })
  const dispatch = process.env.QA_SCHEMA_REVIEWED === "true"
    ? {
      contractSha256: process.env.QA_CONTRACT_SHA256,
      schemaReviewed: true,
      schemaReviewVersion: process.env.QA_SCHEMA_REVIEW_VERSION,
    }
    : {}
  const admission = await validateCandidateContractAdmission({
    eventName: process.env.GITHUB_EVENT_NAME,
    trustedRoot: process.cwd(),
    candidateRoot: process.env.QA_CANDIDATE_ROOT,
    dispatch,
  })
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `candidate_sha=${result.candidateSha}\ncandidate_branch=${result.candidateBranch}\nreviewed_schema_transition=${admission.admission === "reviewed-schema-change"}\n`,
    )
  }
  console.log(JSON.stringify({ ok: true, ...result }))
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith("QA candidate failed:") ? error.message : "QA candidate failed: lookup")
  process.exit(1)
}

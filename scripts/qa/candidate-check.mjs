#!/usr/bin/env node
import { appendFile, mkdir, writeFile } from "node:fs/promises"

const action = process.argv[2]
const repository = process.env.GITHUB_REPOSITORY
const sha = process.env.QA_EXPECTED_SHA
const token = process.env.GITHUB_TOKEN
const checkId = process.env.QA_CHECK_RUN_ID

async function request(path, method, body) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`candidate-check-${response.status}`)
  return response.json()
}

try {
  if (!/^[0-9a-f]{40}$/.test(sha || "") || !token) throw new Error("candidate-check-input")
  if (action === "create") {
    const check = await request("/check-runs", "POST", {
      name: "P1-P3 protected pilot",
      head_sha: sha,
      status: "in_progress",
      started_at: new Date().toISOString(),
      output: { title: "Permanent protected QA lane", summary: "Exact-candidate protected validation is running." },
    })
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `check_run_id=${check.id}\n`)
    console.log(JSON.stringify({ ok: true, checkRunId: check.id, sha }))
  } else if (action === "update") {
    if (!/^\d+$/.test(checkId || "")) throw new Error("candidate-check-id")
    const completedAt = new Date()
    const runtimeReadyMs = Date.parse(process.env.QA_RUNTIME_READY_AT || "")
    const durationSeconds = Number.isFinite(runtimeReadyMs) ? Math.ceil((completedAt.getTime() - runtimeReadyMs) / 1000) : null
    const conclusion = process.env.QA_CHECK_CONCLUSION === "success" ? "success" : "failure"
    const summary = `${process.env.QA_CHECK_SUMMARY || "See the exact workflow run for evidence."}; runtime-seconds=${durationSeconds ?? "unavailable"}`
    await request(`/check-runs/${checkId}`, "PATCH", {
      status: "completed",
      conclusion,
      completed_at: completedAt.toISOString(),
      details_url: `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      output: {
        title: conclusion === "success" ? "Protected QA passed" : "Protected QA failed",
        summary,
      },
    })
    const timing = {
      candidateSha: sha,
      runtimeReadyAt: process.env.QA_RUNTIME_READY_AT || null,
      finalRequiredCheckAt: completedAt.toISOString(),
      durationSeconds,
    }
    await mkdir(".qa-final", { recursive: true })
    await writeFile(".qa-final/lane-timing.json", `${JSON.stringify(timing, null, 2)}\n`, { mode: 0o600 })
    console.log(JSON.stringify({ ok: true, checkRunId: checkId, sha, conclusion, durationSeconds }))
    if (conclusion !== "success") process.exitCode = 1
  } else {
    throw new Error("candidate-check-action")
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "candidate-check-failed")
  process.exit(1)
}

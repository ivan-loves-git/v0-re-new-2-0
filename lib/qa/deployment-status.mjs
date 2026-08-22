export function findQaValidationDeployment(deployments, expectedSha, expectedEnvironment) {
  return deployments.find((deployment) => (
    deployment.sha === expectedSha
    && deployment.environment === expectedEnvironment
    && deployment.creator?.login === "vercel[bot]"
    && deployment.production_environment === false
  ))
}

export function findVercelSuccess(statuses) {
  return statuses
    .filter((status) => (
      status.state === "success"
      && status.creator?.login === "vercel[bot]"
      && Number.isFinite(Date.parse(status.created_at))
    ))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0]
}

export function deploymentReadyAt(laneMovedAt, statusCreatedAt) {
  return new Date(Math.max(laneMovedAt, Date.parse(statusCreatedAt))).toISOString()
}

export async function probeStableQaAlias({ origin, bypass, fetchImpl = fetch }) {
  try {
    const expectedOrigin = new URL(origin).origin
    let nextUrl = `${expectedOrigin}/auth/login`
    let cookie = ""
    for (let redirect = 0; redirect < 4; redirect += 1) {
      if (new URL(nextUrl).origin !== expectedOrigin) return ""
      const response = await fetchImpl(nextUrl, {
        headers: {
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        redirect: "manual",
      })
      if (response.status < 300 || response.status >= 400) {
        return response.ok ? response.headers.get("x-renew-deployment-sha") || "" : ""
      }
      const location = response.headers.get("location")
      if (!location) return ""
      nextUrl = new URL(location, nextUrl).href
      const setCookie = response.headers.get("set-cookie")
      if (setCookie) cookie = setCookie.split(";", 1)[0]
    }
    return ""
  } catch {
    return ""
  }
}

export async function waitForQaDeployment({
  expectedSha,
  expectedEnvironment,
  laneMovedAt,
  deadline,
  listDeployments,
  listStatuses,
  probeAliasSha,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  pollInterval = 10000,
}) {
  while (now() < deadline) {
    const deployments = await listDeployments()
    const deployment = findQaValidationDeployment(deployments, expectedSha, expectedEnvironment)
    if (deployment) {
      const statuses = await listStatuses(deployment.id)
      const ready = findVercelSuccess(statuses)
      if (ready && await probeAliasSha() === expectedSha) {
        return {
          deploymentId: deployment.id,
          readyAt: deploymentReadyAt(laneMovedAt, ready.created_at),
          providerUrl: ready.environment_url,
        }
      }
    }
    await sleep(pollInterval)
  }
  throw new Error("QA deployment wait failed: timeout")
}

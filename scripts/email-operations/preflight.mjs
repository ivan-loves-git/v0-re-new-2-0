import { PROJECT } from "./project.mjs"
import { readJson } from "./http.mjs"

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const domainStatuses = new Set(["not_started", "pending", "verified", "failed", "temporary_failure"])

export async function inspectResend(env, fetchImpl) {
  let after
  const domains = []
  const seen = new Set()
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({ limit: "100" })
    if (after) query.set("after", after)
    const read = await readJson(`https://api.resend.com/domains?${query}`, env.RESEND_API_KEY, fetchImpl)
    if (read.state !== "readable") return { state: "unknown", access: read.state, expectedDomain: PROJECT.businessDomain.name, httpStatus: read.httpStatus }
    if (!Array.isArray(read.value?.data) || read.value.data.some(item => !item || typeof item !== "object" || !uuid.test(item.id ?? "") || typeof item.name !== "string") ||
      (read.value.has_more !== undefined && typeof read.value.has_more !== "boolean")) return { state: "unknown", access: "invalid_response" }
    domains.push(...read.value.data)
    if (read.value.has_more !== true) {
      const credentials = Object.entries(env).filter(([key, value]) => /(?:KEY|TOKEN|SECRET|PASSWORD)$/.test(key) && value).map(([, value]) => value)
      const observedDomains = domains.map(item => item.name).filter(name =>
        typeof name === "string" && name.length <= 253 && /^[a-z\d-]+(?:\.[a-z\d-]+)+$/.test(name)
        && !credentials.some(secret => name.includes(secret))).slice(0, 5)
      const checkedDomains = [PROJECT.businessDomain, PROJECT.accessDomain].map(expected => {
          const actual = domains.find(item => item.id === expected.id && item.name === expected.name)
          return {
            name: expected.name, identity: actual ? "matched" : "missing",
            verification: domainStatuses.has(actual?.status) ? actual.status : "unknown",
            openTracking: typeof actual?.open_tracking === "boolean" ? actual.open_tracking : null,
            clickTracking: typeof actual?.click_tracking === "boolean" ? actual.click_tracking : null,
          }
        })
      return {
        state: checkedDomains.every(domain => domain.identity === "matched") ? "matched" : "mismatch", access: "readable",
        expectedDomain: PROJECT.businessDomain.name, observedDomains, domains: checkedDomains,
      }
    }
    const cursor = read.value.data.at(-1)?.id
    if (!uuid.test(cursor ?? "") || seen.has(cursor)) return { state: "unknown", access: "invalid_pagination" }
    seen.add(cursor)
    after = cursor
  }
  return { state: "unknown", access: "pagination_limit" }
}

async function inspectVercel(env, browser, fetchImpl) {
  const read = await readJson(`https://api.vercel.com/v9/projects/${PROJECT.vercelProjectId}?teamId=${PROJECT.vercelTeamId}`, env.VERCEL_TOKEN, fetchImpl)
  const expected = { projectId: PROJECT.vercelProjectId, teamId: PROJECT.vercelTeamId }
  const fallback = { browser, session: "not_observed", action: "inspect_existing_selected_browser_session", url: "https://vercel.com/dashboard" }
  if (read.state !== "readable") return { state: "unknown", access: read.state, expected, httpStatus: read.httpStatus, fallback }
  if (typeof read.value?.id !== "string" || typeof read.value?.accountId !== "string") return { state: "unknown", access: "invalid_response", expected, fallback }
  const matched = read.value?.id === expected.projectId && read.value?.accountId === expected.teamId
  return {
    state: matched ? "matched" : "mismatch", access: "readable", expected,
    observed: matched ? expected : "unrecognized_project_or_team", writeAccess: "not_probed",
  }
}

export async function inspectServices(env, browser, fetchImpl) {
  const [resend, vercel] = await Promise.all([inspectResend(env, fetchImpl), inspectVercel(env, browser, fetchImpl)])
  const mismatch = resend.state === "mismatch" || vercel.state === "mismatch"
  const identified = resend.state === "matched" && vercel.state === "matched"
  const verified = resend.domains?.every(domain => domain.verification === "verified")
  return {
    schema: 1, command: "preflight", readOnly: true, expectedProject: PROJECT.name,
    state: mismatch ? "blocked" : identified ? verified ? "verified" : "pending" : "unavailable",
    source: { expected: PROJECT.sourceUrl, observed: PROJECT.sourceUrl, state: "matched" },
    browser: { selected: browser, session: "not_observed" }, resend, vercel,
    qa: { primaryConfigured: Boolean(env.QA_PRIMARY_EMAIL), roleCredentialsConfigured: Boolean(env.QA_REPRENEUR_EMAIL && env.QA_REPRENEUR_PASSWORD) },
  }
}

// This shared provider adapter can only read. It never follows an authenticated
// redirect or includes provider error bodies in public results.
export async function readJson(url, token, fetchImpl) {
  if (!token) return { state: "missing_credentials" }
  try {
    const response = await fetchImpl(url, {
      method: "GET", redirect: "manual", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token}`, ...(new URL(url).hostname.endsWith(".supabase.co") ? { apikey: token } : {}) },
    })
    if (!response.ok) return { state: response.status === 403 ? "forbidden" : "unavailable", httpStatus: response.status }
    return { state: "readable", value: await response.json() }
  } catch {
    return { state: "unavailable" }
  }
}

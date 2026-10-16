import "server-only"

import { resolveCurrentUserAccess } from "@/lib/access-control"
import { auth, getPool } from "@/lib/auth"
import { createCatalog, type WaveCatalog } from "@/lib/mcp/catalog"
import type { StaffGateDependencies } from "@/lib/mcp/http"
import { mcpOrigin } from "@/lib/mcp/origin"
import { createSupabaseRowReader } from "@/lib/mcp/read-rows"
import { createAdminClient } from "@/lib/supabase/admin"

/** Production wiring for the staff Claude connection (#265). */

export const staffGateDependencies: StaffGateDependencies = {
  async findTokenUserId(headers) {
    const token = await auth.api.getMcpSession({ headers })
    return token?.userId ?? null
  },
  async findRole(userId) {
    const context = await auth.$context
    const user = await context.internalAdapter.findUserById(userId)
    if (!user) return null
    const access = await resolveCurrentUserAccess(user)
    return access?.role ?? null
  },
}

export interface RegisteredMcpClient {
  name: string | null
  redirectUris: string[]
}

/** A registered, enabled client, so the confirmation page can name it. */
export async function findMcpClient(clientId: string): Promise<RegisteredMcpClient | null> {
  const { rows } = await getPool().query<{ name: string | null; redirectUrls: string }>(
    `SELECT "name", "redirectUrls" FROM public."oauthApplication"
      WHERE "clientId" = $1 AND "disabled" IS NOT TRUE`,
    [clientId],
  )
  const row = rows[0]
  if (!row) return null
  return { name: row.name, redirectUris: row.redirectUrls.split(",") }
}

/**
 * Asks Better Auth for the authorization code as the signed-in staff member.
 * Called in-process, so the plugin's public authorize route can stay closed.
 */
export function requestAuthorizationCode(params: URLSearchParams, cookie: string | null) {
  const url = `${mcpOrigin()}/api/auth/mcp/authorize?${params.toString()}`
  return auth.handler(
    new Request(url, { method: "GET", headers: cookie ? { cookie } : {} }),
  )
}

let catalog: WaveCatalog | null = null

export function waveCatalog() {
  catalog ??= createCatalog(getPool())
  return catalog
}

export function waveRowReader() {
  return createSupabaseRowReader(createAdminClient())
}

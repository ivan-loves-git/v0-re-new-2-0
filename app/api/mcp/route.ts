import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import {
  checkMcpStaff,
  forbiddenResponse,
  unauthenticatedResponse,
} from "@/lib/mcp/http"
import { mcpOrigin } from "@/lib/mcp/origin"
import {
  staffGateDependencies,
  waveCatalog,
  waveRowReader,
} from "@/lib/mcp/runtime"
import { createWaveMcpServer } from "@/lib/mcp/server"

export const maxDuration = 60

/**
 * Read-only WAVE data for staff in Claude (#265). Stateless: every POST is
 * authenticated and served on its own, so no session lives between calls.
 */
export async function POST(request: Request) {
  const gate = await checkMcpStaff(request.headers, staffGateDependencies)
  if (gate.status === "unauthenticated") return unauthenticatedResponse(mcpOrigin())
  if (gate.status === "forbidden") return forbiddenResponse()

  const server = createWaveMcpServer({
    catalog: waveCatalog(),
    readRows: waveRowReader(),
    audit: (event) =>
      console.info(
        JSON.stringify({ event: "wave_mcp.tool_call", userId: gate.userId, ...event }),
      ),
  })
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    return await transport.handleRequest(request)
  } finally {
    await server.close()
  }
}

// No server-initiated stream or session to end in stateless mode.
function methodNotAllowed() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } })
}

export { methodNotAllowed as GET, methodNotAllowed as DELETE }

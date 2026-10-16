import { metadataResponse, protectedResourceMetadata } from "@/lib/mcp/http"
import { mcpOrigin } from "@/lib/mcp/origin"

// RFC 9728 path-suffixed location for the /api/mcp resource.
export function GET() {
  return metadataResponse(protectedResourceMetadata(mcpOrigin()))
}

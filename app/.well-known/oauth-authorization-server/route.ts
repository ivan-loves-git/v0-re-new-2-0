import { authorizationServerMetadata, metadataResponse } from "@/lib/mcp/http"
import { mcpOrigin } from "@/lib/mcp/origin"

export function GET() {
  return metadataResponse(authorizationServerMetadata(mcpOrigin()))
}

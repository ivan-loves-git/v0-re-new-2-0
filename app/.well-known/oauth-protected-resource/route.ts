import { metadataResponse, protectedResourceMetadata } from "@/lib/mcp/http"
import { mcpOrigin } from "@/lib/mcp/origin"

export function GET() {
  return metadataResponse(protectedResourceMetadata(mcpOrigin()))
}

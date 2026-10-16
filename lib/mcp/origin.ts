import { env } from "@/lib/env"

/** The public WAVE origin that issues and serves the staff Claude connection. */
export function mcpOrigin() {
  return new URL(env.BETTER_AUTH_URL).origin
}

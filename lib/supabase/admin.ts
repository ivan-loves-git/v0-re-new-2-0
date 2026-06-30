import { createClient } from "@supabase/supabase-js"
import { env } from "@/lib/env"

/**
 * Admin client that bypasses RLS using the service role key.
 * Use this ONLY for server-side operations that need to bypass RLS,
 * such as public intake forms where there's no authenticated user.
 *
 * IMPORTANT: Never expose this client to the browser.
 */
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

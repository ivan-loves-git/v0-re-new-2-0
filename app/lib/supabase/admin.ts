import { createClient } from "@supabase/supabase-js"

/**
 * Admin client that bypasses RLS using the service role key.
 * Use this ONLY for server-side operations that need to bypass RLS,
 * such as public intake forms where there's no authenticated user.
 *
 * IMPORTANT: Never expose this client to the browser.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin credentials. Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file."
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Creates a Supabase client for server-side use.
 *
 * Uses SERVICE_ROLE_KEY which bypasses RLS.
 * This is safe because:
 * - Better Auth + middleware protect all dashboard routes
 * - Only authenticated users can reach server components
 * - RLS is redundant when auth is handled at app level
 */
export async function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export { createServerClient as createClient }

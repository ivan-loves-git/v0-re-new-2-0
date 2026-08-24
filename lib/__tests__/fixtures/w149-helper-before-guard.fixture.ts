import { createAdminClient } from "@/lib/supabase/admin"

function privilegedHelper() {
  return createAdminClient()
}

export async function guardedFirst() {
  await requireStaffAccess()
  return privilegedHelper()
}

export async function helperFirst() {
  const client = privilegedHelper()
  await requireStaffAccess()
  return client
}

export async function commentOnly() {
  // requireStaffAccess() must never count as an executable guard.
  return privilegedHelper()
}

declare function requireStaffAccess(): Promise<void>

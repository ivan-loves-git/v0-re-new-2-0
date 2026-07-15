"use server"

import { requirePortalAccess } from "@/lib/access-control"
import {
  normalizePortalRepreneurProfile,
  PORTAL_REPRENEUR_PROFILE_SELECT,
  type PortalRepreneurProfile,
} from "@/lib/data/portal-profile"
import { createAdminClient } from "@/lib/supabase/admin"

export async function getMyRepreneurProfile(): Promise<PortalRepreneurProfile | null> {
  const access = await requirePortalAccess()
  if (!access.repreneurId) return null

  const supabase = createAdminClient()
  const { data: repreneur, error } = await supabase
    .from("repreneurs")
    .select(PORTAL_REPRENEUR_PROFILE_SELECT)
    .eq("id", access.repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return normalizePortalRepreneurProfile(repreneur)
}

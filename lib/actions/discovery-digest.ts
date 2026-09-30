"use server"

import { revalidatePath } from "next/cache"
import { requirePortalAccess, requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

export async function getMyDiscoveryDigestOptOut(): Promise<boolean> {
  const access = await requirePortalAccess()
  if (!access.repreneurId) throw new Error("A linked owner profile is required.")
  const { data, error } = await createAdminClient()
    .from("discovery_digest_optouts")
    .select("repreneur_id")
    .eq("repreneur_id", access.repreneurId)
    .maybeSingle()
  if (error) throw new Error("Could not read the discovery email preference.")
  return Boolean(data)
}

/** The authenticated portal identity supplies the owner; no client ID is used. */
export async function optOutOfMyDiscoveryDigest(): Promise<void> {
  const access = await requirePortalAccess()
  if (!access.repreneurId) throw new Error("A linked owner profile is required.")
  const { data, error } = await createAdminClient().rpc("d136_opt_out", { p_user_id: access.user.id })
  if (error || data !== true) throw new Error("Could not save this preference. Please try again.")
  revalidatePath("/portal/profile")
}

export type DiscoveryDigestCopyState = {
  futureOrdinaryOrigin: boolean
  currentCopyReady: boolean
}

/** Staff view of only the two flags needed to explain digest inclusion. */
export async function getDiscoveryDigestCopyState(opportunityId: string): Promise<DiscoveryDigestCopyState> {
  await requireStaffAccess()
  const db = createAdminClient()
  const [origin, cutover, ready] = await Promise.all([
    db.from("discovery_digest_origins").select("registered_at").eq("opportunity_id", opportunityId).maybeSingle(),
    db.from("discovery_digest_cutover").select("initialized_at").eq("singleton", true).maybeSingle(),
    db.rpc("d136_copy_ready", { p_opportunity_id: opportunityId }),
  ])
  if (origin.error || cutover.error || ready.error) throw new Error("Could not read discovery copy approval.")
  return {
    futureOrdinaryOrigin: Boolean(origin.data && cutover.data
      && Date.parse(origin.data.registered_at) >= Date.parse(cutover.data.initialized_at)),
    currentCopyReady: ready.data === true,
  }
}

/** Approval is attributed in SQL to the current staff actor and exact copy. */
export async function approveDiscoveryDigestCopy(
  opportunityId: string, expectedPublicTitle: string, expectedTeaser: string,
): Promise<void> {
  const { user } = await requireStaffAccess()
  const { data, error } = await createAdminClient().rpc("d136_approve_copy", {
    p_opportunity_id: opportunityId,
    p_actor: user.id,
    p_expected_public_title: expectedPublicTitle,
    p_expected_teaser: expectedTeaser,
  })
  if (error || data !== true) throw new Error("Current public title and approved teaser are required.")
  revalidatePath(`/opportunities/${opportunityId}`)
}

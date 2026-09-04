import "server-only"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type { DemoClassificationControlState } from "@/lib/demo-classification"

type MatchEndpoint = "opportunity_id" | "repreneur_id"

async function readControlState(
  endpoint: MatchEndpoint,
  entityId: string,
  updatedAt: string | null | undefined,
  updatedBy: string | null | undefined,
): Promise<DemoClassificationControlState> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from("opportunity_matches")
    .select("id", { count: "exact", head: true })
    .eq(endpoint, entityId)

  let updatedByLabel: string | null = null
  if (updatedBy) {
    const { data: staffActor } = await supabase
      .from("app_user_roles")
      .select("email")
      .eq("user_id", updatedBy)
      .eq("role", "staff")
      .maybeSingle()

    updatedByLabel = staffActor?.email
      ? staffActor.email.split("@")[0]
      : "staff"
  }

  return {
    lockReason: error || count === null ? "unavailable" : count > 0 ? "matched" : null,
    updatedAt: updatedAt ?? null,
    updatedByLabel,
  }
}

export async function readOpportunityDemoClassificationControl(
  opportunityId: string,
  updatedAt: string | null | undefined,
  updatedBy: string | null | undefined,
) {
  return readControlState("opportunity_id", opportunityId, updatedAt, updatedBy)
}

export async function readRepreneurDemoClassificationControl(
  repreneurId: string,
  updatedAt: string | null | undefined,
  updatedBy: string | null | undefined,
) {
  return readControlState("repreneur_id", repreneurId, updatedAt, updatedBy)
}

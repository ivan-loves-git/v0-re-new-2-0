"use server"

import { requireStaffAccess } from "@/lib/access-control"
import {
  projectClientPursuitPortfolio,
  type ClientPortfolioActivityRow,
  type ClientPortfolioMatchRow,
  type ClientPortfolioRepreneurRow,
  type ClientPursuitPortfolioRow,
} from "@/lib/client-pursuit-portfolio"
import { createAdminClient } from "@/lib/supabase/admin"

const OPEN_MATCH_STATUSES = ["proposed", "interested", "active_pursuit"] as const

export async function listClientPursuitPortfolio(): Promise<ClientPursuitPortfolioRow[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { data: repreneurs, error: repreneurError } = await supabase
    .from("repreneurs")
    .select(`
      id,
      first_name,
      last_name,
      email,
      lifecycle_status,
      updated_at,
      repreneur_offers(status, offer:offers(name))
    `)
    .eq("lifecycle_status", "client")
    .order("last_name", { ascending: true })

  if (repreneurError) throw new Error(repreneurError.message)
  const clientRows = (repreneurs ?? []) as ClientPortfolioRepreneurRow[]
  if (!clientRows.length) return []

  const clientIds = clientRows.map((repreneur) => repreneur.id)
  const matches: ClientPortfolioMatchRow[] = []
  const activities: ClientPortfolioActivityRow[] = []
  const chunkSize = 100

  for (let start = 0; start < clientIds.length; start += chunkSize) {
    const ids = clientIds.slice(start, start + chunkSize)
    const [matchResult, activityResult] = await Promise.all([
      supabase
        .from("opportunity_matches")
        .select(`
          id,
          repreneur_id,
          status,
          pursuit_stage,
          created_at,
          updated_at,
          interest_expressed_at,
          reviewed_at,
          pursuit_stage_updated_at,
          opportunity:opportunities!inner(id, reference, public_title, status, is_demo)
        `)
        .in("repreneur_id", ids)
        .in("status", [...OPEN_MATCH_STATUSES])
        .eq("opportunity.is_demo", false),
      supabase
        .from("activities")
        .select("repreneur_id, created_at")
        .in("repreneur_id", ids)
        .order("created_at", { ascending: false }),
    ])

    if (matchResult.error) throw new Error(matchResult.error.message)
    if (activityResult.error) throw new Error(activityResult.error.message)
    matches.push(...((matchResult.data ?? []) as ClientPortfolioMatchRow[]))
    activities.push(...((activityResult.data ?? []) as ClientPortfolioActivityRow[]))
  }

  return projectClientPursuitPortfolio({
    repreneurs: clientRows,
    matches,
    activities,
  })
}

"use server"

import { requireUser } from "@/lib/auth-server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Repreneur } from "@/lib/types/repreneur"
import type { LeadershipAssessment } from "@/lib/types/leadership-assessment"

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}

export async function getMyRepreneurProfile(): Promise<{
  repreneur: Repreneur | null
  leadershipAssessment: LeadershipAssessment | null
}> {
  const user = await requireUser()
  const email = normalizeEmail(user.email)
  if (!email) return { repreneur: null, leadershipAssessment: null }

  const supabase = createAdminClient()
  const { data: repreneur, error } = await supabase
    .from("repreneurs")
    .select("*")
    .eq("email", email)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!repreneur) return { repreneur: null, leadershipAssessment: null }

  const { data: leadershipAssessment, error: assessmentError } = await supabase
    .from("leadership_assessments")
    .select("*")
    .eq("repreneur_id", repreneur.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (assessmentError && assessmentError.code !== "42P01") {
    throw new Error(assessmentError.message)
  }

  return {
    repreneur: repreneur as Repreneur,
    leadershipAssessment: (leadershipAssessment as LeadershipAssessment | null) ?? null,
  }
}

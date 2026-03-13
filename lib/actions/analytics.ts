"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export interface AnalyticsData {
  // Counts
  totalProfiles: number
  newProfilesThisPeriod: number
  newProfilesPreviousPeriod: number
  leadCount: number
  qualifiedCount: number
  clientCount: number
  rejectedCount: number
  declinedCount: number
  // Scores
  avgWhoScore: number | null
  avgWhenScore: number | null
  medianWhoScore: number | null
  medianWhenScore: number | null
  aboveThresholdPercent: number // % with WHO >= 60 AND WHEN >= 60
  // Score distribution (bands)
  whoDistribution: { band: string; count: number }[]
  whenDistribution: { band: string; count: number }[]
  // Journey stages
  stageDistribution: { stage: string; count: number }[]
  // Stale leads
  staleLeads: { id: string; first_name: string; last_name: string; email: string; updated_at: string; days_stale: number }[]
  // Conversion rates
  leadToQualifiedRate: number
  qualifiedToClientRate: number
  leadToClientRate: number
}

function getDateRange(period: string): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const now = new Date()
  const to = now

  switch (period) {
    case "week": {
      const from = new Date(now)
      from.setDate(from.getDate() - 7)
      const prevFrom = new Date(from)
      prevFrom.setDate(prevFrom.getDate() - 7)
      return { from, to, prevFrom, prevTo: from }
    }
    case "month": {
      const from = new Date(now)
      from.setMonth(from.getMonth() - 1)
      const prevFrom = new Date(from)
      prevFrom.setMonth(prevFrom.getMonth() - 1)
      return { from, to, prevFrom, prevTo: from }
    }
    case "quarter": {
      const from = new Date(now)
      from.setMonth(from.getMonth() - 3)
      const prevFrom = new Date(from)
      prevFrom.setMonth(prevFrom.getMonth() - 3)
      return { from, to, prevFrom, prevTo: from }
    }
    default: {
      // All time
      const from = new Date("2020-01-01")
      return { from, to, prevFrom: from, prevTo: from }
    }
  }
}

function scoreBand(score: number): string {
  if (score >= 75) return "75-100"
  if (score >= 50) return "50-74"
  if (score >= 25) return "25-49"
  return "0-24"
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export async function getAnalyticsData(period: string = "all"): Promise<AnalyticsData> {
  const supabase = createAdminClient()
  const { from, to, prevFrom, prevTo } = getDateRange(period)

  // Fetch all repreneurs (excluding rejected/declined for most metrics)
  const { data: allRepreneurs } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email, lifecycle_status, journey_stage, who_score, when_score, created_at, updated_at")
    .order("created_at", { ascending: false })

  const repreneurs = allRepreneurs || []

  // Filter by period
  const inPeriod = period === "all"
    ? repreneurs
    : repreneurs.filter(r => new Date(r.created_at) >= from && new Date(r.created_at) <= to)

  const inPrevPeriod = period === "all"
    ? []
    : repreneurs.filter(r => new Date(r.created_at) >= prevFrom && new Date(r.created_at) < from)

  // Basic counts
  const totalProfiles = repreneurs.length
  const newProfilesThisPeriod = inPeriod.length
  const newProfilesPreviousPeriod = inPrevPeriod.length

  // Lifecycle counts (all time, not filtered by period)
  const active = repreneurs.filter(r => !["rejected", "declined"].includes(r.lifecycle_status))
  const leadCount = repreneurs.filter(r => r.lifecycle_status === "lead").length
  const qualifiedCount = repreneurs.filter(r => r.lifecycle_status === "qualified").length
  const clientCount = repreneurs.filter(r => r.lifecycle_status === "client").length
  const rejectedCount = repreneurs.filter(r => r.lifecycle_status === "rejected").length
  const declinedCount = repreneurs.filter(r => r.lifecycle_status === "declined").length

  // Score calculations (only scored repreneurs)
  const whoScores = active.map(r => r.who_score).filter((s): s is number => s !== null && s > 0)
  const whenScores = active.map(r => r.when_score).filter((s): s is number => s !== null && s > 0)

  const avgWhoScore = whoScores.length > 0 ? Math.round(whoScores.reduce((a, b) => a + b, 0) / whoScores.length) : null
  const avgWhenScore = whenScores.length > 0 ? Math.round(whenScores.reduce((a, b) => a + b, 0) / whenScores.length) : null
  const medianWhoScore = median(whoScores)
  const medianWhenScore = median(whenScores)

  // % above threshold (WHO >= 60 AND WHEN >= 60)
  const scoredRepreneurs = active.filter(r => r.who_score !== null && r.when_score !== null && r.who_score > 0)
  const aboveThreshold = scoredRepreneurs.filter(r => (r.who_score ?? 0) >= 60 && (r.when_score ?? 0) >= 60)
  const aboveThresholdPercent = scoredRepreneurs.length > 0
    ? Math.round((aboveThreshold.length / scoredRepreneurs.length) * 100)
    : 0

  // Score distribution
  const bands = ["0-24", "25-49", "50-74", "75-100"]
  const whoDistribution = bands.map(band => ({
    band,
    count: whoScores.filter(s => scoreBand(s) === band).length,
  }))
  const whenDistribution = bands.map(band => ({
    band,
    count: whenScores.filter(s => scoreBand(s) === band).length,
  }))

  // Journey stage distribution
  const stages = ["explorer", "learner", "ready", "execution", "post_acquisition"]
  const stageDistribution = stages.map(stage => ({
    stage,
    count: active.filter(r => (r.journey_stage || "explorer") === stage).length,
  }))

  // Stale leads (lead status, not updated in 7+ days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const staleLeads = repreneurs
    .filter(r => r.lifecycle_status === "lead" && new Date(r.updated_at) < sevenDaysAgo)
    .map(r => ({
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      updated_at: r.updated_at,
      days_stale: Math.floor((Date.now() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => b.days_stale - a.days_stale)
    .slice(0, 20)

  // Conversion rates
  const leadToQualifiedRate = leadCount + qualifiedCount + clientCount > 0
    ? Math.round(((qualifiedCount + clientCount) / (leadCount + qualifiedCount + clientCount)) * 100)
    : 0
  const qualifiedToClientRate = qualifiedCount + clientCount > 0
    ? Math.round((clientCount / (qualifiedCount + clientCount)) * 100)
    : 0
  const leadToClientRate = totalProfiles > 0
    ? Math.round((clientCount / totalProfiles) * 100)
    : 0

  return {
    totalProfiles,
    newProfilesThisPeriod,
    newProfilesPreviousPeriod,
    leadCount,
    qualifiedCount,
    clientCount,
    rejectedCount,
    declinedCount,
    avgWhoScore,
    avgWhenScore,
    medianWhoScore,
    medianWhenScore,
    aboveThresholdPercent,
    whoDistribution,
    whenDistribution,
    stageDistribution,
    staleLeads,
    leadToQualifiedRate,
    qualifiedToClientRate,
    leadToClientRate,
  }
}

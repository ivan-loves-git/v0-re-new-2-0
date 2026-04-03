"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export interface OfferConversionData {
  medianTimeToOfferSent: number | null // days
  medianTimeToOfferAccepted: number | null // days
  overallAcceptanceRate: number // %
  acceptanceByOffer: { offerName: string; sent: number; accepted: number; rate: number }[]
}

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
  // Offer conversion KPIs
  offerConversion: OfferConversionData
  // Operational KPIs
  timeToFirstMeeting: number | null
  timeToQualification: number | null
  firstMeetingBookingRate: number
  offerSubmissionRate: number
  dropOffByStage: { stage: string; count: number; dropOff: number }[]
  interviewsHeld: number
  noShowRate: number
  meetingToOfferRatio: number | null
  // Accuracy stats
  accuracyStats: { whoAccurate: number; whenAccurate: number; total: number }
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
    .select("id, first_name, last_name, email, lifecycle_status, journey_stage, who_score, when_score, who_accuracy, when_accuracy, created_at, updated_at")
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

  // === Offer Conversion KPIs ===
  const { data: offerAssignments } = await supabase
    .from("repreneur_offers")
    .select("id, repreneur_id, offer_id, status, offered_at, accepted_at, offer:offers(name)")

  const assignments = offerAssignments || []

  // Build a lookup: repreneur_id → created_at
  const repreneurCreatedAt = new Map(repreneurs.map(r => [r.id, r.created_at]))

  // Time to Offer Sent: median days from repreneur.created_at to offered_at
  const timeToOfferSent: number[] = []
  for (const a of assignments) {
    const applicationDate = repreneurCreatedAt.get(a.repreneur_id)
    if (applicationDate && a.offered_at) {
      const days = Math.floor((new Date(a.offered_at).getTime() - new Date(applicationDate).getTime()) / (1000 * 60 * 60 * 24))
      if (days >= 0) timeToOfferSent.push(days)
    }
  }

  // Time to Offer Accepted: median days from repreneur.created_at to accepted_at
  const timeToOfferAccepted: number[] = []
  const acceptedAssignments = assignments.filter(a => a.accepted_at)
  for (const a of acceptedAssignments) {
    const applicationDate = repreneurCreatedAt.get(a.repreneur_id)
    if (applicationDate && a.accepted_at) {
      const days = Math.floor((new Date(a.accepted_at).getTime() - new Date(applicationDate).getTime()) / (1000 * 60 * 60 * 24))
      if (days >= 0) timeToOfferAccepted.push(days)
    }
  }

  // Offer Acceptance Rate (overall + split by offer)
  const totalSent = assignments.length
  const totalAccepted = assignments.filter(a => ["accepted", "completed"].includes(a.status)).length
  const overallAcceptanceRate = totalSent > 0 ? Math.round((totalAccepted / totalSent) * 100) : 0

  // Group by offer name
  const byOffer = new Map<string, { sent: number; accepted: number }>()
  for (const a of assignments) {
    const offerName = (a.offer as { name: string } | null)?.name || "Unknown"
    const entry = byOffer.get(offerName) || { sent: 0, accepted: 0 }
    entry.sent++
    if (["accepted", "completed"].includes(a.status)) {
      entry.accepted++
    }
    byOffer.set(offerName, entry)
  }
  const acceptanceByOffer = Array.from(byOffer.entries()).map(([offerName, { sent, accepted }]) => ({
    offerName,
    sent,
    accepted,
    rate: sent > 0 ? Math.round((accepted / sent) * 100) : 0,
  }))

  const offerConversion: OfferConversionData = {
    medianTimeToOfferSent: median(timeToOfferSent),
    medianTimeToOfferAccepted: median(timeToOfferAccepted),
    overallAcceptanceRate,
    acceptanceByOffer,
  }

  // === Operational KPIs ===
  const { data: allActivities } = await supabase
    .from("activities")
    .select("repreneur_id, activity_type, event_date, created_at")

  const activityList = allActivities || []
  const interviews = activityList.filter(a => a.activity_type === "interview")
  const noShows = activityList.filter(a => a.activity_type === "no_show")

  // Time to First Meeting: median days from repreneur.created_at to first interview
  const firstMeetingDays: number[] = []
  const interviewsByRepreneur = new Map<string, string>()
  for (const interview of interviews) {
    const existing = interviewsByRepreneur.get(interview.repreneur_id)
    const date = interview.event_date || interview.created_at
    if (!existing || date < existing) {
      interviewsByRepreneur.set(interview.repreneur_id, date)
    }
  }
  for (const [repId, firstDate] of interviewsByRepreneur) {
    const createdAt = repreneurCreatedAt.get(repId)
    if (createdAt) {
      const days = Math.floor((new Date(firstDate).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
      if (days >= 0) firstMeetingDays.push(days)
    }
  }

  // Time to Qualification: median days from created_at for qualified/client repreneurs
  // (Uses updated_at as approximation since we don't have exact qualification timestamp)
  const qualifiedRepreneurs = repreneurs.filter(r => ["qualified", "client"].includes(r.lifecycle_status))
  const qualificationDays: number[] = qualifiedRepreneurs.map(r => {
    return Math.floor((new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24))
  }).filter(d => d >= 0)

  // First Meeting Booking Rate: % of leads who have at least 1 interview
  const leadsWithInterview = repreneurs.filter(r => interviewsByRepreneur.has(r.id)).length
  const firstMeetingBookingRate = totalProfiles > 0
    ? Math.round((leadsWithInterview / totalProfiles) * 100)
    : 0

  // Offer Submission Rate: % of qualified+ who received an offer
  const qualifiedAndAbove = repreneurs.filter(r => ["qualified", "client"].includes(r.lifecycle_status)).length
  const repreneursWithOffers = new Set(assignments.map(a => a.repreneur_id)).size
  const offerSubmissionRate = qualifiedAndAbove > 0
    ? Math.round((repreneursWithOffers / qualifiedAndAbove) * 100)
    : 0

  // Drop-off by stage
  const stageCounts = stageDistribution.map(s => s.count)
  const dropOffByStage = stageDistribution.map((s, i) => ({
    stage: s.stage,
    count: s.count,
    dropOff: i > 0 && stageCounts[i - 1] > 0
      ? Math.round(((stageCounts[i - 1] - s.count) / stageCounts[i - 1]) * 100)
      : 0,
  }))

  // Operational: Interviews Held, No-show Rate, Meeting-to-Offer Ratio
  const interviewsHeld = interviews.length
  const noShowCount = noShows.length
  const noShowRate = interviewsHeld + noShowCount > 0
    ? Math.round((noShowCount / (interviewsHeld + noShowCount)) * 100)
    : 0
  const meetingToOfferRatio = totalSent > 0
    ? Math.round((interviewsHeld / totalSent) * 10) / 10
    : null

  // Accuracy stats
  const ratedRepreneurs = repreneurs.filter(r => (r as any).who_accuracy)
  const whoAccurateCount = ratedRepreneurs.filter(r => (r as any).who_accuracy === "accurate").length
  const whenAccurateCount = ratedRepreneurs.filter(r => (r as any).when_accuracy === "accurate").length
  const accuracyStats = {
    whoAccurate: ratedRepreneurs.length > 0 ? Math.round((whoAccurateCount / ratedRepreneurs.length) * 100) : 0,
    whenAccurate: ratedRepreneurs.length > 0 ? Math.round((whenAccurateCount / ratedRepreneurs.length) * 100) : 0,
    total: ratedRepreneurs.length,
  }

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
    offerConversion,
    timeToFirstMeeting: median(firstMeetingDays),
    timeToQualification: median(qualificationDays),
    firstMeetingBookingRate,
    offerSubmissionRate,
    dropOffByStage,
    interviewsHeld,
    noShowRate,
    meetingToOfferRatio,
    accuracyStats,
  }
}

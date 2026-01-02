"use client"

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radar as RadarIcon } from "lucide-react"
import type { Repreneur } from "@/lib/types/repreneur"

interface CandidateRadarChartProps {
  repreneur: Repreneur
}

interface RadarDataPoint {
  dimension: string
  score: number
  fullMark: 100
}

// Calculate experience score (0-100)
function calculateExperienceScore(repreneur: Repreneur): number {
  let score = 0

  // Years of experience (max 40 points)
  const yearsMap: Record<string, number> = {
    "less_10": 10,
    "10_15": 20,
    "15_20": 30,
    "more_20": 40,
  }
  if (repreneur.q2_years_experience) {
    score += yearsMap[repreneur.q2_years_experience] || 0
  }

  // Employment status (max 30 points)
  const statusMap: Record<string, number> = {
    "employee": 15,
    "executive": 25,
    "entrepreneur": 30,
    "in_transition": 20,
    "retired": 15,
  }
  if (repreneur.q1_employment_status) {
    score += statusMap[repreneur.q1_employment_status] || 0
  }

  // Industry sectors (max 30 points)
  if (repreneur.q3_industry_sectors?.length) {
    score += Math.min(repreneur.q3_industry_sectors.length * 10, 30)
  }

  return Math.min(score, 100)
}

// Calculate leadership score (0-100)
function calculateLeadershipScore(repreneur: Repreneur): number {
  let score = 0

  // Team size managed (max 35 points)
  const teamMap: Record<string, number> = {
    "none": 0,
    "1_5": 10,
    "5_20": 20,
    "20_50": 30,
    "more_50": 35,
  }
  if (repreneur.q5_team_size) {
    score += teamMap[repreneur.q5_team_size] || 0
  }

  // Executive roles (max 40 points)
  if (repreneur.q8_executive_roles?.length) {
    score += Math.min(repreneur.q8_executive_roles.length * 15, 40)
  }

  // Board experience (25 points)
  if (repreneur.q9_board_experience) {
    score += 25
  }

  return Math.min(score, 100)
}

// Calculate M&A knowledge score (0-100)
function calculateMAKnowledgeScore(repreneur: Repreneur): number {
  let score = 0

  // Prior M&A experience (35 points)
  if (repreneur.q4_has_ma_experience) {
    score += 35
  }

  // Involved in M&A (30 points)
  if (repreneur.q6_involved_in_ma) {
    score += 30
  }

  // M&A details provided (35 points)
  if (repreneur.q7_ma_details && repreneur.q7_ma_details.length > 20) {
    score += 35
  } else if (repreneur.q7_ma_details) {
    score += 15
  }

  return Math.min(score, 100)
}

// Calculate acquisition readiness score (0-100)
function calculateReadinessScore(repreneur: Repreneur): number {
  let score = 0

  // Journey stages (max 40 points)
  const stageMap: Record<string, number> = {
    "explorer": 10,
    "learner": 25,
    "ready": 40,
    "serial_acquirer": 40,
  }
  if (repreneur.journey_stage) {
    score += stageMap[repreneur.journey_stage] || 0
  }

  // Has identified targets (30 points)
  if (repreneur.q12_has_identified_targets) {
    score += 30
  }

  // Target details provided (30 points)
  if (repreneur.q13_target_details && repreneur.q13_target_details.length > 20) {
    score += 30
  } else if (repreneur.q13_target_details) {
    score += 15
  }

  return Math.min(score, 100)
}

// Calculate financial capacity score (0-100)
function calculateFinancialScore(repreneur: Repreneur): number {
  let score = 0

  // Investment capacity (max 50 points)
  const capacityMap: Record<string, number> = {
    "€0 - €50,000": 10,
    "€50,000 - €100,000": 20,
    "€100,000 - €200,000": 30,
    "€200,000 - €500,000": 40,
    "€500,000+": 50,
  }
  if (repreneur.investment_capacity) {
    score += capacityMap[repreneur.investment_capacity] || 0
  }

  // Funding status (max 50 points)
  const fundingMap: Record<string, number> = {
    "not_started": 5,
    "exploring": 15,
    "in_progress": 30,
    "secured": 50,
  }
  if (repreneur.q15_funding_status) {
    score += fundingMap[repreneur.q15_funding_status] || 0
  }

  return Math.min(score, 100)
}

export function CandidateRadarChart({ repreneur }: CandidateRadarChartProps) {
  const data: RadarDataPoint[] = [
    {
      dimension: "Experience",
      score: calculateExperienceScore(repreneur),
      fullMark: 100,
    },
    {
      dimension: "Leadership",
      score: calculateLeadershipScore(repreneur),
      fullMark: 100,
    },
    {
      dimension: "M&A Knowledge",
      score: calculateMAKnowledgeScore(repreneur),
      fullMark: 100,
    },
    {
      dimension: "Readiness",
      score: calculateReadinessScore(repreneur),
      fullMark: 100,
    },
    {
      dimension: "Financial",
      score: calculateFinancialScore(repreneur),
      fullMark: 100,
    },
  ]

  // Check if we have any data to display
  const hasData = data.some((d) => d.score > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="h-5 w-5" />
          Profile Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  tickCount={5}
                />
                <Radar
                  name="Profile Score"
                  dataKey="score"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: number) => [`${value} / 100`, "Score"]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            Complete the questionnaire to see profile analysis
          </div>
        )}
      </CardContent>
    </Card>
  )
}

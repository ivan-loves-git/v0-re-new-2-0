"use client"

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, BarChart, Bar, XAxis, YAxis, Cell, PieChart, Pie } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radar as RadarIcon, BarChart3, CircleDot, Layers, Grid3X3, Gauge } from "lucide-react"

// Sample data for testing (same structure as real component)
const TIER1_DATA = [
  { dimension: "Experience", score: 85, fullMark: 100 },
  { dimension: "Leadership", score: 70, fullMark: 100 },
  { dimension: "M&A", score: 60, fullMark: 100 },
  { dimension: "Readiness", score: 75, fullMark: 100 },
  { dimension: "Financial", score: 90, fullMark: 100 },
]

const TIER2_DATA = [
  { dimension: "Leadership", score: 72, fullMark: 100 },
  { dimension: "Fin. Acumen", score: 80, fullMark: 100 },
  { dimension: "Communication", score: 60, fullMark: 100 },
  { dimension: "Vision", score: 68, fullMark: 100 },
  { dimension: "Coachability", score: 84, fullMark: 100 },
  { dimension: "Commitment", score: 76, fullMark: 100 },
]

// Version 1: Overlapping Radars (both on same chart)
export function ProfileOverviewV1() {
  // Combine data - align on common points
  const combinedData = [
    { dimension: "Experience", tier1: 85, tier2: 0 },
    { dimension: "Leadership", tier1: 70, tier2: 72 },
    { dimension: "M&A/Fin", tier1: 60, tier2: 80 },
    { dimension: "Readiness", tier1: 75, tier2: 68 },
    { dimension: "Financial", tier1: 90, tier2: 76 },
    { dimension: "Comm/Coach", tier1: 0, tier2: 72 },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" />
          V1: Overlapping Radars
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={combinedData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="dimension" tick={{ fill: "#6b7280", fontSize: 9 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8 }} tickCount={3} />
              <Radar name="Tier 1" dataKey="tier1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
              <Radar name="Tier 2" dataKey="tier2" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 text-xs mt-1">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-full opacity-50"></span> T1 Skills</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-500 rounded-full opacity-50"></span> T2 Competencies</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Version 2: Side-by-side Mini Radars
export function ProfileOverviewV2() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Grid3X3 className="h-4 w-4" />
          V2: Side-by-Side Mini
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-center text-blue-600 font-medium mb-1">T1: Skills</p>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={TIER1_DATA}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "#6b7280", fontSize: 8 }} />
                  <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-xs text-center text-amber-600 font-medium mb-1">T2: Competencies</p>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={TIER2_DATA}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "#6b7280", fontSize: 8 }} />
                  <Radar dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Version 3: Horizontal Bar Chart
export function ProfileOverviewV3() {
  const barData = [
    ...TIER1_DATA.map(d => ({ ...d, tier: "T1", fill: "#3b82f6" })),
    ...TIER2_DATA.map(d => ({ ...d, tier: "T2", fill: "#f59e0b" })),
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-4 w-4" />
          V3: Horizontal Bars
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-blue-600 font-medium mb-2">Tier 1: Skills</p>
            <div className="space-y-1.5">
              {TIER1_DATA.map((d) => (
                <div key={d.dimension} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20 truncate">{d.dimension}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${d.score}%` }} />
                  </div>
                  <span className="text-xs text-gray-600 w-8">{d.score}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs text-amber-600 font-medium mb-2">Tier 2: Competencies</p>
            <div className="space-y-1.5">
              {TIER2_DATA.map((d) => (
                <div key={d.dimension} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20 truncate">{d.dimension}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${d.score}%` }} />
                  </div>
                  <span className="text-xs text-gray-600 w-8">{d.score}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Version 4: Compact Stacked (current but smaller)
export function ProfileOverviewV4() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <RadarIcon className="h-4 w-4" />
          V4: Compact Stacked
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="h-[130px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={TIER1_DATA}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="dimension" tick={{ fill: "#6b7280", fontSize: 9 }} />
              <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="border-t pt-1">
          <div className="h-[130px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="65%" data={TIER2_DATA}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="dimension" tick={{ fill: "#6b7280", fontSize: 9 }} />
                <Radar dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex justify-center gap-4 text-xs border-t pt-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> T1</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> T2</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Version 5: Donut Rings
export function ProfileOverviewV5() {
  const tier1Avg = Math.round(TIER1_DATA.reduce((sum, d) => sum + d.score, 0) / TIER1_DATA.length)
  const tier2Avg = Math.round(TIER2_DATA.reduce((sum, d) => sum + d.score, 0) / TIER2_DATA.length)

  const ringData1 = [{ value: tier1Avg }, { value: 100 - tier1Avg }]
  const ringData2 = [{ value: tier2Avg }, { value: 100 - tier2Avg }]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CircleDot className="h-4 w-4" />
          V5: Donut Rings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {/* Outer ring - Tier 1 */}
              <Pie
                data={ringData1}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={85}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
              >
                <Cell fill="#3b82f6" />
                <Cell fill="#e5e7eb" />
              </Pie>
              {/* Inner ring - Tier 2 */}
              <Pie
                data={ringData2}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={60}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
              >
                <Cell fill="#f59e0b" />
                <Cell fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-500">Overall</span>
            <span className="text-xl font-bold">{Math.round((tier1Avg + tier2Avg) / 2)}%</span>
          </div>
        </div>
        <div className="flex justify-center gap-6 text-xs mt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            T1: {tier1Avg}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
            T2: {tier2Avg}%
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// Version 6: Gauge Cluster
export function ProfileOverviewV6() {
  const tier1Avg = Math.round(TIER1_DATA.reduce((sum, d) => sum + d.score, 0) / TIER1_DATA.length)
  const tier2Avg = Math.round(TIER2_DATA.reduce((sum, d) => sum + d.score, 0) / TIER2_DATA.length)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gauge className="h-4 w-4" />
          V6: Summary Gauges
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Tier 1 Gauge */}
          <div className="text-center">
            <div className="relative w-28 h-14 mx-auto overflow-hidden">
              <div className="absolute inset-0 flex items-end justify-center">
                <div
                  className="w-28 h-28 rounded-full border-8 border-gray-200"
                  style={{
                    borderTopColor: '#3b82f6',
                    borderRightColor: tier1Avg > 25 ? '#3b82f6' : '#e5e7eb',
                    borderBottomColor: tier1Avg > 50 ? '#3b82f6' : '#e5e7eb',
                    borderLeftColor: tier1Avg > 75 ? '#3b82f6' : '#e5e7eb',
                    transform: 'rotate(-45deg)',
                  }}
                />
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                <span className="text-2xl font-bold text-blue-600">{tier1Avg}</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">Tier 1: Skills</p>
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {TIER1_DATA.map((d, i) => (
                <span key={i} className="text-[10px] text-gray-400">{d.dimension.substring(0, 3)}</span>
              ))}
            </div>
          </div>
          {/* Tier 2 Gauge */}
          <div className="text-center">
            <div className="relative w-28 h-14 mx-auto overflow-hidden">
              <div className="absolute inset-0 flex items-end justify-center">
                <div
                  className="w-28 h-28 rounded-full border-8 border-gray-200"
                  style={{
                    borderTopColor: '#f59e0b',
                    borderRightColor: tier2Avg > 25 ? '#f59e0b' : '#e5e7eb',
                    borderBottomColor: tier2Avg > 50 ? '#f59e0b' : '#e5e7eb',
                    borderLeftColor: tier2Avg > 75 ? '#f59e0b' : '#e5e7eb',
                    transform: 'rotate(-45deg)',
                  }}
                />
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                <span className="text-2xl font-bold text-amber-600">{tier2Avg}</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">Tier 2: Competencies</p>
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {TIER2_DATA.map((d, i) => (
                <span key={i} className="text-[10px] text-gray-400">{d.dimension.substring(0, 3)}</span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

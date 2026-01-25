"use client"

import { useState } from "react"
import {
  CardVariantA,
  CardVariantB,
  CardVariantC,
  CardVariantD,
  DualScoreData,
  Flag,
} from "@/components/scoring-v2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Beaker, CheckCircle2 } from "lucide-react"

// Sample data scenarios
const SCENARIOS: Record<string, DualScoreData> = {
  ideal: {
    who: 85,
    when: 92,
    flags: [],
    recommendation: "deal_flow",
  },
  strong_who_weak_when: {
    who: 78,
    when: 45,
    flags: [],
    recommendation: "interview_validate_thesis",
  },
  weak_who_strong_when: {
    who: 55,
    when: 88,
    flags: [],
    recommendation: "interview_validate_execution",
  },
  with_flags: {
    who: 72,
    when: 85,
    flags: ["F2", "F3"] as Flag[],
    recommendation: "starter_pack",
  },
  explorer: {
    who: 45,
    when: 25,
    flags: [],
    recommendation: "starter_pack",
  },
  incomplete: {
    who: 62,
    when: null,
    flags: [],
    recommendation: "starter_pack",
    needsDataCompletion: true,
  },
}

export default function ScoringCardsExperimentPage() {
  const [whoScore, setWhoScore] = useState(75)
  const [whenScore, setWhenScore] = useState(68)
  const [hasFlags, setHasFlags] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)

  // Build custom data from sliders
  const customData: DualScoreData = {
    who: whoScore,
    when: whenScore,
    flags: hasFlags ? (["F1", "F3"] as Flag[]) : [],
    recommendation: hasFlags
      ? "starter_pack"
      : whoScore >= 70 && whenScore >= 80
      ? "deal_flow"
      : whenScore >= 80
      ? "interview_validate_execution"
      : whoScore >= 70
      ? "interview_validate_thesis"
      : "starter_pack",
  }

  const activeData = selectedScenario ? SCENARIOS[selectedScenario] : customData

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-purple-50">
          <Beaker className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Scoring Card Variants
          </h1>
          <p className="text-gray-600 mt-1">
            Compare 4 different UI approaches for displaying WHO + WHEN scores
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario buttons */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Scenarios</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SCENARIOS).map(([key, scenario]) => (
                <button
                  key={key}
                  onClick={() =>
                    setSelectedScenario(selectedScenario === key ? null : key)
                  }
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    selectedScenario === key
                      ? "bg-purple-100 border-purple-300 text-purple-800"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {key.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Manual controls */}
          {!selectedScenario && (
            <div className="grid md:grid-cols-3 gap-6 pt-4 border-t">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>WHO Score</Label>
                  <span className="text-sm font-mono text-gray-600">
                    {whoScore}
                  </span>
                </div>
                <Slider
                  value={[whoScore]}
                  onValueChange={([v]) => setWhoScore(v)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>WHEN Score</Label>
                  <span className="text-sm font-mono text-gray-600">
                    {whenScore}
                  </span>
                </div>
                <Slider
                  value={[whenScore]}
                  onValueChange={([v]) => setWhenScore(v)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="flags"
                  checked={hasFlags}
                  onCheckedChange={setHasFlags}
                />
                <Label htmlFor="flags">Add warning flags</Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* APPROVED: Variant B with Tier 2 Preview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-green-800">
            Approved Design: Variant B + Tier 2 Combined
          </h2>
          <Badge className="bg-green-100 text-green-800 border-green-200">Ready to Implement</Badge>
        </div>

        {/* Preview of combined card */}
        <Card className="border-2 border-green-200 bg-green-50/30">
          <CardContent className="p-6">
            <div className="space-y-0">
              {/* Variant B (WHO + WHEN scores) */}
              <CardVariantB data={activeData} repreneurId="demo" />

              {/* Tier 2 Preview (placeholder) */}
              <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500 text-center">
                  Tier 2 Details Section (criteria breakdown) will go here
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Other Variants (for reference) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Other Variants (Reference Only)</h2>
        <div className="grid md:grid-cols-3 gap-6 opacity-60">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500">
              Variant A: Stacked
            </h3>
            <CardVariantA data={activeData} repreneurId="demo" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500">
              Variant C: Progress Bars
            </h3>
            <CardVariantC data={activeData} repreneurId="demo" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500">
              Variant D: Compact
            </h3>
            <CardVariantD data={activeData} repreneurId="demo" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="text-sm text-gray-500 space-y-1">
        <p>
          <strong>Color coding:</strong> Green (80+), Blue (60-79), Amber
          (40-59), Red (&lt;40)
        </p>
        <p>
          <strong>Flags:</strong> When present, override the score-based
          recommendation to "Starter Pack"
        </p>
      </div>
    </div>
  )
}

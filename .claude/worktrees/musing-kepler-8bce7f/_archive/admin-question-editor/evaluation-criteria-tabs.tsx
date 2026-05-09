"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tier1CriteriaEditor } from "./tier1-criteria-editor"
import { Clock } from "lucide-react"
import type { EvaluationQuestion } from "@/lib/types/evaluation-criteria"

interface EvaluationCriteriaTabsProps {
  tier1Questions: EvaluationQuestion[]
}

export function EvaluationCriteriaTabs({
  tier1Questions,
}: EvaluationCriteriaTabsProps) {
  return (
    <Tabs defaultValue="tier1" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="tier1">Tier 1</TabsTrigger>
        <TabsTrigger value="tier2" disabled className="opacity-50">
          Tier 2
        </TabsTrigger>
        <TabsTrigger value="tier3" disabled className="opacity-50">
          Tier 3
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tier1" className="mt-6">
        <Tier1CriteriaEditor questions={tier1Questions} />
      </TabsContent>

      <TabsContent value="tier2" className="mt-6">
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Clock className="h-12 w-12 mb-4 text-gray-300" />
          <p className="text-lg font-medium">Tier 2 Coming Soon</p>
          <p className="text-sm mt-2 text-gray-400">
            Post-interview evaluation criteria will be added in a future update
          </p>
        </div>
      </TabsContent>

      <TabsContent value="tier3" className="mt-6">
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Clock className="h-12 w-12 mb-4 text-gray-300" />
          <p className="text-lg font-medium">Tier 3 Coming Soon</p>
          <p className="text-sm mt-2 text-gray-400">
            Strategic evaluation criteria will be added in a future update
          </p>
        </div>
      </TabsContent>
    </Tabs>
  )
}

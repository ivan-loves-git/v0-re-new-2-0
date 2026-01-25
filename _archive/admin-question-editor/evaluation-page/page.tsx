import { EvaluationCriteriaTabs } from "@/components/guide"
import { getGroupedEvaluationCriteria } from "@/lib/data/evaluation-criteria"
import { ClipboardList, AlertTriangle } from "lucide-react"

export const revalidate = 0 // Always fetch fresh data

export default async function EvaluationCriteriaPage() {
  let tier1Questions
  let error = null

  try {
    tier1Questions = await getGroupedEvaluationCriteria("tier1")
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load criteria"
    tier1Questions = []
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-purple-50">
          <ClipboardList className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Evaluation Criteria
          </h1>
          <p className="text-gray-600 mt-1">
            Configure scoring criteria for Tier 1, Tier 2, and Tier 3 evaluations
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="text-sm text-red-900">
            <p className="font-medium">Failed to load evaluation criteria</p>
            <p className="mt-1 text-red-700">{error}</p>
            <p className="mt-2 text-red-600">
              Make sure you have run the database migrations (scripts 014 and 015).
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {!error && <EvaluationCriteriaTabs tier1Questions={tier1Questions} />}
    </div>
  )
}

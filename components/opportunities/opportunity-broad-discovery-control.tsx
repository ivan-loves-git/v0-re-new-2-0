import { Eye, EyeOff, TriangleAlert } from "lucide-react"
import { broadDiscoveryPublicationState } from "@/lib/opportunity-broad-discovery-publication"
import type { Opportunity } from "@/lib/types/opportunity"

export function OpportunityBroadDiscoveryControl({
  opportunity,
}: {
  opportunity: Pick<
    Opportunity,
    | "status"
    | "is_demo"
    | "repreneur_exposure"
    | "public_title"
    | "teaser_summary"
    | "sector"
    | "location"
  >
}) {
  const state = broadDiscoveryPublicationState(opportunity)
  const visible = state.mode === "visible"

  return (
    <div className="flex max-w-80 flex-col gap-1 rounded-md border px-3 py-2 text-sm">
      <span className="inline-flex items-center gap-1.5 font-medium">
        {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {visible ? `Visible in ${state.namespace} Deal Flow` : "Hidden from Deal Flow"}
      </span>
      <span className="text-xs leading-4 text-muted-foreground">
        {visible
          ? state.namespace === "DEMO"
            ? "Active lifecycle; visible only to DEMO portal identities."
            : "Active lifecycle; visible through the public-safe opportunity summary."
          : `The ${opportunity.status} lifecycle keeps this opportunity hidden.`}
      </span>
      {state.missingFields.length > 0 ? (
        <span className="inline-flex items-start gap-1 text-xs leading-4 text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Missing {state.missingFields.join(", ")} is a staff warning, not a visibility blocker.
        </span>
      ) : null}
    </div>
  )
}

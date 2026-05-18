import { Badge } from "@/components/ui/badge"
import {
  getOpportunityStatusLabel,
  getOpportunityVisibilityLabel,
  type OpportunityStatus,
  type OpportunityVisibility,
} from "@/lib/types/opportunity"
import { getOpportunityJourneyLabel, type OpportunityJourney } from "@/lib/utils/opportunity-journey"

export function OpportunityStatusBadge({ status }: { status: OpportunityStatus }) {
  const variant =
    status === "active" ? "default" :
    status === "archived" || status === "closed" ? "secondary" :
    status === "paused" ? "outline" :
    "secondary"

  return <Badge variant={variant}>{getOpportunityStatusLabel(status)}</Badge>
}

export function OpportunityVisibilityBadge({ visibility }: { visibility: OpportunityVisibility }) {
  const variant = visibility === "staff_only" ? "secondary" : visibility === "anonymized" ? "outline" : "default"

  return <Badge variant={variant}>{getOpportunityVisibilityLabel(visibility)}</Badge>
}

export function OpportunityJourneyBadge({ journey }: { journey: OpportunityJourney }) {
  const className =
    journey === "active_pursuit" || journey === "intermediary_meeting" || journey === "seller_meeting" || journey === "loi"
      ? "border-transparent bg-primary text-primary-foreground"
      : journey === "interest_received" || journey === "proposed" || journey === "matching"
        ? "border-transparent bg-amber-100 text-amber-800"
        : journey === "closed"
          ? "border-transparent bg-emerald-100 text-emerald-800"
          : journey === "dropped" || journey === "archived"
            ? "border-transparent bg-muted text-muted-foreground"
            : undefined

  return (
    <Badge variant={className ? "outline" : "secondary"} className={className}>
      {getOpportunityJourneyLabel(journey)}
    </Badge>
  )
}

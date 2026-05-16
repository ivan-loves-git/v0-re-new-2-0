import { Badge } from "@/components/ui/badge"
import {
  getOpportunityStatusLabel,
  getOpportunityVisibilityLabel,
  type OpportunityStatus,
  type OpportunityVisibility,
} from "@/lib/types/opportunity"

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

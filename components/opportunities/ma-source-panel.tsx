import { Building2, Mail, Phone, ShieldCheck, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MaSource, OpportunityVisibility } from "@/lib/types/opportunity"
import { OpportunityVisibilityBadge } from "@/components/opportunities/opportunity-status-badge"

interface MaSourcePanelProps {
  source?: MaSource | null
  sourceLabel?: string | null
  sourceVisibility?: OpportunityVisibility
}

export function MaSourcePanel({ source, sourceLabel, sourceVisibility = "staff_only" }: MaSourcePanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5" />
          M&A Source
        </CardTitle>
        <CardDescription>Staff-only source and contact context.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <OpportunityVisibilityBadge visibility={sourceVisibility} />
          <Badge variant="outline">
            <ShieldCheck className="size-3" />
            Staff-only by default
          </Badge>
        </div>

        {source || sourceLabel ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Firm / source</p>
              <p className="font-medium">{source?.firm_name ?? sourceLabel}</p>
            </div>
            {source?.contact_name && (
              <div className="flex items-center gap-2">
                <UserRound className="size-4 text-muted-foreground" />
                <span>{source.contact_name}</span>
              </div>
            )}
            {source?.contact_email && (
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <span>{source.contact_email}</span>
              </div>
            )}
            {source?.contact_phone && (
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                <span>{source.contact_phone}</span>
              </div>
            )}
            {source?.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Internal notes</p>
                <p className="text-muted-foreground">{source.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No source/contact details stored yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

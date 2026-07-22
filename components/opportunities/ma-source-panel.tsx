import { Building2, Mail, Phone, ShieldCheck, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MaSource, OpportunitySourceContact } from "@/lib/types/opportunity"

interface MaSourcePanelProps {
  source?: MaSource | null
  sourceLabel?: string | null
  sourceContacts?: OpportunitySourceContact[]
}

export function MaSourcePanel({ source, sourceLabel, sourceContacts = [] }: MaSourcePanelProps) {
  const contacts = [...sourceContacts].sort(
    (left, right) => Number(right.is_primary) - Number(left.is_primary),
  )

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
          <Badge variant="outline">
            <ShieldCheck className="size-3" />
            Staff-only source
          </Badge>
        </div>

        {source || sourceLabel ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Firm / source</p>
              <p className="font-medium">{source?.firm_name ?? sourceLabel}</p>
            </div>
            {contacts.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Contacts on this opportunity</p>
                {contacts.map((relation) => {
                  const contact = relation.contact
                  const name =
                    contact?.name || contact?.email || contact?.phone || "Unnamed contact"
                  return (
                    <div
                      key={relation.contact_id}
                      className="space-y-1 rounded-md border bg-muted/20 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <UserRound className="size-4 text-muted-foreground" />
                        <span className="font-medium">{name}</span>
                        {relation.is_primary ? (
                          <Badge variant="secondary">Default recipient</Badge>
                        ) : null}
                      </div>
                      {contact?.email ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="size-4" />
                          <span>{contact.email}</span>
                        </div>
                      ) : null}
                      {contact?.phone ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="size-4" />
                          <span>{contact.phone}</span>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No contacts are linked to this opportunity yet.
              </p>
            )}
            {source?.internal_notes && (
              <div>
                <p className="text-xs text-muted-foreground">Internal notes</p>
                <p className="text-muted-foreground">{source.internal_notes}</p>
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

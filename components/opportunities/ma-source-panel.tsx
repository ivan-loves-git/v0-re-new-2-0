import { Building2, Mail, Phone, ShieldCheck, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  MaSource,
  OpportunityMaContact,
  OpportunitySourceContact,
  OpportunitySourceOffice,
} from "@/lib/types/opportunity"

interface MaSourcePanelProps {
  source?: MaSource | null
  sourceLabel?: string | null
  sourceContacts?: OpportunitySourceContact[]
  sourceOffice?: OpportunitySourceOffice | null
  officeContacts?: OpportunityMaContact[]
}

function canonicalContactName(contact: OpportunityMaContact) {
  return (
    contact.contact_name_snapshot ??
    contact.affiliation?.contact?.display_name ??
    contact.contact_email_snapshot ??
    "Unnamed contact"
  )
}

function canonicalContactEmail(contact: OpportunityMaContact) {
  return (
    contact.contact_email_snapshot ??
    contact.affiliation?.contact?.email ??
    null
  )
}

function canonicalContactPhone(contact: OpportunityMaContact) {
  return (
    contact.contact_phone_snapshot ??
    contact.affiliation?.contact?.phone ??
    null
  )
}

export function MaSourcePanel({
  source,
  sourceLabel,
  sourceContacts = [],
  sourceOffice,
  officeContacts = [],
}: MaSourcePanelProps) {
  const canonicalContacts = [...officeContacts]
    .filter((contact) => contact.is_active)
    .sort((left, right) => Number(right.is_primary) - Number(left.is_primary))
  const legacyContacts = [...sourceContacts].sort(
    (left, right) => Number(right.is_primary) - Number(left.is_primary),
  )
  const hasCanonicalContext =
    Boolean(sourceOffice) || canonicalContacts.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5" />
          M&A source
        </CardTitle>
        <CardDescription>
          Staff-only source and contact context.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <ShieldCheck className="size-3" />
            Staff-only source
          </Badge>
        </div>

        {hasCanonicalContext ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">M&A advisory firm</p>
              <p className="font-medium">
                {sourceOffice?.firm?.name ??
                  source?.firm_name ??
                  sourceLabel ??
                  "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Operating office</p>
              <p className="font-medium">{sourceOffice?.name ?? "-"}</p>
            </div>
            {canonicalContacts.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Contacts on this opportunity
                </p>
                {canonicalContacts.map((relation) => {
                  const email = canonicalContactEmail(relation)
                  const phone = canonicalContactPhone(relation)
                  return (
                    <div
                      key={relation.id ?? relation.affiliation_id}
                      className="space-y-1 rounded-md border bg-muted/20 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <UserRound className="size-4 text-muted-foreground" />
                        <span className="font-medium">
                          {canonicalContactName(relation)}
                        </span>
                        {relation.is_primary ? (
                          <Badge variant="secondary">Primary recipient</Badge>
                        ) : null}
                      </div>
                      {email ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="size-4" />
                          <span>{email}</span>
                        </div>
                      ) : null}
                      {phone ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="size-4" />
                          <span>{phone}</span>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active contacts are linked to this opportunity yet.
              </p>
            )}
          </div>
        ) : source || sourceLabel ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">
                Legacy firm / source
              </p>
              <p className="font-medium">{source?.firm_name ?? sourceLabel}</p>
            </div>
            {legacyContacts.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Historical linked contacts
                </p>
                {legacyContacts.map((relation) => {
                  const contact = relation.contact
                  const name =
                    contact?.name ||
                    contact?.email ||
                    contact?.phone ||
                    "Unnamed contact"
                  return (
                    <div
                      key={relation.contact_id}
                      className="space-y-1 rounded-md border bg-muted/20 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <UserRound className="size-4 text-muted-foreground" />
                        <span className="font-medium">{name}</span>
                        {relation.is_primary ? (
                          <Badge variant="secondary">Historical primary</Badge>
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
                No contacts are linked to this historical opportunity.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No source/contact details stored yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

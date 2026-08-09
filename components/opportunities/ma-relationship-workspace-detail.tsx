import Link from "next/link"
import { ArrowLeft, Building2, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MaOfficeContactAction } from "@/components/opportunities/ma-office-contact-action"
import { MaRelationshipWorkspaceNotes } from "@/components/opportunities/ma-relationship-workspace-notes"
import { MaFirmOfficeAction } from "@/components/opportunities/ma-firm-office-action"
import {
  type MaFirmWorkspace,
  type MaOfficeWorkspace,
  type MaWorkspaceIndicators,
} from "@/lib/actions/ma-relationship-workspaces"
import { hasConfirmedProviderDelivery } from "@/lib/ma-relationship-activity-provenance"

function dateLabel(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date)
}

function statusVariant(status: string) {
  return status === "active" ? "default" : "secondary"
}

function Indicators({ indicators }: { indicators: MaWorkspaceIndicators }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
      {[
        ["Active contacts", indicators.activeContacts],
        ["Open opportunities", indicators.openOpportunities],
        ["Candidate-stale", indicators.staleOpportunities],
        ["Closed", indicators.closedOpportunities],
      ].map(([label, value]) => (
        <div key={String(label)} className="bg-card px-4 py-3">
          <p className="wave-micro-label text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  )
}

function Notes({
  target,
  id,
  notes,
  createdAt,
  updatedAt,
  updatedBy,
}: {
  target: "office" | "firm"
  id: string
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
  updatedBy: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Internal notes</CardTitle>
        <CardDescription>
          Staff-only relationship context with its retained change audit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <MaRelationshipWorkspaceNotes
          target={target}
          id={id}
          initialNotes={notes}
        />
        <p className="text-xs text-muted-foreground">
          Created {dateLabel(createdAt)} · Last changed {dateLabel(updatedAt)}
          {updatedBy
            ? ` · Actor ${updatedBy}`
            : " · No staff actor was retained"}
        </p>
      </CardContent>
    </Card>
  )
}

function Activity({
  activity,
}: {
  activity: MaOfficeWorkspace["activity"] | MaFirmWorkspace["activity"]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Relationship activity</CardTitle>
        <CardDescription>
          Read-only canonical ledger for this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No relationship activity recorded.
          </p>
        ) : (
          <ul className="space-y-3">
            {activity.slice(0, 12).map((item) => {
              const confirmedProviderDelivery = hasConfirmedProviderDelivery(item)
              return (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {item.title || `${item.channel} activity`}
                      </p>
                      <Badge variant="outline">
                        {item.activityProvenance === "manual"
                          ? "Manual"
                          : "System-recorded"}
                      </Badge>
                      {item.activityProvenance === "system-recorded" &&
                      item.deliveryStatus ? (
                        <span
                          className={
                            item.deliveryStatus === "failed"
                              ? "text-xs text-destructive"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {confirmedProviderDelivery
                            ? "sent"
                            : item.deliveryStatus === "sent"
                              ? "delivery unconfirmed"
                              : item.deliveryStatus}
                        </span>
                      ) : null}
                    </div>
                    {item.opportunityId && item.opportunityLabel ? (
                      <Link
                        className="text-xs text-muted-foreground hover:underline"
                        href={`/opportunities/${item.opportunityId}`}
                      >
                        {item.opportunityLabel}
                      </Link>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dateLabel(item.occurredAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Contacts({
  contacts,
  includeHistorical = false,
}: {
  contacts: MaOfficeWorkspace["contacts"] | MaFirmWorkspace["contacts"]
  includeHistorical?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contacts</CardTitle>
        <CardDescription>
          {includeHistorical
            ? "Current and historical office affiliations remain distinct from the canonical person identity."
            : "Distinct active canonical people across this firm's offices."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No contacts are linked to this workspace.
          </p>
        ) : (
          <ul className="space-y-3">
            {contacts.map((contact) => (
              <li
                key={`${contact.id}-${contact.affiliationId}`}
                className="flex items-start justify-between gap-3"
              >
                <div>
                  <Link
                    href={`/opportunities/ma/contacts?contactId=${contact.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {contact.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {contact.jobTitle ||
                      contact.email ||
                      "No role or email recorded"}
                  </p>
                </div>
                <Badge variant={contact.isActive ? "outline" : "secondary"}>
                  {contact.isActive ? "Active" : "Historical"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Opportunities({
  opportunities,
}: {
  opportunities:
    | MaOfficeWorkspace["opportunities"]
    | MaFirmWorkspace["opportunities"]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Opportunities</CardTitle>
        <CardDescription>
          Source opportunities remain attached to the operating office.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No opportunities are linked to this workspace.
          </p>
        ) : (
          <ul className="space-y-3">
            {opportunities.map((opportunity) => (
              <li
                key={opportunity.id}
                className="flex items-start justify-between gap-3"
              >
                <div>
                  <Link
                    href={`/opportunities/${opportunity.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {opportunity.label}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Added {dateLabel(opportunity.dateAdded)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Badge variant="outline">{opportunity.status}</Badge>
                  {opportunity.isCandidateStale ? (
                    <Badge variant="secondary">Candidate-stale</Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function MaOfficeWorkspaceDetail({
  workspace,
}: {
  workspace: MaOfficeWorkspace
}) {
  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/opportunities/ma/firms/${workspace.firmId}`}>
          <ArrowLeft data-icon="inline-start" />
          Back to {workspace.firmName}
        </Link>
      </Button>
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(workspace.status)}>
              {workspace.status}
            </Badge>
            {workspace.isDefault ? (
              <Badge variant="secondary">Default office</Badge>
            ) : null}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <Building2 className="size-4" />
            {workspace.firmName}
            {workspace.city ? (
              <>
                <span>·</span>
                <MapPin className="size-4" />
                {workspace.city}
              </>
            ) : null}
          </p>
        </div>
        <MaOfficeContactAction
          officeId={workspace.id}
          disabled={workspace.status !== "active"}
        />
      </header>
      <Indicators indicators={workspace.indicators} />
      <p className="text-xs text-muted-foreground">
        Latest known opportunity date:{" "}
        {dateLabel(workspace.indicators.latestKnownOpportunityDate)} ·
        Historical affiliations: {workspace.indicators.historicalAffiliations}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Contacts contacts={workspace.contacts} includeHistorical />
        <Opportunities opportunities={workspace.opportunities} />
        <Activity activity={workspace.activity} />
        <Notes
          target="office"
          id={workspace.id}
          notes={workspace.internalNotes}
          createdAt={workspace.createdAt}
          updatedAt={workspace.updatedAt}
          updatedBy={workspace.updatedBy}
        />
      </div>
    </div>
  )
}

export function MaFirmWorkspaceDetail({
  workspace,
}: {
  workspace: MaFirmWorkspace
}) {
  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link href="/opportunities/ma/firms">
          <ArrowLeft data-icon="inline-start" />
          Back to firms
        </Link>
      </Button>
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant={statusVariant(workspace.status)}>
            {workspace.status}
          </Badge>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Firm-wide view. Contacts, opportunities, and activity are derived
            through its offices.
          </p>
        </div>
        <MaFirmOfficeAction
          firmId={workspace.id}
          firmName={workspace.name}
          disabled={workspace.status !== "active"}
        />
      </header>
      <Indicators indicators={workspace.indicators} />
      <p className="text-xs text-muted-foreground">
        {workspace.offices.length}{" "}
        {workspace.offices.length === 1 ? "office" : "offices"} ·{" "}
        {workspace.indicators.activeContacts} distinct active{" "}
        {workspace.indicators.activeContacts === 1 ? "contact" : "contacts"} ·
        Latest known opportunity date:{" "}
        {dateLabel(workspace.indicators.latestKnownOpportunityDate)}
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operating offices</CardTitle>
          <CardDescription>
            Open a real office to manage its contacts and see its source
            activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspace.offices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No operating offices recorded.
            </p>
          ) : (
            <ul className="space-y-3">
              {workspace.offices.map((office) => (
                <li
                  key={office.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <Link
                      className="text-sm font-medium hover:underline"
                      href={`/opportunities/ma/offices/${office.id}`}
                    >
                      {office.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {office.city || "City not recorded"} ·{" "}
                      {office.indicators.activeContacts} active{" "}
                      {office.indicators.activeContacts === 1
                        ? "contact"
                        : "contacts"}{" "}
                      ·{" "}
                      {office.indicators.openOpportunities} open opportunities
                    </p>
                  </div>
                  <Badge
                    variant={
                      office.status === "active" ? "outline" : "secondary"
                    }
                  >
                    {office.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Contacts contacts={workspace.contacts} />
        <Opportunities opportunities={workspace.opportunities} />
        <Activity activity={workspace.activity} />
        <Notes
          target="firm"
          id={workspace.id}
          notes={workspace.internalNotes}
          createdAt={workspace.createdAt}
          updatedAt={workspace.updatedAt}
          updatedBy={workspace.updatedBy}
        />
      </div>
    </div>
  )
}

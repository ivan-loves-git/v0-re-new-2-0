import Link from "next/link"
import { ArrowLeft, Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { MaRelationshipWorkspace } from "@/lib/actions/ma-relationships"

type Firm = MaRelationshipWorkspace["firms"][number]
type Office = MaRelationshipWorkspace["offices"][number]
type Indicators = Firm["indicators"] | Office["indicators"]

function formatKnownDate(value: string | null) {
  if (!value) return "Unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function IndicatorGrid({
  indicators,
  officeCount,
}: {
  indicators: Indicators
  officeCount?: number
}) {
  const entries = [
    ...(officeCount === undefined
      ? []
      : [{ label: "Operating offices", value: officeCount }]),
    { label: "Active contacts", value: indicators.activeContactCount },
    {
      label: "Sourced opportunities",
      value: indicators.sourcedOpportunityCount,
    },
    { label: "Open opportunities", value: indicators.openOpportunityCount },
    { label: "Candidate-stale", value: indicators.candidateStaleCount },
    {
      label: "Latest opportunity date",
      value: formatKnownDate(indicators.latestKnownAt),
    },
  ]

  return (
    <dl
      aria-label="Relationship indicators"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {entries.map((entry) => (
        <div className="rounded-lg border bg-card px-4 py-3" key={entry.label}>
          <dt className="wave-micro-label text-muted-foreground">
            {entry.label}
          </dt>
          <dd className="mt-1 text-xl font-semibold tracking-tight">
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function MaFirmIndicatorDetail({
  firm,
  offices,
}: {
  firm: Firm
  offices: Office[]
}) {
  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost">
        <Link href="/opportunities/ma/firms">
          <ArrowLeft data-icon="inline-start" />
          Back to firms
        </Link>
      </Button>

      <header className="space-y-3">
        <Badge className="capitalize" variant="outline">
          {firm.status}
        </Badge>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {firm.name}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Read-only relationship indicators derived from this firm&apos;s
            canonical operating offices.
          </p>
        </div>
      </header>

      <IndicatorGrid
        indicators={firm.indicators}
        officeCount={firm.indicators.officeCount}
      />

      <Card>
        <CardHeader>
          <CardTitle>Operating offices</CardTitle>
          <CardDescription>
            Each office keeps its own status and reconciled indicators.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {offices.length ? (
            <ul className="divide-y rounded-lg border">
              {offices.map((office) => (
                <li
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={office.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" />
                      <p className="font-medium">{office.officeName}</p>
                      <Badge className="capitalize" variant="outline">
                        {office.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {office.indicators.activeContactCount} active contacts ·{" "}
                      {office.indicators.openOpportunityCount} open ·{" "}
                      {office.indicators.candidateStaleCount} candidate-stale
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/opportunities/ma/offices/${office.id}`}>
                      Open office
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No canonical office is attached to this firm.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function MaOfficeIndicatorDetail({
  office,
  firm,
}: {
  office: Office
  firm: Firm | null
}) {
  const firmHref = firm
    ? `/opportunities/ma/firms/${firm.id}`
    : "/opportunities/ma/firms"

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost">
        <Link href={firmHref}>
          <ArrowLeft data-icon="inline-start" />
          Back to {firm?.name ?? "firms"}
        </Link>
      </Button>

      <header className="space-y-3">
        <Badge className="capitalize" variant="outline">
          {office.status}
        </Badge>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {office.officeName}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {office.firmName} · Read-only indicators for this exact operating
            office.
          </p>
        </div>
      </header>

      <IndicatorGrid indicators={office.indicators} />
    </div>
  )
}

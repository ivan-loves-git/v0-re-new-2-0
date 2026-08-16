"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock3, Link2, RefreshCw, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { confirmExternalPursuitCurrent } from "@/lib/actions/external-pursuit-capacity"
import type {
  ExternalPursuitCapacityDossier,
  ExternalPursuitCapacitySnapshot,
  ExternalPursuitDueState,
  ExternalPursuitFreshness,
} from "@/lib/types/external-pursuit-capacity"

const freshnessCopy: Record<ExternalPursuitFreshness, string> = {
  fresh: "Confirmed in the last 30 days",
  stale: "Needs confirmation",
  never_confirmed: "Never confirmed",
}

const dueCopy: Record<ExternalPursuitDueState, string> = {
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Upcoming",
  none: "No due date",
}

function badgeVariant(value: ExternalPursuitFreshness | ExternalPursuitDueState) {
  if (value === "fresh" || value === "upcoming") return "secondary" as const
  if (value === "today" || value === "none") return "outline" as const
  return "destructive" as const
}

function formatParisDate(value: string | null) {
  if (!value) return "—"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(value))
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warning" | "danger" }) {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <p className="wave-micro-label text-muted-foreground">{label}</p>
      <p className={tone === "danger" ? "mt-1 text-2xl font-semibold text-destructive" : tone === "warning" ? "mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-300" : "mt-1 text-2xl font-semibold"}>{value}</p>
    </div>
  )
}

function CapacityRow({ dossier, confirming, onConfirm }: {
  dossier: ExternalPursuitCapacityDossier
  confirming: boolean
  onConfirm: (id: string) => void
}) {
  const needsConfirmation = dossier.freshness !== "fresh"
  return (
    <TableRow>
      <TableCell className="min-w-48 font-medium">{dossier.title}</TableCell>
      <TableCell className="hidden md:table-cell">{dossier.stage.replaceAll("_", " ")}</TableCell>
      <TableCell><Badge variant="outline" className="capitalize">{dossier.availability}</Badge></TableCell>
      <TableCell><Badge variant={badgeVariant(dossier.due_state)}>{dueCopy[dossier.due_state]}</Badge></TableCell>
      <TableCell className="hidden lg:table-cell">{formatParisDate(dossier.last_confirmed_at)}</TableCell>
      <TableCell>
        <Badge variant={badgeVariant(dossier.freshness)}>{freshnessCopy[dossier.freshness]}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant={needsConfirmation ? "default" : "outline"}
          onClick={() => onConfirm(dossier.id)}
          disabled={confirming}
          data-wave-workflow="opportunity_management"
        >
          {confirming ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />}
          Confirm current
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function ExternalPursuitCapacityWorkspace({ snapshot }: { snapshot: ExternalPursuitCapacitySnapshot }) {
  const router = useRouter()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const counts = snapshot.open_capacity

  async function confirmCurrent(pursuitId: string) {
    setConfirmingId(pursuitId)
    const result = await confirmExternalPursuitCurrent(pursuitId)
    setConfirmingId(null)
    if (!result.success) {
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6" data-wave-workflow="opportunity_management">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="External capacity summary">
        <Metric label="Open external dossiers" value={counts.total} />
        <Metric label="Need confirmation" value={counts.freshness.stale + counts.freshness.never_confirmed} tone="warning" />
        <Metric label="Overdue" value={counts.due.overdue} tone="danger" />
        <Metric label="Available" value={counts.availability.available} />
      </section>

      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>External capacity</CardTitle>
              <CardDescription>Separate from Re-New opportunities, matching, lifecycle KPIs and exports. As of {formatParisDate(snapshot.as_of_paris_date)} in Paris.</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1"><Clock3 />Fresh through 30 days</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Use <span className="font-medium text-foreground">Confirm current</span> only after checking the dossier. Editing a dossier does not refresh its availability evidence.</p>
        </CardHeader>
        <CardContent>
          {snapshot.open_dossiers.length ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Dossier</TableHead><TableHead className="hidden md:table-cell">Stage</TableHead><TableHead>Availability</TableHead><TableHead>Due</TableHead><TableHead className="hidden lg:table-cell">Last confirmed</TableHead><TableHead>Freshness</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                <TableBody>{snapshot.open_dossiers.map((dossier) => <CapacityRow key={dossier.id} dossier={dossier} confirming={confirmingId === dossier.id} onConfirm={confirmCurrent} />)}</TableBody>
              </Table>
            </div>
          ) : <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No open External Pursuits need capacity tracking.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 />Linked to a Re-New draft</CardTitle>
          <CardDescription>These dossiers have already created a canonical staff-only draft. They are shown for context and excluded from external capacity totals.</CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot.linked_dossiers.length ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Dossier</TableHead><TableHead>Re-New draft</TableHead><TableHead className="hidden sm:table-cell">Converted</TableHead></TableRow></TableHeader>
                <TableBody>{snapshot.linked_dossiers.map((dossier) => <TableRow key={dossier.id}><TableCell className="font-medium">{dossier.title}</TableCell><TableCell>{dossier.opportunity_reference}</TableCell><TableCell className="hidden sm:table-cell">{formatParisDate(dossier.converted_at)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">No External Pursuits have been linked to a Re-New draft.</p>}
        </CardContent>
      </Card>

      <p className="flex gap-2 text-sm text-muted-foreground"><TriangleAlert className="mt-0.5 size-4 shrink-0" />Completed, dropped, and deletion-requested dossiers are intentionally outside the open-capacity total.</p>
    </div>
  )
}

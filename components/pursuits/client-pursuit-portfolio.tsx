"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowUpRight, Search } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ClientPursuitPortfolioRow } from "@/lib/client-pursuit-portfolio"

function formatDate(value: string | null) {
  if (!value) return "Not recorded"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function waitingLabel(value: string, asOf: string) {
  const elapsed = Math.max(0, Date.parse(asOf) - Date.parse(value))
  const days = Math.floor(elapsed / 86_400_000)
  return days === 0 ? "today" : `${days}d waiting`
}

export function ClientPursuitPortfolio({
  rows,
  asOf,
}: {
  rows: ClientPursuitPortfolioRow[]
  asOf: string
}) {
  const [search, setSearch] = useState("")
  const [service, setService] = useState("all")
  const [exception, setException] = useState("all")
  const services = useMemo(
    () => [...new Set(rows.flatMap((row) => row.serviceScope))].sort(),
    [rows],
  )
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = !term || [
        row.repreneurName,
        row.repreneurEmail,
        ...row.serviceScope,
        ...row.pursuits.flatMap((pursuit) => [pursuit.reference, pursuit.title]),
      ].some((value) => value.toLowerCase().includes(term))
      const matchesService = service === "all" || row.serviceScope.includes(service)
      const matchesException = exception === "all"
        || (exception === "issues" ? row.exceptions.length > 0 : row.exceptions.length === 0)
      return matchesSearch && matchesService && matchesException
    })
  }, [exception, rows, search, service])

  const totalPursuits = rows.reduce((sum, row) => sum + row.openPursuitCount, 0)
  const exceptionCount = rows.filter((row) => row.exceptions.length > 0).length

  return <div className="space-y-5">
    <Alert>
      <AlertTriangle />
      <AlertTitle>Phase A uses recorded facts only</AlertTitle>
      <AlertDescription>
        Service, pursuit counts and waiting dates are derived from current records. Owner and due-date fields stay out until their operating rules have an approved source.
      </AlertDescription>
    </Alert>

    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Active clients", rows.length],
        ["Open Re-New pursuits", totalPursuits],
        ["Clients with exceptions", exceptionCount],
      ].map(([label, value]) => <Card key={label}>
        <CardContent className="pt-5">
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </CardContent>
      </Card>)}
    </div>

    <div className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(14rem,1fr)_14rem_12rem]">
      <label className="relative">
        <span className="sr-only">Search client portfolio</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients or pursuits" className="pl-9" />
      </label>
      <label>
        <span className="sr-only">Filter by service</span>
        <select value={service} onChange={(event) => setService(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All services</option>
          {services.map((name) => <option value={name} key={name}>{name}</option>)}
        </select>
      </label>
      <label>
        <span className="sr-only">Filter by exceptions</span>
        <select value={exception} onChange={(event) => setException(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All records</option>
          <option value="issues">With exceptions</option>
          <option value="clear">No exceptions</option>
        </select>
      </label>
    </div>

    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client and service</TableHead>
            <TableHead>Open pursuits</TableHead>
            <TableHead>Oldest action</TableHead>
            <TableHead>Last verified</TableHead>
            <TableHead>Exceptions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => <TableRow key={row.repreneurId}>
            <TableCell className="min-w-56 align-top whitespace-normal">
              <Link href={row.href} className="inline-flex items-center gap-1 font-semibold hover:underline">
                {row.repreneurName}<ArrowUpRight className="size-3" />
              </Link>
              {row.repreneurEmail ? <p className="mt-0.5 text-xs text-muted-foreground">{row.repreneurEmail}</p> : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {row.serviceScope.length
                  ? row.serviceScope.map((name) => <Badge variant="secondary" key={name}>{name}</Badge>)
                  : <span className="text-xs text-muted-foreground">No accepted service recorded</span>}
              </div>
            </TableCell>
            <TableCell className="min-w-64 align-top whitespace-normal">
              <div className="mb-2 flex flex-wrap gap-1">
                <Badge variant="outline">{row.proposedCount} proposed</Badge>
                <Badge variant="outline">{row.interestedCount} interested</Badge>
                <Badge variant="outline">{row.activeCount} active</Badge>
              </div>
              <ul className="space-y-1.5">
                {row.pursuits.map((pursuit) => <li key={pursuit.id}>
                  <Link href={pursuit.href} className="group inline-flex max-w-full items-center gap-1 text-xs hover:underline">
                    <span className="font-medium">{pursuit.reference}</span>
                    <span className="truncate text-muted-foreground">· {pursuit.stageLabel}</span>
                    <ArrowUpRight className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
                  </Link>
                </li>)}
                {!row.pursuits.length ? <li className="text-xs text-muted-foreground">No open pursuit record</li> : null}
              </ul>
            </TableCell>
            <TableCell className="min-w-44 align-top whitespace-normal">
              {row.oldestAction ? <>
                <p className="font-medium">{row.oldestAction.stageLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.oldestAction.waitingSince)} · {waitingLabel(row.oldestAction.waitingSince, asOf)}</p>
                <Badge className="mt-2" variant={row.oldestAction.nextActor === "Staff" ? "default" : "secondary"}>
                  Next: {row.oldestAction.nextActor}
                </Badge>
              </> : <span className="text-muted-foreground">No open action</span>}
            </TableCell>
            <TableCell className="align-top">{formatDate(row.lastVerifiedAt)}</TableCell>
            <TableCell className="min-w-44 align-top whitespace-normal">
              <div className="flex flex-wrap gap-1">
                {row.exceptions.length
                  ? row.exceptions.map((item) => <Badge variant="destructive" key={item}>{item}</Badge>)
                  : <Badge variant="outline">Clear</Badge>}
              </div>
            </TableCell>
          </TableRow>)}
          {!visibleRows.length ? <TableRow>
            <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
              No client rows match these filters.
            </TableCell>
          </TableRow> : null}
        </TableBody>
      </Table>
    </div>
    <p className="text-xs text-muted-foreground">Showing {visibleRows.length} of {rows.length} active clients. Every pursuit link opens its canonical opportunity record.</p>
  </div>
}

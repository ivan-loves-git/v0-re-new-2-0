"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, Eye, MoreHorizontal, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { archiveOpportunity } from "@/lib/actions/opportunities"
import {
  OPPORTUNITY_STATUS_OPTIONS,
  type OpportunityStatus,
  type OpportunityWithSource,
} from "@/lib/types/opportunity"
import {
  OpportunityStatusBadge,
  OpportunityVisibilityBadge,
} from "@/components/opportunities/opportunity-status-badge"

interface OpportunityTableProps {
  opportunities: OpportunityWithSource[]
}

function formatNumber(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined) return "-"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${suffix}`
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatExactDate(value: string | null | undefined) {
  const date = parseDate(value)
  if (!date) return "-"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatMonth(value: string | null | undefined) {
  const date = parseDate(value)
  if (!date) return "-"
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date)
}

function sourceContextLabel(opportunity: OpportunityWithSource) {
  const firmName =
    opportunity.source_office?.firm?.name ??
    opportunity.source?.firm_name ??
    opportunity.source_label ??
    null
  const officeName = opportunity.source_office?.name ?? null

  if (firmName && officeName && firmName !== officeName) {
    return `${firmName} · ${officeName}`
  }
  return firmName ?? officeName ?? "No source yet"
}

export function OpportunityTable({ opportunities }: OpportunityTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<OpportunityStatus | "all">("all")

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()

    return opportunities.filter((opportunity) => {
      const matchesStatus = status === "all" || opportunity.status === status
      if (!matchesStatus) return false
      if (!query) return true

      return [
        opportunity.reference,
        opportunity.sector,
        opportunity.activity,
        opportunity.location,
        opportunity.source_office?.firm?.name,
        opportunity.source_office?.name,
        opportunity.source?.firm_name,
        opportunity.source_label,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [opportunities, search, status])

  async function handleArchive(id: string) {
    await archiveOpportunity(id)
    router.refresh()
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search opportunities..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as OpportunityStatus | "all")
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All statuses</SelectItem>
                {OPPORTUNITY_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {filtered.length}
          </span>{" "}
          of {opportunities.length} opportunities
        </p>
      </div>

      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Sector / activity</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">EBITDA</TableHead>
              <TableHead className="text-right">Effectif</TableHead>
              <TableHead>Added</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="h-24 text-center text-muted-foreground"
                >
                  No opportunities found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((opportunity) => (
                <TableRow key={opportunity.id}>
                  <TableCell>
                    <Link
                      href={`/opportunities/${opportunity.id}`}
                      className="font-medium hover:underline"
                    >
                      {opportunity.reference}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {sourceContextLabel(opportunity)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[220px]">
                      <p>{opportunity.sector ?? "-"}</p>
                      {opportunity.activity && (
                        <p className="truncate text-xs text-muted-foreground">
                          {opportunity.activity}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{opportunity.location ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(opportunity.revenue_meur, "M")}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(opportunity.ebitda_keur, "K")}
                  </TableCell>
                  <TableCell className="text-right">
                    {opportunity.headcount_range ??
                      opportunity.headcount ??
                      "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{formatExactDate(opportunity.date_added)}</span>
                      <span className="text-xs text-muted-foreground">
                        Month: {formatMonth(opportunity.date_added)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <OpportunityStatusBadge status={opportunity.status} />
                  </TableCell>
                  <TableCell>
                    <OpportunityVisibilityBadge
                      visibility={opportunity.repreneur_exposure}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/opportunities/${opportunity.id}`}>
                            <Eye className="size-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleArchive(opportunity.id)}
                        >
                          <Archive className="size-4" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

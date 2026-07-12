"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarClock,
  ExternalLink,
  Mail,
  Pencil,
  Phone,
  Plus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { createMaSource, updateMaSource } from "@/lib/actions/ma-sources"
import {
  MA_SOURCE_TYPE_OPTIONS,
  type MaSourceDirectoryEntry,
  type MaSourceType,
} from "@/lib/types/opportunity"
import { CollectionFilterBar } from "@/components/wave/collection-filter-bar"
import { useCollectionFilters } from "@/hooks/use-collection-filters"
import type { CollectionFilterDefinition } from "@/lib/collection-filter-state"

interface MaSourceDirectoryProps {
  sources: MaSourceDirectoryEntry[]
}

type ContactCoverageFilter = "all" | "complete" | "missing_email" | "missing_phone"

const sourceTypeLabels = Object.fromEntries(
  MA_SOURCE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<MaSourceType, string>

const sourceTypeClasses: Record<MaSourceType, string> = {
  ma_firm: "border-transparent bg-violet-50 text-violet-700 hover:bg-violet-50",
  broker: "border-transparent bg-blue-50 text-blue-700 hover:bg-blue-50",
  direct: "border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  other: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-100",
}

const FILTER_DEFINITIONS: CollectionFilterDefinition[] = [
  { key: "sourceType", label: "Source type", options: MA_SOURCE_TYPE_OPTIONS },
  { key: "coverage", label: "Contact coverage", options: [
    { value: "complete", label: "Email and phone" },
    { value: "missing_email", label: "Missing email" },
    { value: "missing_phone", label: "Missing phone" },
  ] },
]

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function SourceTypeBadge({ sourceType }: { sourceType: MaSourceType }) {
  return <Badge className={sourceTypeClasses[sourceType]}>{sourceTypeLabels[sourceType]}</Badge>
}

export function MaSourceDirectory({ sources }: MaSourceDirectoryProps) {
  const router = useRouter()
  const filters = useCollectionFilters({ definitions: FILTER_DEFINITIONS })
  const search = filters.search
  const sourceTypeFilter = (filters.values.sourceType || "all") as MaSourceType | "all"
  const contactCoverageFilter = (filters.values.coverage || "all") as ContactCoverageFilter
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<MaSourceDirectoryEntry | null>(null)
  const [sourceType, setSourceType] = useState<MaSourceType>("ma_firm")
  const [isPending, startTransition] = useTransition()

  const filteredSources = useMemo(() => {
    const query = search.trim().toLowerCase()

    return sources.filter((source) => {
      if (sourceTypeFilter !== "all" && source.source_type !== sourceTypeFilter) return false
      if (contactCoverageFilter === "complete" && (!source.contact_email || !source.contact_phone)) return false
      if (contactCoverageFilter === "missing_email" && source.contact_email) return false
      if (contactCoverageFilter === "missing_phone" && source.contact_phone) return false
      if (!query) return true

      return [
        source.firm_name,
        sourceTypeLabels[source.source_type],
        source.contact_name,
        source.contact_email,
        source.contact_phone,
        source.internal_notes,
        source.latest_opportunity_title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [contactCoverageFilter, search, sourceTypeFilter, sources])

  const openCreateDialog = () => {
    setEditingSource(null)
    setSourceType("ma_firm")
    setDialogOpen(true)
  }

  const openEditDialog = (source: MaSourceDirectoryEntry) => {
    setEditingSource(source)
    setSourceType(source.source_type)
    setDialogOpen(true)
  }

  const handleSave = (formData: FormData) => {
    startTransition(async () => {
      const result = editingSource
        ? await updateMaSource(editingSource.id, formData)
        : await createMaSource(formData)

      if (!result.success) {
        toast.error("M&A source not saved", { description: result.message })
        return
      }

      toast.success("M&A source saved", {
        description: editingSource ? "The intermediary contact was updated." : "The intermediary contact was created.",
      })
      setDialogOpen(false)
      setEditingSource(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border bg-card">
      <CollectionFilterBar
        search={filters.search}
        onSearchChange={filters.setSearch}
        searchPlaceholder="Search sources..."
        definitions={FILTER_DEFINITIONS}
        values={filters.values}
        onFilterChange={filters.setFilter}
        onFilterRemove={filters.removeFilter}
        onClearFilters={filters.clearFilters}
        onReset={filters.reset}
        resultCount={filteredSources.length}
        totalCount={sources.length}
        resultLabel="source"
        className="rounded-none border-x-0 border-t-0"
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href="/emails">
                <ExternalLink data-icon="inline-start" />
                Email Tools
              </Link>
            </Button>
            <Button type="button" size="sm" onClick={openCreateDialog} className="h-9">
              <Plus data-icon="inline-start" />
              Add source
            </Button>
          </>
        }
      />

      <div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1080px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Source</TableHead>
                <TableHead className="w-[8%]">Type</TableHead>
                <TableHead className="w-[18%]">Contact</TableHead>
                <TableHead className="w-[11%]">Phone</TableHead>
                <TableHead className="w-[11%]">Coverage</TableHead>
                <TableHead className="w-[16%]">Latest opportunity</TableHead>
                <TableHead className="w-[12%]">Notes</TableHead>
                <TableHead className="w-[4%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No M&A sources match these filters. Remove a filter to widen the list.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <span className="block truncate font-semibold text-foreground">{source.firm_name}</span>
                    </TableCell>
                    <TableCell>
                      <SourceTypeBadge sourceType={source.source_type} />
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate">{source.contact_name ?? "-"}</span>
                        {source.contact_email ? (
                          <a
                            className="truncate text-sm text-muted-foreground hover:text-foreground"
                            href={`mailto:${source.contact_email}`}
                          >
                            {source.contact_email}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">No email</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="truncate">
                      {source.contact_phone ? (
                        <a className="text-sm hover:text-foreground" href={`tel:${source.contact_phone}`}>
                          {source.contact_phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{source.opportunity_count} total</Badge>
                        <Badge variant="outline">{source.open_opportunity_count} open</Badge>
                        {source.stale_opportunity_count > 0 ? (
                          <Badge className="border-transparent bg-amber-50 text-amber-700 hover:bg-amber-50">
                            {source.stale_opportunity_count} stale
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[220px] flex-col gap-1">
                        <span className="truncate">{source.latest_opportunity_title ?? "-"}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(source.latest_opportunity_date)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm text-muted-foreground">
                        {source.internal_notes ?? "-"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditDialog(source)}
                        aria-label={`Edit ${source.firm_name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSource ? "Edit M&A source" : "Add M&A source"}</DialogTitle>
            <DialogDescription>
              Store the intermediary contact details staff need when validating opportunity availability and next steps.
            </DialogDescription>
          </DialogHeader>

          <form key={editingSource?.id ?? "new"} action={handleSave} className="space-y-4">
            <input type="hidden" name="source_type" value={sourceType} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firm_name">Firm name</Label>
                <Input
                  id="firm_name"
                  name="firm_name"
                  required
                  defaultValue={editingSource?.firm_name ?? ""}
                  placeholder="Example: Cabinet Atlantique M&A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source_type">Source type</Label>
                <Select value={sourceType} onValueChange={(value) => setSourceType(value as MaSourceType)}>
                  <SelectTrigger id="source_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {MA_SOURCE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact name</Label>
                <Input
                  id="contact_name"
                  name="contact_name"
                  defaultValue={editingSource?.contact_name ?? ""}
                  placeholder="Example: Camille Durand"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    defaultValue={editingSource?.contact_email ?? ""}
                    placeholder="camille@cabinet-ma.fr"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="contact_phone"
                    name="contact_phone"
                    defaultValue={editingSource?.contact_phone ?? ""}
                    placeholder="+33 6 12 34 56 78"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="internal_notes">Internal notes</Label>
              <Textarea
                id="internal_notes"
                name="internal_notes"
                rows={4}
                defaultValue={editingSource?.internal_notes ?? ""}
                placeholder="Example: Good source for small regional industrial deals. Ask for teaser refresh before proposing candidates."
              />
            </div>

            {editingSource?.latest_opportunity_title ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                <CalendarClock className="size-4" />
                Latest linked opportunity: {editingSource.latest_opportunity_title}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save source"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

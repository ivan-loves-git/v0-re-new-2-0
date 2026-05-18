"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"

interface MaSourceDirectoryProps {
  sources: MaSourceDirectoryEntry[]
}

const sourceTypeLabels = Object.fromEntries(
  MA_SOURCE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<MaSourceType, string>

const sourceTypeClasses: Record<MaSourceType, string> = {
  ma_firm: "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100",
  broker: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100",
  direct: "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  other: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-100",
}

const emailWorkflowLabels = [
  "Validity check",
  "More information",
  "Repreneur feedback",
  "Process follow-up",
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon
  label: string
  value: number
  tone?: "neutral" | "purple" | "amber" | "green"
}) {
  const iconClass = {
    neutral: "bg-slate-100 text-slate-700",
    purple: "bg-purple-100 text-purple-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
  }[tone]

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("grid size-10 place-items-center rounded-lg", iconClass)}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-normal">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function MaSourceDirectory({ sources }: MaSourceDirectoryProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<MaSourceDirectoryEntry | null>(null)
  const [sourceType, setSourceType] = useState<MaSourceType>("ma_firm")
  const [isPending, startTransition] = useTransition()

  const filteredSources = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sources

    return sources.filter((source) =>
      [
        source.firm_name,
        sourceTypeLabels[source.source_type],
        source.contact_name,
        source.contact_email,
        source.contact_phone,
        source.notes,
        source.latest_opportunity_title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [search, sources])

  const stats = useMemo(
    () => ({
      totalSources: sources.length,
      sourcesWithEmail: sources.filter((source) => Boolean(source.contact_email)).length,
      openOpportunities: sources.reduce((sum, source) => sum + source.open_opportunity_count, 0),
      staleOpportunities: sources.reduce((sum, source) => sum + source.stale_opportunity_count, 0),
    }),
    [sources],
  )

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
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard icon={Building2} label="Sources" value={stats.totalSources} tone="purple" />
        <StatCard icon={Mail} label="With email" value={stats.sourcesWithEmail} tone="green" />
        <StatCard icon={Workflow} label="Open opportunities" value={stats.openOpportunities} tone="neutral" />
        <StatCard icon={AlertTriangle} label="Stale follow-ups" value={stats.staleOpportunities} tone="amber" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Intermediary directory</CardTitle>
            <CardDescription>
              Keep broker and M&A firm contacts linked to the opportunities they send us.
            </CardDescription>
          </div>
          <Button type="button" onClick={openCreateDialog}>
            <Plus data-icon="inline-start" />
            Add source
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search firm, contact, email..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredSources.length} of {sources.length} sources
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Opportunities</TableHead>
                    <TableHead>Latest</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSources.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No M&A sources match your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSources.map((source) => (
                      <TableRow key={source.id}>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <span className="font-medium text-foreground">{source.firm_name}</span>
                            <SourceTypeBadge sourceType={source.source_type} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-[240px] flex-col gap-1">
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
                        <TableCell>
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
                              <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100">
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
                          <p className="max-w-[260px] truncate text-sm text-muted-foreground">
                            {source.notes ?? "-"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Intermediary email workflows</CardTitle>
            <CardDescription>
              Review and test M&A templates before using them for broker and seller-side follow-up.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/emails">Open Email Tools</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {emailWorkflowLabels.map((label) => (
              <Badge key={label} className="border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100">
                {label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

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
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={editingSource?.notes ?? ""}
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

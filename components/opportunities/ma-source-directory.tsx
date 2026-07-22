"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, ExternalLink, Mail, Pencil, Phone, Plus, UserRound } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  createMaSource,
  createMaSourceContact,
  updateMaSource,
  updateMaSourceContact,
} from "@/lib/actions/ma-sources"
import {
  MA_SOURCE_TYPE_OPTIONS,
  type MaSourceContact,
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
  {
    key: "coverage",
    label: "Contact coverage",
    options: [
      { value: "complete", label: "Email and phone" },
      { value: "missing_email", label: "Missing email" },
      { value: "missing_phone", label: "Missing phone" },
    ],
  },
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

function hasEmail(contacts: MaSourceContact[]) {
  return contacts.some((contact) => Boolean(contact.email))
}

function hasPhone(contacts: MaSourceContact[]) {
  return contacts.some((contact) => Boolean(contact.phone))
}

function contactDisplayName(contact: MaSourceContact) {
  return contact.name || contact.email || contact.phone || "Unnamed contact"
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
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [contactSource, setContactSource] = useState<MaSourceDirectoryEntry | null>(null)
  const [editingContact, setEditingContact] = useState<MaSourceContact | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredSources = useMemo(() => {
    const query = search.trim().toLowerCase()

    return sources.filter((source) => {
      const contacts = source.contacts
      if (sourceTypeFilter !== "all" && source.source_type !== sourceTypeFilter) return false
      if (contactCoverageFilter === "complete" && (!hasEmail(contacts) || !hasPhone(contacts)))
        return false
      if (contactCoverageFilter === "missing_email" && hasEmail(contacts)) return false
      if (contactCoverageFilter === "missing_phone" && hasPhone(contacts)) return false
      if (!query) return true

      return [
        source.firm_name,
        sourceTypeLabels[source.source_type],
        source.internal_notes,
        source.latest_opportunity_title,
        ...contacts.flatMap((contact) => [contact.name, contact.email, contact.phone]),
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

  const closeSourceDialog = () => {
    if (isPending) return
    setDialogOpen(false)
    setEditingSource(null)
  }

  const openCreateContactDialog = (source: MaSourceDirectoryEntry) => {
    setContactSource(source)
    setEditingContact(null)
    setContactDialogOpen(true)
  }

  const openEditContactDialog = (source: MaSourceDirectoryEntry, contact: MaSourceContact) => {
    setContactSource(source)
    setEditingContact(contact)
    setContactDialogOpen(true)
  }

  const closeContactDialog = () => {
    if (isPending) return
    setContactDialogOpen(false)
    setContactSource(null)
    setEditingContact(null)
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
        description: editingSource
          ? "The intermediary firm was updated."
          : "The intermediary firm was created.",
      })
      setDialogOpen(false)
      setEditingSource(null)
      router.refresh()
    })
  }

  const handleContactSave = (formData: FormData) => {
    if (!contactSource) return

    startTransition(async () => {
      const result = editingContact
        ? await updateMaSourceContact(contactSource.id, editingContact.id, formData)
        : await createMaSourceContact(contactSource.id, formData)

      if (!result.success) {
        toast.error("M&A contact not saved", { description: result.message })
        return
      }

      toast.success("M&A contact saved", {
        description: editingContact
          ? "The contact was updated."
          : "The contact was added to this firm.",
      })
      closeContactDialog()
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border bg-card">
        <CollectionFilterBar
          search={filters.search}
          onSearchChange={filters.setSearch}
          searchPlaceholder="Search sources or contacts..."
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
                Add firm
              </Button>
            </>
          }
        />

        <div className="overflow-x-auto">
          <Table className="min-w-[1080px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Firm</TableHead>
                <TableHead className="w-[8%]">Type</TableHead>
                <TableHead className="w-[23%]">Contacts</TableHead>
                <TableHead className="w-[13%]">Coverage</TableHead>
                <TableHead className="w-[18%]">Latest opportunity</TableHead>
                <TableHead className="w-[14%]">Notes</TableHead>
                <TableHead className="w-[4%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No M&A firms match these filters. Remove a filter to widen the list.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <span className="block truncate font-semibold text-foreground">
                        {source.firm_name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <SourceTypeBadge sourceType={source.source_type} />
                    </TableCell>
                    <TableCell>
                      {source.contacts.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No contacts</span>
                      ) : (
                        <div className="flex min-w-0 flex-col gap-1">
                          {source.contacts.slice(0, 2).map((contact) => (
                            <div key={contact.id} className="min-w-0">
                              <span className="block truncate text-sm">
                                {contactDisplayName(contact)}
                              </span>
                              {contact.email ? (
                                <a
                                  className="block truncate text-xs text-muted-foreground hover:text-foreground"
                                  href={`mailto:${contact.email}`}
                                >
                                  {contact.email}
                                </a>
                              ) : null}
                            </div>
                          ))}
                          {source.contacts.length > 2 ? (
                            <span className="text-xs text-muted-foreground">
                              +{source.contacts.length - 2} more contacts
                            </span>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{source.contact_count} contacts</Badge>
                        <Badge variant={hasEmail(source.contacts) ? "outline" : "secondary"}>
                          {hasEmail(source.contacts) ? "Email" : "No email"}
                        </Badge>
                        <Badge variant={hasPhone(source.contacts) ? "outline" : "secondary"}>
                          {hasPhone(source.contacts) ? "Phone" : "No phone"}
                        </Badge>
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeSourceDialog())}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSource ? "Edit M&A firm" : "Add M&A firm"}</DialogTitle>
            <DialogDescription>
              Keep one firm record, then add the people staff can use on its opportunities.
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
                <Select
                  value={sourceType}
                  onValueChange={(value) => setSourceType(value as MaSourceType)}
                >
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

            {editingSource ? (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Contacts</p>
                    <p className="text-sm text-muted-foreground">
                      Only staff can view or edit these people.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openCreateContactDialog(editingSource)}
                  >
                    <Plus data-icon="inline-start" />
                    Add contact
                  </Button>
                </div>
                {editingSource.contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No contacts yet. Add the first person for this firm.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border bg-background">
                    {editingSource.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {contactDisplayName(contact)}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {contact.email ? <span>{contact.email}</span> : null}
                            {contact.phone ? <span>{contact.phone}</span> : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditContactDialog(editingSource, contact)}
                          aria-label={`Edit ${contactDisplayName(contact)}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div>
                  <p className="text-sm font-medium">First contact (optional)</p>
                  <p className="text-sm text-muted-foreground">
                    Create the firm first, then add more contacts as needed.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="source_initial_contact_name">Contact name</Label>
                    <Input
                      id="source_initial_contact_name"
                      name="contact_name"
                      placeholder="Example: Camille Durand"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source_initial_contact_email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="source_initial_contact_email"
                        name="contact_email"
                        type="email"
                        placeholder="camille@cabinet-ma.fr"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source_initial_contact_phone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="source_initial_contact_phone"
                        name="contact_phone"
                        placeholder="+33 6 12 34 56 78"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

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
              <Button
                type="button"
                variant="outline"
                onClick={closeSourceDialog}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save firm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={contactDialogOpen}
        onOpenChange={(open) => (open ? setContactDialogOpen(true) : closeContactDialog())}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit M&A contact" : "Add M&A contact"}</DialogTitle>
            <DialogDescription>
              {contactSource
                ? `This person belongs to ${contactSource.firm_name}.`
                : "Store staff-only contact details."}
            </DialogDescription>
          </DialogHeader>

          <form key={editingContact?.id ?? "new"} action={handleContactSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ma_contact_name">Contact name</Label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ma_contact_name"
                  name="contact_name"
                  defaultValue={editingContact?.name ?? ""}
                  placeholder="Example: Camille Durand"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma_contact_email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ma_contact_email"
                  name="contact_email"
                  type="email"
                  defaultValue={editingContact?.email ?? ""}
                  placeholder="camille@cabinet-ma.fr"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma_contact_phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ma_contact_phone"
                  name="contact_phone"
                  defaultValue={editingContact?.phone ?? ""}
                  placeholder="+33 6 12 34 56 78"
                  className="pl-9"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Add at least one of name, email, or phone.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeContactDialog}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

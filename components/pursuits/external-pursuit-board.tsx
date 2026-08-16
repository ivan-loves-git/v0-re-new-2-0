"use client"

import { useRef, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { ExternalLink, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  createExternalPursuit,
  fulfillExternalPursuitDeletion,
  moveExternalPursuitStage,
  requestExternalPursuitDeletion,
  saveExternalPursuitContact,
  updateExternalPursuit,
} from "@/lib/actions/external-pursuits"
import type { ReNewPursuitBoardRecord } from "@/lib/actions/external-pursuit-board"
import type {
  ExternalPursuitContactDraft,
} from "@/lib/utils/external-pursuit-client"
import {
  contactIdempotencyKey,
  hasContactValue,
  isCompleteContact,
  retryKeyFor,
} from "@/lib/utils/external-pursuit-client"
import {
  EXTERNAL_PURSUIT_AVAILABILITY,
  EXTERNAL_PURSUIT_STAGES,
  type ExternalPursuitAvailability,
  type ExternalPursuitBoardRecord,
  type ExternalPursuitContactInput,
  type ExternalPursuitInput,
  type ExternalPursuitStage,
} from "@/lib/types/external-pursuit"

const STAGE_LABELS: Record<ExternalPursuitStage, string> = {
  identified: "Identified",
  contact_qualification: "Contact / qualification",
  information: "Information",
  meetings: "Meetings",
  negotiation: "Negotiation",
  loi: "LOI",
  due_diligence_financing: "DD / financing",
  completed: "Completed",
  dropped_archived: "Dropped / archived",
}

type Draft = Required<Pick<ExternalPursuitInput, "title">> & Omit<ExternalPursuitInput, "title">
type Confirmation = { kind: "request" | "fulfill"; record: ExternalPursuitBoardRecord }

const blankDraft = (): Draft => ({
  title: "",
  stage: "identified",
  availability: "unknown",
  externalUrl: null,
  targetCompany: null,
  sourceChannel: null,
  revenueMeur: null,
  ebitdaKeur: null,
  headcount: null,
})

function newContactDraft(contact?: ExternalPursuitContactInput): ExternalPursuitContactDraft {
  return {
    ...contact,
    name: contact?.name ?? null,
    organisation: contact?.organisation ?? null,
    roleTitle: contact?.roleTitle ?? null,
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
    clientId: contact?.id ? `persisted:${contact.id}` : crypto.randomUUID(),
  }
}

function inputNumber(value: string) {
  return value === "" ? null : Number(value)
}

function externalDetailParts(record: ExternalPursuitBoardRecord) {
  return [
    record.targetCompany ? `Target: ${record.targetCompany}` : null,
    record.sourceChannel ? `Source channel: ${record.sourceChannel}` : null,
    record.revenueMeur === null ? null : `Revenue: ${record.revenueMeur} M€`,
    record.ebitdaKeur === null ? null : `EBITDA: ${record.ebitdaKeur} K€`,
    record.headcount === null ? null : `Headcount: ${record.headcount}`,
  ].filter((detail): detail is string => Boolean(detail))
}

export function ExternalPursuitBoard({
  external,
  renew,
  isStaff,
  owners = [],
}: {
  external: ExternalPursuitBoardRecord[]
  renew: ReNewPursuitBoardRecord[]
  isStaff: boolean
  owners?: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ExternalPursuitBoardRecord | null>(null)
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [contacts, setContacts] = useState<ExternalPursuitContactDraft[]>([])
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({})
  const [ownerId, setOwnerId] = useState("")
  const [advanced, setAdvanced] = useState(false)
  const [query, setQuery] = useState("")
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [pending, startTransition] = useTransition()
  const submissionKey = useRef<string | null>(null)
  const operationKeys = useRef(new Map<string, string>())

  function openCreate() {
    setEditing(null)
    setDraft(blankDraft())
    setContacts([])
    setContactErrors({})
    setOwnerId("")
    setAdvanced(false)
    submissionKey.current = null
    setOpen(true)
  }

  function openEdit(record: ExternalPursuitBoardRecord) {
    setEditing(record)
    setDraft({
      title: record.title,
      stage: record.stage,
      availability: record.availability,
      externalUrl: record.externalUrl,
      targetCompany: record.targetCompany,
      sourceChannel: record.sourceChannel,
      revenueMeur: record.revenueMeur,
      ebitdaKeur: record.ebitdaKeur,
      headcount: record.headcount,
    })
    setContacts(record.contacts.map((contact) => newContactDraft(contact)))
    setContactErrors({})
    setOwnerId(record.ownerRepreneurId)
    setAdvanced(Boolean(
      record.externalUrl
      || record.targetCompany
      || record.sourceChannel
      || record.revenueMeur !== null
      || record.ebitdaKeur !== null
      || record.headcount !== null,
    ))
    submissionKey.current = null
    setOpen(true)
  }

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function patchContact(clientId: string, key: keyof ExternalPursuitContactInput, value: string) {
    setContacts((current) => current.map((contact) => (
      contact.clientId === clientId ? { ...contact, [key]: value || null } : contact
    )))
    setContactErrors((current) => {
      if (!current[clientId]) return current
      const next = { ...current }
      delete next[clientId]
      return next
    })
  }

  function submit() {
    if (!draft.title.trim()) {
      toast.error("Add a title before saving.")
      return
    }
    if (isStaff && !editing && !ownerId) {
      toast.error("Choose the dossier owner.")
      return
    }

    const invalidContacts = contacts.filter((contact) => !isCompleteContact(contact))
    if (invalidContacts.length > 0) {
      setContactErrors(Object.fromEntries(invalidContacts.map((contact) => [
        contact.clientId,
        "Add a name or organisation, or clear this contact row.",
      ])))
      toast.error("Complete the highlighted contact rows before saving.")
      return
    }

    const idempotencyKey = submissionKey.current ?? crypto.randomUUID()
    submissionKey.current = idempotencyKey
    startTransition(async () => {
      try {
        const result = editing
          ? await updateExternalPursuit(editing.id, { ...draft, stage: undefined }, idempotencyKey)
          : await createExternalPursuit(
            { ...draft, ...(isStaff ? { ownerRepreneurId: ownerId } : {}) },
            idempotencyKey,
          )
        if (!result.success || !result.pursuitId) {
          toast.error(result.message)
          return
        }

        for (const contact of contacts.filter(hasContactValue)) {
          const contactResult = await saveExternalPursuitContact(
            result.pursuitId,
            contact,
            contactIdempotencyKey(idempotencyKey, contact.clientId),
          )
          if (!contactResult.success) {
            toast.error(contactResult.message)
            return
          }
        }

        toast.success(result.message)
        submissionKey.current = null
        setOpen(false)
        window.location.reload()
      } catch {
        toast.error("The save could not be confirmed. Retry to recover the same operation safely.")
      }
    })
  }

  function move(record: ExternalPursuitBoardRecord, stage: ExternalPursuitStage) {
    const idempotencyKey = retryKeyFor(
      operationKeys.current,
      `stage:${record.id}:${stage}`,
      () => crypto.randomUUID(),
    )
    startTransition(async () => {
      try {
        const result = await moveExternalPursuitStage(record.id, stage, idempotencyKey)
        if (!result.success) {
          toast.error(result.message)
          return
        }
        toast.success("Stage updated.")
        window.location.reload()
      } catch {
        toast.error("The stage move could not be confirmed. Retry to recover the same operation safely.")
      }
    })
  }

  function confirmDeletion() {
    if (!confirmation) return
    const { kind, record } = confirmation
    const operation = kind === "request" ? `delete-request:${record.id}` : `delete-fulfill:${record.id}`
    const idempotencyKey = retryKeyFor(operationKeys.current, operation, () => crypto.randomUUID())
    setConfirmation(null)
    startTransition(async () => {
      try {
        const result = kind === "request"
          ? await requestExternalPursuitDeletion(record.id, idempotencyKey)
          : await fulfillExternalPursuitDeletion(record.id, idempotencyKey)
        if (!result.success) {
          toast.error(result.message)
          return
        }
        toast.success(result.message)
        window.location.reload()
      } catch {
        toast.error("The deletion action could not be confirmed. Retry to recover the same operation safely.")
      }
    })
  }

  return (
    <div className="space-y-5">
      <Alert>
        <AlertTitle>External pursuits are separate from Re-New deal flow</AlertTitle>
        <AlertDescription>
          External pursuits are visible to their owner and authorised Re-New staff, who can see all external dossier detail by default. They never enter matching, source records, confidentiality gates, exports or Re-New KPIs.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Re-New cards are a read-only view of the canonical journey. External cards remain independent dossiers.
        </p>
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          <Plus data-icon="inline-start" />
          New external pursuit
        </Button>
      </div>

      <Input
        aria-label="Search pursuits"
        className="max-w-md"
        placeholder="Search pursuits"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <section aria-label="Pursuit board" className="grid gap-4 lg:flex lg:overflow-x-auto lg:pb-2">
        {EXTERNAL_PURSUIT_STAGES.map((stage) => {
          const needle = query.trim().toLocaleLowerCase()
          const cards = [
            ...external.filter((record) => record.stage === stage && (!needle || record.title.toLocaleLowerCase().includes(needle))),
            ...renew.filter((record) => record.stage === stage && (!needle || record.title.toLocaleLowerCase().includes(needle))),
          ]
          return (
            <Card key={stage} className="min-w-0 shadow-none lg:w-80 lg:flex-none">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle className="text-sm">{STAGE_LABELS[stage]}</CardTitle>
                <CardDescription>{cards.length} item{cards.length === 1 ? "" : "s"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-3">
                {cards.length > 0 ? cards.map((record) => (
                  "canonicalStage" in record
                    ? <ReNewCard key={`renew-${record.id}`} record={record} />
                    : (
                      <ExternalCard
                        key={record.id}
                        record={record}
                        isStaff={isStaff}
                        pending={pending}
                        onEdit={openEdit}
                        onMove={move}
                        onDelete={(selected) => setConfirmation({ kind: "request", record: selected })}
                        onFulfill={(selected) => setConfirmation({ kind: "fulfill", record: selected })}
                      />
                    )
                )) : <p className="py-3 text-center text-sm text-muted-foreground">No pursuits</p>}
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit external pursuit" : "New external pursuit"}</DialogTitle>
            <DialogDescription>
              {editing ? "Only this standalone dossier changes." : "Start with a title; add external context only when it is useful."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {isStaff && !editing ? (
              <Field id="external-pursuit-owner" label="Owner">
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger id="external-pursuit-owner" aria-label="Owner">
                    <SelectValue placeholder="Choose owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <Field id="external-pursuit-title" label="Title">
              <Input
                id="external-pursuit-title"
                autoFocus
                value={draft.title}
                onChange={(event) => patch("title", event.target.value)}
              />
            </Field>
            <Field id="external-pursuit-availability" label="Availability">
              <AvailabilitySelect
                id="external-pursuit-availability"
                ariaLabel="Availability"
                value={draft.availability ?? "unknown"}
                onValueChange={(value) => patch("availability", value)}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              aria-controls="external-pursuit-optional-context"
              aria-expanded={advanced}
              onClick={() => setAdvanced((value) => !value)}
            >
              {advanced ? "Hide optional context" : "Add optional context"}
            </Button>
            {advanced ? (
              <div id="external-pursuit-optional-context" className="grid gap-4 sm:grid-cols-2">
                <Field id="external-pursuit-url" label="External URL">
                  <Input id="external-pursuit-url" type="url" value={draft.externalUrl ?? ""} onChange={(event) => patch("externalUrl", event.target.value || null)} />
                </Field>
                <Field id="external-pursuit-company" label="Target company">
                  <Input id="external-pursuit-company" value={draft.targetCompany ?? ""} onChange={(event) => patch("targetCompany", event.target.value || null)} />
                </Field>
                <Field id="external-pursuit-source-channel" label="Descriptive source channel">
                  <Input id="external-pursuit-source-channel" value={draft.sourceChannel ?? ""} onChange={(event) => patch("sourceChannel", event.target.value || null)} />
                </Field>
                <Field id="external-pursuit-revenue" label="Revenue (M€)">
                  <Input id="external-pursuit-revenue" type="number" min="0" step="0.1" value={draft.revenueMeur ?? ""} onChange={(event) => patch("revenueMeur", inputNumber(event.target.value))} />
                </Field>
                <Field id="external-pursuit-ebitda" label="EBITDA (K€)">
                  <Input id="external-pursuit-ebitda" type="number" min="0" step="1" value={draft.ebitdaKeur ?? ""} onChange={(event) => patch("ebitdaKeur", inputNumber(event.target.value))} />
                </Field>
                <Field id="external-pursuit-headcount" label="Headcount">
                  <Input id="external-pursuit-headcount" type="number" min="0" step="1" value={draft.headcount ?? ""} onChange={(event) => patch("headcount", inputNumber(event.target.value))} />
                </Field>
              </div>
            ) : null}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Contacts</p>
                <p className="text-xs text-muted-foreground">Repeatable external contacts. They never create Re-New contact records.</p>
              </div>
              {contacts.map((contact, index) => {
                const errorId = `external-contact-error-${contact.clientId}`
                const error = contactErrors[contact.clientId]
                const describedBy = error ? errorId : undefined
                return (
                  <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2" key={contact.clientId}>
                    <Input aria-label={`Contact ${index + 1} name`} aria-invalid={Boolean(error)} aria-describedby={describedBy} placeholder="Name" value={contact.name ?? ""} onChange={(event) => patchContact(contact.clientId, "name", event.target.value)} />
                    <Input aria-label={`Contact ${index + 1} organisation`} aria-invalid={Boolean(error)} aria-describedby={describedBy} placeholder="Organisation" value={contact.organisation ?? ""} onChange={(event) => patchContact(contact.clientId, "organisation", event.target.value)} />
                    <Input aria-label={`Contact ${index + 1} role`} placeholder="Role" value={contact.roleTitle ?? ""} onChange={(event) => patchContact(contact.clientId, "roleTitle", event.target.value)} />
                    <Input aria-label={`Contact ${index + 1} email`} type="email" placeholder="Email" value={contact.email ?? ""} onChange={(event) => patchContact(contact.clientId, "email", event.target.value)} />
                    <Input aria-label={`Contact ${index + 1} phone`} type="tel" placeholder="Phone" value={contact.phone ?? ""} onChange={(event) => patchContact(contact.clientId, "phone", event.target.value)} />
                    {error ? <p id={errorId} role="alert" className="text-xs text-destructive sm:col-span-2">{error}</p> : null}
                  </div>
                )
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => setContacts((current) => [...current, newContactDraft()])}>
                <Plus data-icon="inline-start" />
                Add contact
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={submit}>{pending ? "Saving…" : editing ? "Save changes" : "Create pursuit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmation)} onOpenChange={(nextOpen) => { if (!nextOpen) setConfirmation(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "fulfill" ? `Permanently delete “${confirmation.record.title}”?` : `Request deletion of “${confirmation?.record.title}”?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.kind === "fulfill"
                ? "This staff action irreversibly purges the dossier, contacts and ordinary audit after your review. Only the minimal deletion tombstone remains."
                : "The dossier will immediately disappear from your board and remain visible to authorised Re-New staff until they review and fulfil the request."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={confirmDeletion}
            >
              {confirmation?.kind === "fulfill" ? "Permanently delete" : "Request deletion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label>{children}</div>
}

function StageSelect({
  id,
  ariaLabel,
  value,
  onValueChange,
}: {
  id: string
  ariaLabel: string
  value: ExternalPursuitStage
  onValueChange: (value: ExternalPursuitStage) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} aria-label={ariaLabel}><SelectValue /></SelectTrigger>
      <SelectContent>
        {EXTERNAL_PURSUIT_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{STAGE_LABELS[stage]}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function AvailabilitySelect({
  id,
  ariaLabel,
  value,
  onValueChange,
}: {
  id: string
  ariaLabel: string
  value: ExternalPursuitAvailability
  onValueChange: (value: ExternalPursuitAvailability) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} aria-label={ariaLabel}><SelectValue /></SelectTrigger>
      <SelectContent>
        {EXTERNAL_PURSUIT_AVAILABILITY.map((availability) => (
          <SelectItem key={availability} value={availability}>
            {availability[0].toUpperCase() + availability.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ReNewCard({ record }: { record: ReNewPursuitBoardRecord }) {
  return (
    <article className="space-y-2 rounded-md border bg-muted/25 p-3">
      <Badge variant="outline">Re-New · read-only</Badge>
      <h3 className="font-medium leading-snug">{record.title}</h3>
      <p className="text-xs text-muted-foreground">Canonical journey: {record.canonicalJourney.replaceAll("_", " ")}</p>
      <Button asChild variant="link" size="sm" className="h-auto p-0">
        <Link href={record.href}>Open canonical journey <ExternalLink data-icon="inline-end" /></Link>
      </Button>
    </article>
  )
}

function PendingContacts({ contacts }: { contacts: ExternalPursuitContactInput[] }) {
  if (contacts.length === 0) return <p className="text-xs text-muted-foreground">Contacts not added</p>
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium">Contacts</p>
      <ul className="space-y-1 text-muted-foreground">
        {contacts.map((contact) => (
          <li key={contact.id}>
            {[contact.name, contact.organisation, contact.roleTitle, contact.email, contact.phone].filter(Boolean).join(" · ")}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExternalCard({
  record,
  isStaff,
  pending,
  onEdit,
  onMove,
  onDelete,
  onFulfill,
}: {
  record: ExternalPursuitBoardRecord
  isStaff: boolean
  pending: boolean
  onEdit: (record: ExternalPursuitBoardRecord) => void
  onMove: (record: ExternalPursuitBoardRecord, stage: ExternalPursuitStage) => void
  onDelete: (record: ExternalPursuitBoardRecord) => void
  onFulfill: (record: ExternalPursuitBoardRecord) => void
}) {
  const deleteRequested = record.deletionStatus === "delete_requested"
  const details = externalDetailParts(record)
  const hasOptionalDetails = details.length > 0 || Boolean(record.externalUrl)
  const stageId = `external-pursuit-stage-${record.id}`

  return (
    <article className="space-y-3 rounded-md border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary">External</Badge>
        {isStaff && record.ownerName ? <span className="text-xs text-muted-foreground">{record.ownerName}</span> : null}
      </div>
      <h3 className="font-medium leading-snug">{record.title}</h3>
      <p className="text-xs text-muted-foreground">Availability: {record.availability}</p>
      {hasOptionalDetails ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          {details.length > 0 ? <p>{details.join(" · ")}</p> : null}
          {record.externalUrl ? (
            <a className="inline-flex items-center gap-1 underline" href={record.externalUrl} rel="noreferrer" target="_blank">
              Open external link <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      ) : <p className="text-xs text-muted-foreground">Optional details not added</p>}
      <p className="text-xs text-muted-foreground">
        {record.contacts.length === 0 ? "Contacts not added" : `${record.contacts.length} contact${record.contacts.length === 1 ? "" : "s"}`}
      </p>

      {deleteRequested ? (
        <>
          <p className="text-sm text-warning">Deletion requested. Staff can review the dossier and fulfil the purge.</p>
          {isStaff ? <PendingContacts contacts={record.contacts} /> : null}
        </>
      ) : (
        <>
          <div className="grid gap-1">
            <Label htmlFor={stageId} className="text-xs text-muted-foreground">Move stage</Label>
            <StageSelect
              id={stageId}
              ariaLabel={`Move ${record.title} stage`}
              value={record.stage}
              onValueChange={(stage) => onMove(record, stage)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => onEdit(record)}>Edit</Button>
            {!isStaff ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => onDelete(record)}>
                <Trash2 data-icon="inline-start" />
                Request deletion
              </Button>
            ) : null}
          </div>
        </>
      )}

      {isStaff && deleteRequested ? (
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => onFulfill(record)}>
          <Trash2 data-icon="inline-start" />
          Review and permanently delete
        </Button>
      ) : null}
    </article>
  )
}

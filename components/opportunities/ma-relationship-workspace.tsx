"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Mail,
  MessageSquareMore,
  PhoneCall,
  Plus,
  UsersRound,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createMaRelationshipInteraction,
  verifyMaRelationshipInteractionOwner,
  type CreateMaRelationshipInteractionInput,
  type MaInteractionChannel,
  type MaRelationshipTimelineItem,
  type MaRelationshipWorkspace,
} from "@/lib/actions/ma-relationships"

const CHANNELS: Array<{ value: MaInteractionChannel; label: string }> = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "document", label: "Document" },
  { value: "other", label: "Other" },
]

const channelIcons = {
  call: PhoneCall,
  email: Mail,
  meeting: UsersRound,
  document: FileText,
  other: MessageSquareMore,
} satisfies Record<MaInteractionChannel, typeof PhoneCall>

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown date"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function dateTimeInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function timelineTitle(interaction: MaRelationshipTimelineItem) {
  if (interaction.title) return interaction.title
  const channel = CHANNELS.find(
    (candidate) => candidate.value === interaction.channel,
  )?.label
  return `${channel ?? "Relationship"} activity`
}

interface MaRelationshipWorkspaceProps {
  workspace: MaRelationshipWorkspace
}

export function MaRelationshipWorkspace({
  workspace,
}: MaRelationshipWorkspaceProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [officeFilter, setOfficeFilter] = useState("all")
  const [contactFilter, setContactFilter] = useState("all")
  const [opportunityFilter, setOpportunityFilter] = useState("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [officeId, setOfficeId] = useState(workspace.offices[0]?.id ?? "")
  const [affiliationId, setAffiliationId] = useState("none")
  const [opportunityId, setOpportunityId] = useState("none")
  const [channel, setChannel] = useState<MaInteractionChannel>("call")
  const [direction, setDirection] = useState("outbound")
  const [occurredAt, setOccurredAt] = useState(dateTimeInputValue())
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [outcome, setOutcome] = useState("")
  const [nextAction, setNextAction] = useState("")
  const [nextActionDueAt, setNextActionDueAt] = useState("")
  const [recipientEmailSnapshot, setRecipientEmailSnapshot] = useState("")

  const selectedOffice =
    workspace.offices.find((office) => office.id === officeId) ?? null
  const officeOpportunities = useMemo(
    () =>
      workspace.opportunities.filter(
        (opportunity) => opportunity.officeId === officeId,
      ),
    [officeId, workspace.opportunities],
  )
  const filteredInteractions = useMemo(
    () =>
      workspace.interactions.filter((interaction) => {
        if (officeFilter !== "all" && interaction.officeId !== officeFilter)
          return false
        if (
          contactFilter !== "all" &&
          interaction.affiliationId !== contactFilter
        )
          return false
        if (
          opportunityFilter !== "all" &&
          interaction.opportunityId !== opportunityFilter
        )
          return false
        return true
      }),
    [contactFilter, officeFilter, opportunityFilter, workspace.interactions],
  )

  const resetDraft = () => {
    setOfficeId(workspace.offices[0]?.id ?? "")
    setAffiliationId("none")
    setOpportunityId("none")
    setChannel("call")
    setDirection("outbound")
    setOccurredAt(dateTimeInputValue())
    setTitle("")
    setSummary("")
    setOutcome("")
    setNextAction("")
    setNextActionDueAt("")
    setRecipientEmailSnapshot("")
  }

  const selectOffice = (nextOfficeId: string) => {
    setOfficeId(nextOfficeId)
    setAffiliationId("none")
    setOpportunityId("none")
  }

  const selectChannel = (nextChannel: MaInteractionChannel) => {
    setChannel(nextChannel)
    if (nextChannel !== "email") setRecipientEmailSnapshot("")
  }

  const selectDirection = (nextDirection: string) => {
    setDirection(nextDirection)
    if (nextDirection !== "outbound") setRecipientEmailSnapshot("")
  }

  const saveInteraction = () => {
    const input: CreateMaRelationshipInteractionInput = {
      officeId,
      affiliationId: affiliationId === "none" ? null : affiliationId,
      opportunityId: opportunityId === "none" ? null : opportunityId,
      channel,
      direction:
        channel === "call" || channel === "email"
          ? (direction as "inbound" | "outbound")
          : null,
      occurredAt,
      title,
      summary,
      outcome,
      nextAction,
      nextActionDueAt: nextActionDueAt || null,
      recipientEmailSnapshot:
        channel === "email" && direction === "outbound"
          ? recipientEmailSnapshot
          : null,
    }
    startTransition(async () => {
      const result = await createMaRelationshipInteraction(input)
      if (!result.success) {
        toast.error("Activity not recorded", { description: result.message })
        return
      }
      toast.success("Relationship activity recorded")
      setDialogOpen(false)
      resetDraft()
      router.refresh()
    })
  }

  const verifyOwner = (interactionId: string) => {
    startTransition(async () => {
      const result = await verifyMaRelationshipInteractionOwner(interactionId)
      if (!result.success) {
        toast.error("Owner not verified", { description: result.message })
        return
      }
      toast.success("Owner verification recorded")
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="wave-micro-label">Staff workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Relationships
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One chronological M&A relationship record, before or alongside an
            opportunity.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          disabled={!workspace.offices.length}
        >
          <Plus data-icon="inline-start" />
          Record activity
        </Button>
      </div>

      <Alert>
        <AlertTitle>Internal relationship history</AlertTitle>
        <AlertDescription>
          This workspace records staff evidence only. Recording an email here
          never sends one; attachments and general editing remain out of scope.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Timeline filters</CardTitle>
          <CardDescription>
            Filter the same canonical timeline by office, contact or
            opportunity.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="relationship-office-filter">Office</Label>
            <Select
              value={officeFilter}
              onValueChange={(value) => {
                setOfficeFilter(value)
                setContactFilter("all")
                setOpportunityFilter("all")
              }}
            >
              <SelectTrigger id="relationship-office-filter">
                <SelectValue placeholder="All offices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {workspace.offices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship-contact-filter">Contact</Label>
            <Select value={contactFilter} onValueChange={setContactFilter}>
              <SelectTrigger id="relationship-contact-filter">
                <SelectValue placeholder="All contacts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All contacts</SelectItem>
                {workspace.offices
                  .filter(
                    (office) =>
                      officeFilter === "all" || office.id === officeFilter,
                  )
                  .flatMap((office) =>
                    office.contacts.map((contact) => ({
                      ...contact,
                      officeLabel: office.label,
                    })),
                  )
                  .map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.label} · {contact.officeLabel}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship-opportunity-filter">Opportunity</Label>
            <Select
              value={opportunityFilter}
              onValueChange={setOpportunityFilter}
            >
              <SelectTrigger id="relationship-opportunity-filter">
                <SelectValue placeholder="All opportunities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All opportunities</SelectItem>
                {workspace.opportunities
                  .filter(
                    (opportunity) =>
                      officeFilter === "all" ||
                      opportunity.officeId === officeFilter,
                  )
                  .map((opportunity) => (
                    <SelectItem key={opportunity.id} value={opportunity.id}>
                      {opportunity.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relationship timeline</CardTitle>
          <CardDescription>
            {filteredInteractions.length} canonical interaction
            {filteredInteractions.length === 1 ? "" : "s"}, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInteractions.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No relationship activity matches these filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInteractions.map((interaction) => {
                const Icon = channelIcons[interaction.channel]
                const mayVerify =
                  interaction.ownerVerificationState === "provisional" &&
                  interaction.ownerStaffUserId === workspace.currentUserId
                return (
                  <article
                    key={interaction.id}
                    className="rounded-md border p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Icon className="size-4 text-muted-foreground" />
                          <h2 className="font-medium">
                            {timelineTitle(interaction)}
                          </h2>
                          <Badge variant="outline">{interaction.channel}</Badge>
                          {interaction.direction ? (
                            <Badge variant="secondary">
                              {interaction.direction}
                            </Badge>
                          ) : null}
                          {interaction.deliveryStatus ? (
                            <Badge
                              variant={
                                interaction.deliveryStatus === "failed"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {interaction.deliveryStatus}
                            </Badge>
                          ) : null}
                          {interaction.ownerVerificationState ===
                          "provisional" ? (
                            <Badge variant="outline">Owner to verify</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {interaction.summary || "No summary recorded."}
                        </p>
                      </div>
                      <time className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="size-3.5" />
                        {formatDate(interaction.occurredAt)}
                      </time>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span>{interaction.officeLabel}</span>
                      {interaction.contactLabel ? (
                        <span>
                          {interaction.contactLabel}
                          {interaction.contactEmail
                            ? ` · ${interaction.contactEmail}`
                            : ""}
                        </span>
                      ) : null}
                      {interaction.opportunityId &&
                      interaction.opportunityLabel ? (
                        <Link
                          className="text-primary underline-offset-4 hover:underline"
                          href={`/opportunities/${interaction.opportunityId}`}
                        >
                          {interaction.opportunityLabel}
                        </Link>
                      ) : null}
                      {interaction.recipientEmail ? (
                        <span>To: {interaction.recipientEmail}</span>
                      ) : null}
                    </div>
                    {interaction.outcome ||
                    interaction.nextAction ||
                    interaction.deliveryError ? (
                      <div className="mt-3 grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
                        {interaction.outcome ? (
                          <p>
                            <span className="font-medium">Outcome: </span>
                            {interaction.outcome}
                          </p>
                        ) : null}
                        {interaction.nextAction ? (
                          <p>
                            <span className="font-medium">Next: </span>
                            {interaction.nextAction}
                            {interaction.nextActionDueAt
                              ? ` · ${formatDate(interaction.nextActionDueAt)}`
                              : ""}
                          </p>
                        ) : null}
                        {interaction.deliveryError ? (
                          <p className="text-destructive">
                            <span className="font-medium">Delivery: </span>
                            {interaction.deliveryError}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {interaction.ownerVerificationState === "provisional" ? (
                      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                        <p className="text-xs text-muted-foreground">
                          The assigned owner must personally confirm this
                          migrated record.
                        </p>
                        {mayVerify ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() => verifyOwner(interaction.id)}
                          >
                            <CheckCircle2 data-icon="inline-start" />
                            Verify mine
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetDraft()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record relationship activity</DialogTitle>
            <DialogDescription>
              Capture staff evidence. This does not send an email or upload an
              attachment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="relationship-office">Office *</Label>
              <Select value={officeId} onValueChange={selectOffice}>
                <SelectTrigger id="relationship-office">
                  <SelectValue placeholder="Choose office" />
                </SelectTrigger>
                <SelectContent>
                  {workspace.offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-contact">Contact</Label>
              <Select value={affiliationId} onValueChange={setAffiliationId}>
                <SelectTrigger id="relationship-contact">
                  <SelectValue placeholder="No contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific contact</SelectItem>
                  {selectedOffice?.contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.label}
                      {contact.email ? ` · ${contact.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-opportunity">Opportunity</Label>
              <Select value={opportunityId} onValueChange={setOpportunityId}>
                <SelectTrigger id="relationship-opportunity">
                  <SelectValue placeholder="No opportunity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific opportunity</SelectItem>
                  {officeOpportunities.map((opportunity) => (
                    <SelectItem key={opportunity.id} value={opportunity.id}>
                      {opportunity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-channel">Activity *</Label>
              <Select
                value={channel}
                onValueChange={(value) =>
                  selectChannel(value as MaInteractionChannel)
                }
              >
                <SelectTrigger id="relationship-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {channel === "email" && direction === "outbound" ? (
              <div className="space-y-2">
                <Label htmlFor="relationship-recipient">
                  Recipient email *
                </Label>
                <Input
                  id="relationship-recipient"
                  type="email"
                  value={recipientEmailSnapshot}
                  onChange={(event) =>
                    setRecipientEmailSnapshot(event.target.value)
                  }
                  placeholder="name@firm.com"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="relationship-direction">
                Direction {channel === "call" || channel === "email" ? "*" : ""}
              </Label>
              <Select
                value={
                  channel === "call" || channel === "email" ? direction : "none"
                }
                onValueChange={selectDirection}
                disabled={channel !== "call" && channel !== "email"}
              >
                <SelectTrigger id="relationship-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-occurred">When *</Label>
              <Input
                id="relationship-occurred"
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-title">Title</Label>
              <Input
                id="relationship-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Optional short label"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="relationship-summary">Summary *</Label>
              <Textarea
                id="relationship-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="What happened and what evidence should the team retain?"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-outcome">Outcome</Label>
              <Textarea
                id="relationship-outcome"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-next">Next action</Label>
              <Textarea
                id="relationship-next"
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship-next-due">Next action due</Label>
              <Input
                id="relationship-next-due"
                type="datetime-local"
                value={nextActionDueAt}
                onChange={(event) => setNextActionDueAt(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={saveInteraction}
              disabled={
                isPending ||
                !officeId ||
                !summary.trim() ||
                !occurredAt ||
                (channel === "email" &&
                  direction === "outbound" &&
                  !recipientEmailSnapshot.trim())
              }
            >
              {isPending ? "Recording..." : "Record activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

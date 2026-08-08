"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarClock,
  ChevronDown,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createMaRelationshipInteraction,
  verifyMaRelationshipInteractionOwner,
  type CreateMaRelationshipInteractionInput,
  type MaInteractionChannel,
  type MaRelationshipTimelineItem,
  type MaRelationshipWorkspace,
} from "@/lib/actions/ma-relationships"
import { setMaContactCampaignEmailSuppression } from "@/lib/actions/ma-contact-email-policy"
import { filterMaRelationshipTimeline } from "@/lib/ma-relationship-filters"
import { hasConfirmedProviderDelivery } from "@/lib/ma-relationship-activity-provenance"

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

type MaRelationshipView = "timeline" | "firms" | "contacts"

interface MaRelationshipWorkspaceProps {
  workspace: MaRelationshipWorkspace
  initialView?: MaRelationshipView
}

export function MaRelationshipWorkspace({
  workspace,
  initialView = "timeline",
}: MaRelationshipWorkspaceProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeView, setActiveView] = useState<MaRelationshipView>(initialView)
  const [officeFilter, setOfficeFilter] = useState("all")
  const [contactFilter, setContactFilter] = useState("all")
  const [opportunityFilter, setOpportunityFilter] = useState("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [optionalFieldsOpen, setOptionalFieldsOpen] = useState(false)
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
      filterMaRelationshipTimeline(workspace.interactions, {
        officeId: officeFilter === "all" ? null : officeFilter,
        contactId: contactFilter === "all" ? null : contactFilter,
        opportunityId: opportunityFilter === "all" ? null : opportunityFilter,
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
    setOptionalFieldsOpen(false)
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

  const selectView = (view: string) => {
    const nextView: MaRelationshipView =
      view === "firms" || view === "contacts" ? view : "timeline"
    setActiveView(nextView)
    router.replace(
      nextView === "timeline"
        ? "/opportunities/ma/activity"
        : `/opportunities/ma/${nextView}`,
      { scroll: false },
    )
  }

  const pageCopy = {
    timeline: {
      title: "Activity",
      description:
        "One chronological M&A relationship record, before or alongside an opportunity.",
    },
    firms: {
      title: "Firms",
      description: "Canonical M&A firms and their operating offices.",
    },
    contacts: {
      title: "Contacts",
      description: "Canonical M&A contacts and their active office affiliations.",
    },
  }[activeView]

  const activeFilterCount = [
    officeFilter,
    contactFilter,
    opportunityFilter,
  ].filter((filter) => filter !== "all").length
  const filterSummary = activeFilterCount
    ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
    : "All offices, contacts and opportunities"

  const timelineFilters = (
    <Card className="order-2 md:order-1">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Timeline filters</CardTitle>
            <CardDescription className="mt-1">
              Filter the same canonical timeline by office, contact or
              opportunity.
            </CardDescription>
          </div>
          <span className="pt-0.5 text-xs text-muted-foreground md:hidden">
            {filterSummary}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="hidden gap-3 md:grid md:grid-cols-3">
          <RelationshipFilterControls
            idPrefix="desktop"
            workspace={workspace}
            officeFilter={officeFilter}
            contactFilter={contactFilter}
            opportunityFilter={opportunityFilter}
            onOfficeChange={setOfficeFilter}
            onContactChange={setContactFilter}
            onOpportunityChange={setOpportunityFilter}
          />
        </div>
        <Collapsible className="md:hidden">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              All filters
              <ChevronDown data-icon="inline-end" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid gap-3">
              <RelationshipFilterControls
                idPrefix="mobile"
                workspace={workspace}
                officeFilter={officeFilter}
                contactFilter={contactFilter}
                opportunityFilter={opportunityFilter}
                onOfficeChange={setOfficeFilter}
                onContactChange={setContactFilter}
                onOpportunityChange={setOpportunityFilter}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="wave-micro-label">Staff workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {pageCopy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pageCopy.description}
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          disabled={!workspace.offices.length}
        >
          <Plus data-icon="inline-start" />
          Add activity
        </Button>
      </div>

      <Alert>
        <AlertTitle>Internal relationship history</AlertTitle>
        <AlertDescription>
          Add manual staff evidence here. Recording an email here never sends
          one; only provider delivery evidence can show a system-recorded send.
        </AlertDescription>
      </Alert>

      <Tabs value={activeView} onValueChange={selectView} className="space-y-4">
        <TabsList aria-label="M&A views">
          <TabsTrigger value="timeline">Activity</TabsTrigger>
          <TabsTrigger value="firms">Firms</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="space-y-4">
          <div className="flex flex-col gap-4">
            {timelineFilters}
            <Card className="order-1 md:order-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Relationship timeline
                </CardTitle>
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
                      const confirmedProviderDelivery =
                        hasConfirmedProviderDelivery(interaction)
                      const mayVerify =
                        interaction.ownerVerificationState === "provisional" &&
                        interaction.ownerStaffUserId ===
                          workspace.currentUserId
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
                                <span className="text-xs capitalize text-muted-foreground">
                                  {interaction.channel}
                                </span>
                                {interaction.direction ? (
                                  <span className="text-xs capitalize text-muted-foreground">
                                    {interaction.direction}
                                  </span>
                                ) : null}
                                <Badge variant="outline">
                                  {interaction.activityProvenance === "manual"
                                    ? "Manual"
                                    : "System-recorded"}
                                </Badge>
                                {interaction.activityProvenance ===
                                  "system-recorded" &&
                                interaction.deliveryStatus ? (
                                  <span
                                    className={
                                      interaction.deliveryStatus === "failed"
                                        ? "text-xs capitalize text-destructive"
                                        : "text-xs capitalize text-muted-foreground"
                                    }
                                  >
                                    {confirmedProviderDelivery
                                      ? "sent"
                                      : interaction.deliveryStatus}
                                  </span>
                                ) : null}
                                {interaction.ownerVerificationState ===
                                "provisional" ? (
                                  <Badge
                                    className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/10"
                                    variant="outline"
                                  >
                                    Owner to verify
                                  </Badge>
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
                          interaction.deliveryError ||
                          (interaction.channel === "email" &&
                            interaction.activityProvenance === "manual") ? (
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
                                  <span className="font-medium">
                                    Delivery:{" "}
                                  </span>
                                  {interaction.deliveryError}
                                </p>
                              ) : null}
                              {interaction.channel === "email" &&
                              interaction.activityProvenance === "manual" ? (
                                <p className="text-muted-foreground sm:col-span-2">
                                  <span className="font-medium">
                                    Delivery:{" "}
                                  </span>
                                  No provider delivery evidence recorded.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {interaction.ownerVerificationState ===
                          "provisional" ? (
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
          </div>
        </TabsContent>
        <TabsContent value="firms">
          <RelationshipFirmsDirectory
            firms={workspace.firms}
            offices={workspace.offices}
          />
        </TabsContent>
        <TabsContent value="contacts">
          <RelationshipContactsDirectory
            contacts={workspace.contacts}
            offices={workspace.offices}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetDraft()
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader>
            <div className="px-6 pt-6">
              <DialogTitle>Record relationship activity</DialogTitle>
              <DialogDescription className="mt-2">
                Capture staff evidence. This does not send an email or upload an
                attachment.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                  Direction{" "}
                  {channel === "call" || channel === "email" ? "*" : ""}
                </Label>
                <Select
                  value={
                    channel === "call" || channel === "email"
                      ? direction
                      : "none"
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
              <Collapsible
                open={optionalFieldsOpen}
                onOpenChange={setOptionalFieldsOpen}
                className="space-y-4 sm:col-span-2"
              >
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    Optional details
                    <ChevronDown data-icon="inline-end" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="grid gap-4 pt-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="relationship-contact">Contact</Label>
                    <Select
                      value={affiliationId}
                      onValueChange={setAffiliationId}
                    >
                      <SelectTrigger id="relationship-contact">
                        <SelectValue placeholder="No contact" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          No specific contact
                        </SelectItem>
                        {selectedOffice?.contacts.map((contact) => (
                          <SelectItem
                            key={contact.affiliationId}
                            value={contact.affiliationId}
                          >
                            {contact.label}
                            {contact.email ? ` · ${contact.email}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relationship-opportunity">
                      Opportunity
                    </Label>
                    <Select
                      value={opportunityId}
                      onValueChange={setOpportunityId}
                    >
                      <SelectTrigger id="relationship-opportunity">
                        <SelectValue placeholder="No opportunity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          No specific opportunity
                        </SelectItem>
                        {officeOpportunities.map((opportunity) => (
                          <SelectItem
                            key={opportunity.id}
                            value={opportunity.id}
                          >
                            {opportunity.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Label htmlFor="relationship-next-due">
                      Next action due
                    </Label>
                    <Input
                      id="relationship-next-due"
                      type="datetime-local"
                      value={nextActionDueAt}
                      onChange={(event) =>
                        setNextActionDueAt(event.target.value)
                      }
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
          <DialogFooter className="border-t bg-background px-6 py-4">
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

interface RelationshipFilterControlsProps {
  idPrefix: "desktop" | "mobile"
  workspace: MaRelationshipWorkspace
  officeFilter: string
  contactFilter: string
  opportunityFilter: string
  onOfficeChange: (value: string) => void
  onContactChange: (value: string) => void
  onOpportunityChange: (value: string) => void
}

function RelationshipFilterControls({
  idPrefix,
  workspace,
  officeFilter,
  contactFilter,
  opportunityFilter,
  onOfficeChange,
  onContactChange,
  onOpportunityChange,
}: RelationshipFilterControlsProps) {
  const officeFilterId = `relationship-${idPrefix}-office-filter`
  const contactFilterId = `relationship-${idPrefix}-contact-filter`
  const opportunityFilterId = `relationship-${idPrefix}-opportunity-filter`

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={officeFilterId}>Office</Label>
        <Select value={officeFilter} onValueChange={onOfficeChange}>
          <SelectTrigger id={officeFilterId}>
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
        <Label htmlFor={contactFilterId}>Contact</Label>
        <Select value={contactFilter} onValueChange={onContactChange}>
          <SelectTrigger id={contactFilterId}>
            <SelectValue placeholder="All contacts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All contacts</SelectItem>
            {workspace.contacts.map((contact) => (
              <SelectItem key={contact.id} value={contact.id}>
                {contact.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={opportunityFilterId}>Opportunity</Label>
        <Select value={opportunityFilter} onValueChange={onOpportunityChange}>
          <SelectTrigger id={opportunityFilterId}>
            <SelectValue placeholder="All opportunities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All opportunities</SelectItem>
            {workspace.opportunities.map((opportunity) => (
              <SelectItem key={opportunity.id} value={opportunity.id}>
                {opportunity.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}

function formatKnownDate(value: string | null) {
  if (!value) return "No recorded date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No recorded date"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function RelationshipFirmIndicators({
  indicators,
  includeOfficeCount = false,
}: {
  indicators:
    | MaRelationshipWorkspace["firms"][number]["indicators"]
    | MaRelationshipWorkspace["offices"][number]["indicators"]
  includeOfficeCount?: boolean
}) {
  const officeCount =
    "officeCount" in indicators ? indicators.officeCount : null

  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {includeOfficeCount && officeCount !== null ? (
        <span>
          {officeCount} office{officeCount === 1 ? "" : "s"}
        </span>
      ) : null}
      <span>
        {indicators.activeContactCount} active contact
        {indicators.activeContactCount === 1 ? "" : "s"}
      </span>
      <span>{indicators.sourcedOpportunityCount} sourced</span>
      <span>{indicators.openOpportunityCount} open</span>
      <span>{indicators.candidateStaleCount} candidate-stale</span>
      <span>Latest: {formatKnownDate(indicators.latestKnownAt)}</span>
    </div>
  )
}

function RelationshipFirmRow({
  firm,
  offices,
}: {
  firm: MaRelationshipWorkspace["firms"][number]
  offices: MaRelationshipWorkspace["offices"]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{firm.name}</p>
              <Badge variant="outline" className="capitalize">
                {firm.status}
              </Badge>
            </div>
            <RelationshipFirmIndicators
              indicators={firm.indicators}
              includeOfficeCount
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/opportunities/ma/firms/${firm.id}`}>
                Open firm
              </Link>
            </Button>
            <CollapsibleTrigger asChild>
              <Button
                aria-label={`${open ? "Hide" : "Show"} offices for ${firm.name}`}
                size="sm"
                variant="outline"
              >
                {open ? "Hide offices" : "Show offices"}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="mt-3 border-t pt-3">
            <div className="divide-y rounded-md border">
              {offices.map((office) => (
                <div
                  className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                  key={office.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{office.officeName}</p>
                      <Badge variant="outline" className="capitalize">
                        {office.status}
                      </Badge>
                    </div>
                    <RelationshipFirmIndicators
                      indicators={office.indicators}
                    />
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/opportunities/ma/offices/${office.id}`}>
                      Open office
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function RelationshipFirmsDirectory({
  firms,
  offices,
}: Pick<MaRelationshipWorkspace, "firms" | "offices">) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const byFirm = useMemo(() => {
    const grouped = new Map<string, MaRelationshipWorkspace["offices"]>()
    for (const office of offices) {
      grouped.set(office.firmId, [
        ...(grouped.get(office.firmId) ?? []),
        office,
      ])
    }
    return grouped
  }, [offices])
  const matchingFirms = useMemo(() => {
    return firms.filter(
      (firm) =>
        !normalizedQuery ||
        firm.name.toLocaleLowerCase().includes(normalizedQuery) ||
        (byFirm.get(firm.id) ?? []).some((office) =>
          office.officeName.toLocaleLowerCase().includes(normalizedQuery),
        ),
    )
  }, [byFirm, firms, normalizedQuery])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Firms</CardTitle>
        <CardDescription>
          Canonical firms and offices available to the relationship ledger.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Label className="sr-only" htmlFor="relationship-firm-search">
          Search firms or offices
        </Label>
        <Input
          id="relationship-firm-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search firms or offices"
        />
        {offices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No canonical firms or offices are available yet.
          </p>
        ) : matchingFirms.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No firms or offices match this search.
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {matchingFirms.map((firm) => (
              <RelationshipFirmRow
                firm={firm}
                offices={[...(byFirm.get(firm.id) ?? [])].sort((left, right) =>
                  left.officeName.localeCompare(right.officeName),
                )}
                key={firm.id}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RelationshipContactsDirectory({
  contacts,
  offices,
}: Pick<MaRelationshipWorkspace, "contacts" | "offices">) {
  const router = useRouter()
  const [isPolicyPending, startPolicyTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [policyContact, setPolicyContact] = useState<
    MaRelationshipWorkspace["contacts"][number] | null
  >(null)
  const [policyReason, setPolicyReason] = useState("")
  const officeLabels = useMemo(
    () => new Map(offices.map((office) => [office.id, office.label])),
    [offices],
  )
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredContacts = useMemo(
    () =>
      contacts.filter((contact) => {
        const searchText = [
          contact.label,
          contact.email,
          ...contact.officeIds.map((officeId) => officeLabels.get(officeId)),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
        return !normalizedQuery || searchText.includes(normalizedQuery)
      }),
    [contacts, normalizedQuery, officeLabels],
  )
  const suppressedCount = contacts.filter(
    (contact) => contact.campaignEmailSuppressed,
  ).length

  const closePolicyDialog = () => {
    setPolicyContact(null)
    setPolicyReason("")
  }

  const savePolicy = () => {
    if (!policyContact) return
    const nextSuppressed = !policyContact.campaignEmailSuppressed
    startPolicyTransition(async () => {
      const result = await setMaContactCampaignEmailSuppression({
        contactId: policyContact.id,
        suppressed: nextSuppressed,
        reason: policyReason,
      })
      if (!result.success) {
        toast.error("Email policy not changed", { description: result.message })
        return
      }
      toast.success(
        nextSuppressed ? "Campaign email blocked" : "Campaign email restored",
        { description: result.message },
      )
      closePolicyDialog()
      router.refresh()
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts</CardTitle>
          <CardDescription>
            Canonical contacts and their active office affiliations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {suppressedCount > 0 ? (
            <Alert>
              <AlertTitle>
                {suppressedCount} contact
                {suppressedCount === 1 ? " has" : "s have"} campaign email
                blocked
              </AlertTitle>
              <AlertDescription>
                WAVE excludes these people from campaign and general outreach
                across every office affiliation.
              </AlertDescription>
            </Alert>
          ) : null}
          <Label className="sr-only" htmlFor="relationship-contact-search">
            Search contacts, email or office
          </Label>
          <Input
            id="relationship-contact-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search contacts, email or office"
          />
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No canonical contacts are available yet.
            </p>
          ) : filteredContacts.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No contacts match this search.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{contact.label}</p>
                      {contact.campaignEmailSuppressed ? (
                        <Badge
                          className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/10"
                          variant="outline"
                        >
                          Campaign email blocked
                        </Badge>
                      ) : null}
                    </div>
                    {contact.email ? (
                      <p className="text-sm text-muted-foreground">
                        {contact.email}
                      </p>
                    ) : null}
                    {contact.campaignEmailSuppressionReason ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {contact.campaignEmailSuppressionReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:max-w-[46%] sm:items-end">
                    <span className="text-xs text-muted-foreground sm:text-right">
                      {contact.officeIds
                        .map((officeId) => officeLabels.get(officeId))
                        .filter(Boolean)
                        .join(" · ") || "No active office"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPolicyContact(contact)
                        setPolicyReason("")
                      }}
                    >
                      Manage email policy
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(policyContact)}
        onOpenChange={(open) => {
          if (!open) closePolicyDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {policyContact?.campaignEmailSuppressed
                ? "Allow campaign email again"
                : "Block campaign email"}
            </DialogTitle>
            <DialogDescription>
              This policy follows the person across every office affiliation.
              Every change is retained with your identity, time and reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border px-3 py-2 text-sm">
              <p className="font-medium">{policyContact?.label}</p>
              <p className="text-muted-foreground">
                {policyContact?.email ?? "No email address"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email-policy-reason">Reason *</Label>
              <Textarea
                id="contact-email-policy-reason"
                value={policyReason}
                onChange={(event) => setPolicyReason(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder={
                  policyContact?.campaignEmailSuppressed
                    ? "Why is outreach allowed again?"
                    : "Why should campaign and general outreach be blocked?"
                }
              />
            </div>
            {policyContact?.campaignEmailSuppressed ? (
              <p className="text-xs text-muted-foreground">
                Removing this block does not erase the original W-010 warning
                or any earlier policy event.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closePolicyDialog}
              disabled={isPolicyPending}
            >
              Cancel
            </Button>
            <Button
              onClick={savePolicy}
              disabled={isPolicyPending || policyReason.trim().length < 5}
            >
              {isPolicyPending
                ? "Saving..."
                : policyContact?.campaignEmailSuppressed
                  ? "Allow campaign email"
                  : "Block campaign email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

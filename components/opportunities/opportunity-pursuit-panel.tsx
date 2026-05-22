import Link from "next/link"
import { CalendarClock, CircleDot, FileText, History, LockKeyhole, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { OpportunityReviewSubmitButton } from "@/components/opportunities/opportunity-review-submit-button"
import { updateOpportunityPursuitNda, updateOpportunityPursuitStage } from "@/lib/actions/opportunity-matches"
import {
  OPPORTUNITY_NDA_STATUS_OPTIONS,
  OPPORTUNITY_PURSUIT_STAGE_OPTIONS,
  getOpportunityNdaStatusLabel,
  getOpportunityPursuitStageLabel,
  type OpportunityDocument,
  type OpportunityMatch,
  type OpportunityMatchCandidate,
  type OpportunityPursuitEvent,
  type OpportunityPursuitStage,
} from "@/lib/types/opportunity"

interface OpportunityPursuitPanelProps {
  opportunityId: string
  matches: OpportunityMatch[]
  events: OpportunityPursuitEvent[]
  documents: OpportunityDocument[]
}

const EDITABLE_STAGE_OPTIONS = OPPORTUNITY_PURSUIT_STAGE_OPTIONS.filter((option) => option.value !== "dropped")
const NO_NDA_DOCUMENT_VALUE = "none"

function repreneurName(repreneur: OpportunityMatchCandidate | null | undefined) {
  if (!repreneur) return "Unknown repreneur"
  return [repreneur.first_name, repreneur.last_name].filter(Boolean).join(" ") || repreneur.email
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function stageVariant(stage: OpportunityPursuitStage | null | undefined): "default" | "secondary" | "outline" {
  if (stage === "closed") return "default"
  if (stage === "dropped") return "secondary"
  return "outline"
}

function stageLabel(stage: OpportunityPursuitStage | null | undefined) {
  return stage ? getOpportunityPursuitStageLabel(stage) : "Not started"
}

export function OpportunityPursuitPanel({ opportunityId, matches, events, documents }: OpportunityPursuitPanelProps) {
  const activeMatch = matches.find((match) => match.status === "active_pursuit") ?? null
  const latestDroppedMatch =
    matches.find((match) => match.status === "dropped" && match.pursuit_stage === "dropped") ?? null
  const visibleMatch = activeMatch ?? latestDroppedMatch
  const updateAction = activeMatch ? updateOpportunityPursuitStage.bind(null, activeMatch.id, opportunityId) : null
  const updateNdaAction = activeMatch ? updateOpportunityPursuitNda.bind(null, activeMatch.id, opportunityId) : null
  const ndaDocuments = documents.filter((document) => document.document_type === "nda")
  const linkedNdaDocument = ndaDocuments.find((document) => document.id === activeMatch?.nda_document_id) ?? null
  const showInfoMemoNextAction = Boolean(
    activeMatch && (!activeMatch.pursuit_stage || activeMatch.pursuit_stage === "interest"),
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole data-icon="inline-start" />
            Active pursuit stage
          </CardTitle>
          <CardDescription>Track the current validated path without adding a full CRM workflow.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {!visibleMatch && (
            <Alert>
              <CircleDot />
              <AlertTitle>No active pursuit yet</AlertTitle>
              <AlertDescription>Validate an interested repreneur before tracking deal stages.</AlertDescription>
            </Alert>
          )}

          {showInfoMemoNextAction && (
            <Alert>
              <FileText />
              <AlertTitle>Next action: request NDA and info memo</AlertTitle>
              <AlertDescription>
                Use the M&A workflow to ask the intermediary for its NDA and the info memo. Re-New still follows the M&A firm's NDA process.
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={`/opportunities/${opportunityId}?tab=ma`}>Prepare request</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {visibleMatch && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-md border p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={stageVariant(visibleMatch.pursuit_stage)}>
                      {stageLabel(visibleMatch.pursuit_stage)}
                    </Badge>
                    <Badge variant="secondary">{activeMatch ? "Active pursuit" : "Dropped pursuit"}</Badge>
                  </div>
                  <div>
                    <p className="font-medium">{repreneurName(visibleMatch.repreneur)}</p>
                    <p className="text-sm text-muted-foreground">{visibleMatch.repreneur?.email ?? "-"}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="size-4" />
                    Updated {formatDateTime(visibleMatch.pursuit_stage_updated_at)}
                  </div>
                  {visibleMatch.pursuit_stage_notes && (
                    <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">
                      {visibleMatch.pursuit_stage_notes}
                    </p>
                  )}
                </div>
              </div>

              {activeMatch && updateAction && (
                <form action={updateAction} className="flex flex-col gap-4 rounded-md border p-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pursuit_stage">Current stage</Label>
                    <Select name="pursuit_stage" defaultValue={activeMatch.pursuit_stage ?? "interest"}>
                      <SelectTrigger id="pursuit_stage" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {EDITABLE_STAGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pursuit_stage_notes">Staff note</Label>
                    <Textarea
                      id="pursuit_stage_notes"
                      name="pursuit_stage_notes"
                      rows={4}
                      defaultValue={activeMatch.pursuit_stage_notes ?? ""}
                      placeholder="Optional internal note"
                    />
                  </div>
                  <OpportunityReviewSubmitButton label="Save stage" pendingLabel="Saving..." className="w-fit">
                    <CircleDot data-icon="inline-start" />
                  </OpportunityReviewSubmitButton>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck data-icon="inline-start" />
            NDA and document gate
          </CardTitle>
          <CardDescription>Control whether approved documents can be downloaded by the active repreneur.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {!activeMatch && (
            <Alert>
              <FileText />
              <AlertTitle>No active pursuit</AlertTitle>
              <AlertDescription>Validate a pursuit before setting NDA status or document access.</AlertDescription>
            </Alert>
          )}

          {activeMatch && updateNdaAction && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-md border p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{getOpportunityNdaStatusLabel(activeMatch.nda_status ?? "not_required")}</Badge>
                    {linkedNdaDocument && <Badge variant="secondary">NDA: {linkedNdaDocument.title}</Badge>}
                  </div>
                  <div>
                    <p className="font-medium">Document downloads</p>
                    <p className="text-sm text-muted-foreground">
                      Allowed when NDA is not required, signed, or waived. Approved documents stay blocked while NDA is required or sent.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="size-4" />
                    Updated {formatDateTime(activeMatch.nda_updated_at)}
                  </div>
                  {activeMatch.nda_notes && (
                    <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">{activeMatch.nda_notes}</p>
                  )}
                </div>
              </div>

              <form action={updateNdaAction} className="flex flex-col gap-4 rounded-md border p-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nda_status">NDA status</Label>
                  <Select name="nda_status" defaultValue={activeMatch.nda_status ?? "not_required"}>
                    <SelectTrigger id="nda_status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {OPPORTUNITY_NDA_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nda_document_id">Linked NDA document</Label>
                  <Select name="nda_document_id" defaultValue={activeMatch.nda_document_id ?? NO_NDA_DOCUMENT_VALUE}>
                    <SelectTrigger id="nda_document_id" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={NO_NDA_DOCUMENT_VALUE}>No linked NDA</SelectItem>
                        {ndaDocuments.map((document) => (
                          <SelectItem key={document.id} value={document.id}>
                            {document.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nda_notes">Staff note</Label>
                  <Textarea
                    id="nda_notes"
                    name="nda_notes"
                    rows={4}
                    defaultValue={activeMatch.nda_notes ?? ""}
                    placeholder="Optional internal NDA note"
                  />
                </div>
                <OpportunityReviewSubmitButton label="Save NDA" pendingLabel="Saving..." className="w-fit">
                  <ShieldCheck data-icon="inline-start" />
                </OpportunityReviewSubmitButton>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History data-icon="inline-start" />
            Stage history
          </CardTitle>
          <CardDescription>Internal record of pursuit stage changes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Repreneur</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No stage changes recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant={stageVariant(event.stage)}>
                          {getOpportunityPursuitStageLabel(event.stage)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{repreneurName(event.repreneur)}</div>
                        <div className="text-xs text-muted-foreground">{event.repreneur?.email ?? "-"}</div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="whitespace-pre-wrap text-sm">{event.note || "-"}</p>
                      </TableCell>
                      <TableCell>{formatDateTime(event.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

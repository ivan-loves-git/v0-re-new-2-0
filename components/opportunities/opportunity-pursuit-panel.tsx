import { CalendarClock, CircleDot, History, LockKeyhole } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { OpportunityReviewSubmitButton } from "@/components/opportunities/opportunity-review-submit-button"
import { updateOpportunityPursuitStage } from "@/lib/actions/opportunity-matches"
import {
  OPPORTUNITY_PURSUIT_STAGE_OPTIONS,
  getOpportunityPursuitStageLabel,
  type OpportunityMatch,
  type OpportunityMatchCandidate,
  type OpportunityPursuitEvent,
  type OpportunityPursuitStage,
} from "@/lib/types/opportunity"

interface OpportunityPursuitPanelProps {
  opportunityId: string
  matches: OpportunityMatch[]
  events: OpportunityPursuitEvent[]
}

const EDITABLE_STAGE_OPTIONS = OPPORTUNITY_PURSUIT_STAGE_OPTIONS.filter((option) => option.value !== "dropped")

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

export function OpportunityPursuitPanel({ opportunityId, matches, events }: OpportunityPursuitPanelProps) {
  const activeMatch = matches.find((match) => match.status === "active_pursuit") ?? null
  const latestDroppedMatch =
    matches.find((match) => match.status === "dropped" && match.pursuit_stage === "dropped") ?? null
  const visibleMatch = activeMatch ?? latestDroppedMatch
  const updateAction = activeMatch ? updateOpportunityPursuitStage.bind(null, activeMatch.id, opportunityId) : null

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

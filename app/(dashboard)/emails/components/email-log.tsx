"use client"
import { useState, useTransition } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getEmailHistory,
  getEmailHistoryDetail,
  type EmailHistoryRecord,
} from "@/lib/actions/email-operations"
import { formatDisplayDateTime } from "@/lib/utils/display-date-time"
const date = (value: string | null) =>
  value ? formatDisplayDateTime(value, "en-GB") : "Unavailable"
const explanation: Record<string, string> = {
  sent: "The provider accepted this request; inbox delivery is not yet confirmed.",
  delivered: "Delivery was recorded. This does not prove reading.",
  opened:
    "An image load was recorded at message level. It may be a staff CC or mail-client proxy; intended-recipient reading is unknown.",
  clicked:
    "A link click was recorded at message level. Intended-recipient attribution is unknown unless verified in the event evidence.",
  bounced:
    "The canonical primary recipient delivery bounced after provider acceptance. Do not blindly resend.",
  complained: "A complaint was recorded. Earlier delivery and activity facts remain retained.",
  rejected:
    "The provider or delivery guard rejected the request. A missing receipt does not establish a successful send.",
  failed: "Sending failed; inspect retained evidence before retrying.",
  uncertain:
    "Acceptance is unresolved. Reconcile this unchanged operation; do not create another send.",
  sending: "An attempt is in flight or requires reconciliation; no blind retry.",
  pending: "Prepared for review; no accepted send is recorded.",
  suppressed:
    "The provider or recipient policy suppressed this delivery. No automatic retry is authorized.",
  delayed: "Delivery is delayed; the accepted request is retained and no retry is started.",
  cancelled:
    "The review draft was cancelled; cancellation does not recall an already accepted message.",
}
export function EmailLog({
  initialRecords,
  initialTotal,
  sent = false,
  initialError = null,
}: {
  initialRecords: EmailHistoryRecord[]
  initialTotal: number
  sent?: boolean
  initialError?: string | null
}) {
  const [records, setRecords] = useState(initialRecords),
    [total, setTotal] = useState(initialTotal),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [status, setStatus] = useState("all"),
    [error, setError] = useState<string | null>(initialError),
    [pending, start] = useTransition()
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getEmailHistoryDetail>> | null>(
      null,
    ),
    [detailOpen, setDetailOpen] = useState(false)
  const load = (nextPage: number, nextStatus = status) =>
    start(async () => {
      setError(null)
      try {
        const result = await getEmailHistory({ search, page: nextPage, status: nextStatus, sent })
        setRecords(result.records)
        setTotal(result.total)
        setPage(result.page)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "History unavailable.")
      }
    })
  const open = (id: string) =>
    start(async () => {
      setDetailOpen(true)
      setDetail(null)
      setError(null)
      try {
        setDetail(await getEmailHistoryDetail(id))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Detail unavailable.")
      }
    })
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{sent ? "Sent · latest 150 accepted messages" : "Email History"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {sent
            ? "Includes automatic and approved mail. Later bounces remain visible. This display limit does not delete evidence."
            : "Search all retained sources before pagination. Opening a record never sends or retries email."}
        </p>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            load(1)
          }}
        >
          <Input
            aria-label="Search all email history"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Recipient, subject, type or status"
            className="min-w-0 flex-1"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value)
              load(1, value)
            }}
          >
            <SelectTrigger aria-label="History status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              {Object.keys(explanation).map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={pending} type="submit">
            Search
          </Button>
        </form>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}{" "}
            <Button variant="outline" onClick={() => load(page)}>
              Retry
            </Button>
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Accepted at · Paris</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <Button
                      variant="link"
                      className="h-auto whitespace-normal p-0 text-left"
                      onClick={() => open(record.id)}
                    >
                      {record.subject ?? "Historical subject unavailable"}
                    </Button>
                    <p className="text-xs text-muted-foreground">{record.template_key}</p>
                  </TableCell>
                  <TableCell>
                    {record.recipient_name ?? "Name unavailable"}
                    <p className="text-xs text-muted-foreground">
                      {record.recipient_email ?? "Address unavailable"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => open(record.id)}>
                      <Badge
                        variant={
                          record.status === "bounced" || record.status === "rejected"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {record.status}
                      </Badge>
                    </Button>
                  </TableCell>
                  <TableCell>
                    {record.sent_at
                      ? date(record.sent_at)
                      : record.provider_message_id
                        ? "Send time unavailable"
                        : "No accepted send recorded"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!records.length ? (
          <p className="py-6 text-sm text-muted-foreground">
            No retained messages match this search.
          </p>
        ) : null}
        {!sent ? (
          <div className="mt-4 flex items-center justify-between gap-2 text-sm">
            <Button
              variant="outline"
              disabled={pending || page === 1}
              onClick={() => load(page - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} · {total} retained records
            </span>
            <Button
              variant="outline"
              disabled={pending || page * 25 >= total}
              onClick={() => load(page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Retained message</DialogTitle>
            <DialogDescription>
              Outcome and chronology before actual message evidence.
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4">
              <section className="rounded-md border p-4 space-y-2">
                <Badge variant="outline">{detail.record.status}</Badge>
                <p>
                  {explanation[detail.record.status] ??
                    "Only the recorded source outcome is available."}
                </p>
                <p className="text-sm">
                  Prepared: {date(detail.record.created_at)} · Provider accepted:{" "}
                  {date(detail.record.sent_at)}
                </p>
                {detail.record.reason ? (
                  <p className="text-sm break-words">Recorded reason: {detail.record.reason}</p>
                ) : null}
                {detail.events.map((event, index) => (
                  <p key={index} className="text-xs text-muted-foreground">
                    {date(event.occurred_at)} · {event.event_type} ·{" "}
                    {event.recipient_kind === "primary"
                      ? "canonical primary recipient"
                      : event.recipient_kind === "copy"
                        ? "staff/copy recipient"
                        : "recipient attribution unknown"}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </p>
                ))}
              </section>
              <section className="space-y-2">
                <h3 className="font-medium">
                  {detail.record.subject ?? "Historical subject unavailable"}
                </h3>
                <p className="text-sm">
                  To: {detail.record.recipient_email ?? "Unavailable"} · CC:{" "}
                  {detail.record.cc
                    ? detail.record.cc.join(", ") || "None"
                    : "Historical envelope unavailable"}
                </p>
                {detail.record.body_text ? (
                  <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 font-sans text-sm">
                    {detail.record.body_text}
                  </pre>
                ) : (
                  <p className="rounded-md border p-4 text-muted-foreground">
                    Historical body unavailable. Current template copy is not evidence of what was
                    sent.
                  </p>
                )}
                {detail.record.review_id ? (
                  <Link
                    className="underline text-sm"
                    href={`/emails/review/${detail.record.review_id}`}
                  >
                    Open original review evidence
                  </Link>
                ) : null}
              </section>
            </div>
          ) : (
            <p>{pending ? "Loading retained evidence…" : (error ?? "Message unavailable.")}</p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

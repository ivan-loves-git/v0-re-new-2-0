"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ArrowDown, ArrowUp, Clock3, Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { listStaffEmailReviews } from "@/lib/actions/staff-email-review"
import { EMAIL_REVIEW_PURPOSES, emailReviewDetailHref, isEmailReviewSelectable, type EmailReviewDirection, type EmailReviewPurpose, type EmailReviewQueueRow, type EmailReviewSort } from "@/lib/email/review-queue-query"
import { formatDisplayDateTime } from "@/lib/utils/display-date-time"

type Queue = Awaited<ReturnType<typeof listStaffEmailReviews>>

const purposeTone: Record<EmailReviewPurpose, string> = {
  source_freshness: "border-warning/30 bg-warning/10 text-warning",
  e4_qualification: "border-info/30 bg-info/10 text-info",
  e6_nda_ready: "border-success/30 bg-success/10 text-success",
  e7_signed_copies: "border-info/30 bg-info/10 text-info",
  ma_validity_check: "border-warning/30 bg-warning/10 text-warning",
  ma_more_information: "border-info/30 bg-info/10 text-info",
  ma_interest_feedback: "border-success/30 bg-success/10 text-success",
  ma_nda_memo_request: "border-info/30 bg-info/10 text-info",
  ma_process_follow_up: "border-warning/30 bg-warning/10 text-warning",
  ma_other: "border-border bg-muted text-foreground",
}

const avatarTone = [
  "bg-info/15 text-info", "bg-warning/15 text-warning", "bg-success/15 text-success",
  "bg-primary/10 text-primary", "bg-accent text-accent-foreground",
] as const

function recipientInitials(name: string | null) {
  return name ? name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") : "?"
}

function Recipient({ review }: { review: EmailReviewQueueRow }) {
  const tone = avatarTone[[...review.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarTone.length]
  return <div className="min-w-0 text-xs leading-5">
    <div className="flex min-w-0 items-center gap-1.5">
      <Avatar className="size-5 shrink-0">
        {review.source_kind === "e6" && review.recipient_avatar_url
          ? <AvatarImage src={review.recipient_avatar_url} alt="" /> : null}
        <AvatarFallback className={`${tone} text-[9px] font-semibold`}>{recipientInitials(review.recipient_name)}</AvatarFallback>
      </Avatar>
      <span className={`truncate text-sm ${review.recipient_name ? "font-medium" : "text-muted-foreground"}`} title={review.recipient_name ?? "Name unavailable"}>
        {review.recipient_name ?? "Name unavailable"}
      </span>
    </div>
    <p className="truncate pl-[26px] text-muted-foreground" title={review.recipient_email}>{review.recipient_email}</p>
  </div>
}

function preparedAt(value: string) {
  const day = formatDisplayDateTime(value, "en-GB", { day: "numeric", month: "short" })
  const hour = formatDisplayDateTime(value, "en-US", { hour: "numeric", hour12: true })
  return `${day} ${hour}`
}

function fullPreparedAt(value: string) {
  return formatDisplayDateTime(value, "en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  })
}

function SortHead({ column, label, sort, direction, onSort }: {
  column: EmailReviewSort; label: string; sort: EmailReviewSort; direction: EmailReviewDirection;
  onSort: (column: EmailReviewSort) => void;
}) {
  const active = sort === column
  return <TableHead aria-sort={active ? direction === "asc" ? "ascending" : "descending" : "none"}>
    <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2 wave-micro-label" onClick={() => onSort(column)}>
      {label}{active ? direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
    </Button>
  </TableHead>
}

export function ReviewQueue({ queue }: { queue: Queue }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(queue.search)
  const [selection, setSelection] = useState<{ pageKey: string; ids: string[] }>({ pageKey: "", ids: [] })
  const eligible = queue.reviews.filter(isEmailReviewSelectable)
  const pageKey = eligible.map((review) => review.id).sort().join(":")
  const selected = new Set(selection.pageKey === pageKey ? selection.ids : [])
  const allSelected = eligible.length > 0 && eligible.every((review) => selected.has(review.id))

  function navigate(changes: Record<string, string | null>) {
    const params = new URLSearchParams({
      reviewFilter: queue.view, reviewSearch: queue.search, reviewPurpose: queue.purpose,
      reviewSort: queue.sort, reviewDirection: queue.direction, reviewPage: String(queue.page),
    })
    for (const [name, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(name)
      else params.set(name, value)
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function sortBy(column: EmailReviewSort) {
    const direction: EmailReviewDirection = queue.sort === column
      ? queue.direction === "asc" ? "desc" : "asc"
      : column === "prepared" ? "desc" : "asc"
    navigate({ reviewSort: column, reviewDirection: direction })
  }

  return <section className="rounded-lg border bg-card px-3 py-5 sm:px-5" aria-label="Staff email review queue" aria-busy={pending}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Review &amp; send</h2><p className="mt-1 text-sm text-muted-foreground">Prepared operational emails. Review a complete message before any individual send.</p></div>
      <p className="text-xs text-muted-foreground">{queue.allCount} total prepared</p>
    </div>

    <div className="mt-5 flex flex-wrap items-center gap-1 border-b pb-3 text-sm" aria-label="Queue views">
      <Button type="button" size="sm" variant={queue.view === "active" ? "secondary" : "ghost"} aria-current={queue.view === "active" ? "page" : undefined} onClick={() => navigate({ reviewFilter: "active", reviewPage: null })}>Active backlog <span className="ml-1 tabular-nums">{queue.activeCount}</span></Button>
      <Button type="button" size="sm" variant={queue.view === "all" ? "secondary" : "ghost"} aria-current={queue.view === "all" ? "page" : undefined} onClick={() => navigate({ reviewFilter: "all", reviewPage: null })}>All history <span className="ml-1 tabular-nums">{queue.allCount}</span></Button>
    </div>

    <div className="flex flex-wrap items-end gap-2 py-3">
      <form className="flex min-w-[220px] flex-1 items-center gap-2" onSubmit={(event) => { event.preventDefault(); navigate({ reviewSearch: search.trim(), reviewPage: null }) }} role="search">
        <div className="relative min-w-0 flex-1"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search all authorized email reviews" placeholder="Search subject, recipient, company or message" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" maxLength={120} /></div>
        <Button type="submit" size="sm" variant="outline">Search</Button>
      </form>
      <Select value={queue.purpose} onValueChange={(value) => navigate({ reviewPurpose: value === "all" ? null : value, reviewPage: null })}>
        <SelectTrigger className="w-full min-w-48 sm:w-auto" aria-label="Filter by email purpose"><SelectValue placeholder="All purposes" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All purposes</SelectItem>{EMAIL_REVIEW_PURPOSES.map((purpose) => <SelectItem key={purpose.key} value={purpose.key}>{purpose.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>

    {queue.reviews.length === 0
      ? <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{queue.total === 0 && !queue.search && queue.purpose === "all" ? "No prepared emails in this view." : "No emails match this view, search and purpose. Try another filter."}</p>
      : <div className="-mx-3 sm:-mx-5">
        <p className="px-3 pb-2 text-xs text-muted-foreground sm:px-5">Table scrolls horizontally on narrow screens. Selection covers eligible REAL pending drafts on this page only.</p>
        <Table className="min-w-[1090px] table-fixed">
          <colgroup><col className="w-11" /><col className="w-[300px]" /><col className="w-[155px]" /><col className="w-[225px]" /><col className="w-[165px]" /><col className="w-[120px]" /><col className="w-[85px]" /></colgroup>
          <TableHeader><TableRow>
            <TableHead className="w-11"><Checkbox aria-label="Select all eligible drafts on this page" checked={allSelected ? true : selected.size > 0 ? "indeterminate" : false} disabled={eligible.length === 0} onCheckedChange={(checked) => setSelection({ pageKey, ids: checked === true ? eligible.map((review) => review.id) : [] })} /></TableHead>
            <SortHead column="message" label="Message" sort={queue.sort} direction={queue.direction} onSort={sortBy} /><SortHead column="purpose" label="Purpose" sort={queue.sort} direction={queue.direction} onSort={sortBy} /><SortHead column="recipient" label="Recipient" sort={queue.sort} direction={queue.direction} onSort={sortBy} /><SortHead column="company" label="Company" sort={queue.sort} direction={queue.direction} onSort={sortBy} /><SortHead column="prepared" label="Prepared" sort={queue.sort} direction={queue.direction} onSort={sortBy} />
            <TableHead>Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>{queue.reviews.map((review) => {
            const detailHref = emailReviewDetailHref(review.id)
            return <TableRow key={review.id} className="[&_td]:py-1.5" data-state={selected.has(review.id) ? "selected" : undefined}>
            <TableCell><Checkbox aria-label={`Select draft ${review.subject}`} checked={selected.has(review.id)} disabled={!isEmailReviewSelectable(review)} onCheckedChange={(checked) => setSelection({ pageKey, ids: checked === true ? [...selected, review.id] : [...selected].filter((id) => id !== review.id) })} /></TableCell>
            <TableCell><div className="min-w-0">{detailHref
              ? <Link href={detailHref} className="block truncate font-medium text-foreground hover:underline" title={review.subject}>{review.subject}</Link>
              : <span className="block truncate font-medium text-foreground" title={review.subject}>{review.subject}</span>}
              <span className="block truncate text-xs text-muted-foreground" title={review.body_preview}>{review.body_preview}</span></div></TableCell>
            <TableCell><Badge variant="outline" className={`max-w-full truncate ${purposeTone[review.purpose_key] ?? purposeTone.ma_other}`}>{review.purpose_label}</Badge></TableCell>
            <TableCell><Recipient review={review} /></TableCell>
            <TableCell><span className={review.company_name ? "block truncate" : "text-muted-foreground"} title={review.company_name ?? "Company not recorded"}>{review.company_name ?? "Not recorded"}</span></TableCell>
            <TableCell><time dateTime={review.created_at} title={fullPreparedAt(review.created_at)} className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5 shrink-0" />{preparedAt(review.created_at)}</time></TableCell>
            <TableCell><div className="flex flex-col items-start gap-0.5">{detailHref
              ? <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs"><Link href={detailHref}>Review</Link></Button>
              : <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled>Unavailable</Button>}
              <span className="flex gap-1"><Badge variant="secondary" className="px-1 text-[10px] leading-3">{review.state}</Badge><Badge variant="outline" className="px-1 text-[10px] leading-3">{review.namespace}</Badge></span></div></TableCell>
          </TableRow>
          })}</TableBody>
        </Table>
      </div>}

    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground" role="status">
      <span>{queue.total === 0 ? "0" : `${(queue.page - 1) * queue.pageSize + 1}–${Math.min(queue.page * queue.pageSize, queue.total)}`} of {queue.total} matching · {selected.size} selected on this page</span>
      <div className="flex items-center gap-2"><span>Page {queue.page} of {Math.max(1, Math.ceil(queue.total / queue.pageSize))}</span><Button type="button" size="sm" variant="outline" disabled={queue.page <= 1} onClick={() => navigate({ reviewPage: String(queue.page - 1) })}>Previous</Button><Button type="button" size="sm" variant="outline" disabled={queue.page * queue.pageSize >= queue.total} onClick={() => navigate({ reviewPage: String(queue.page + 1) })}>Next</Button></div>
    </div>
  </section>
}

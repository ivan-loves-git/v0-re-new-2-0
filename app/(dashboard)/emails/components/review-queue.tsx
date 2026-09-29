import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { StaffEmailReview, listStaffEmailReviews } from "@/lib/actions/staff-email-review"
import { formatDisplayDateTime } from "@/lib/utils/display-date-time"

const sourceLabel: Record<StaffEmailReview["source_kind"], string> = {
  ma: "M&A composer", e4: "E4 qualification", e6: "E6 NDA-ready", e7: "E7 signed copies",
  freshness: "45-day source freshness",
}

export function ReviewQueue({ reviews: queue }: { reviews: Awaited<ReturnType<typeof listStaffEmailReviews>> }) {
  const { reviews, total, page, pageSize, filter } = queue
  return <Card>
    <CardHeader>
      <CardTitle>Review &amp; send</CardTitle>
      <CardDescription>Staff and rule-prepared drafts. Preparation does not deliver; provider acceptance is not inbox delivery.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button asChild size="sm" variant={filter === "active" ? "default" : "outline"}><Link href="/emails?reviewFilter=active">Active backlog</Link></Button>
        <Button asChild size="sm" variant={filter === "all" ? "default" : "outline"}><Link href="/emails?reviewFilter=all">All history</Link></Button>
        <span className="text-muted-foreground">{total} records · page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
      </div>
      {reviews.length === 0 ? <p className="text-sm text-muted-foreground">No prepared operational emails yet.</p> :
        reviews.map((review) => <div key={review.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{sourceLabel[review.source_kind]}</span>
              <Badge variant={review.state === "sent" ? "default" : "secondary"}>{review.state}</Badge>
              <Badge variant="outline">{review.namespace}</Badge>
            </div>
            <p className="break-all text-sm">{review.recipient_email}</p>
            <p className="text-xs text-muted-foreground">{review.source_kind === "freshness" ? "Contact-grouped opportunity review" : `Opportunity ${review.opportunity_id.slice(0, 8)} · ${review.match_id ? `Pursuit ${review.match_id.slice(0, 8)}` : "No pursuit"}`} · {formatDisplayDateTime(review.created_at, "fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
          </div>
          <Button asChild size="sm" variant="outline"><Link href={`/emails/review/${review.id}`}>Open review</Link></Button>
        </div>)}
      <div className="flex gap-2">
        {page > 1 ? <Button asChild size="sm" variant="outline"><Link href={`/emails?reviewFilter=${filter}&reviewPage=${page - 1}`}>Previous page</Link></Button> : null}
        {page * pageSize < total ? <Button asChild size="sm" variant="outline"><Link href={`/emails?reviewFilter=${filter}&reviewPage=${page + 1}`}>Next page</Link></Button> : null}
      </div>
    </CardContent>
  </Card>
}

import Link from "next/link"
import { connection } from "next/server"
import { MessageSquareText } from "lucide-react"
import { FeedbackQueue } from "@/components/feedback/feedback-queue"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { listStaffRepreneurFeedback } from "@/lib/repreneur-feedback/data"
import { feedbackStatuses, type FeedbackStatus } from "@/lib/repreneur-feedback/validation"

const statusLabels: Record<FeedbackStatus, string> = {
  new: "New",
  routed: "Routed",
  closed: "Closed",
}

export default async function StaffFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  await connection()
  const params = await searchParams
  const status = feedbackStatuses.includes(params.status as FeedbackStatus)
    ? params.status as FeedbackStatus : "new"
  const parsedPage = Number(params.page ?? 0)
  const page = Number.isSafeInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0
  const result = await listStaffRepreneurFeedback(status, page)
  const first = result.total === 0 ? 0 : result.page * result.pageSize + 1
  const last = Math.min(result.total, (result.page + 1) * result.pageSize)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SectionPageHeader
        title="Repreneur feedback"
        subtitle="Manual product input for Ivan to review and triage"
        icon={MessageSquareText}
        tone="neutral"
      />
      <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        This is a staff-only collection queue, not real-time monitoring or an automatic follow-up channel. “Routed” records manual triage; it does not create a GitHub item or notify anyone.
      </p>
      <nav aria-label="Feedback status" className="flex flex-wrap gap-2">
        {feedbackStatuses.map((choice) => (
          <Button key={choice} asChild size="sm" variant={choice === status ? "secondary" : "outline"}>
            <Link href={`/tools/feedback?status=${choice}`} aria-current={choice === status ? "page" : undefined}>
              {statusLabels[choice]}
            </Link>
          </Button>
        ))}
      </nav>
      <FeedbackQueue items={result.items} />
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{result.total ? `${first}–${last} of ${result.total}` : "No feedback in this view"}</span>
        <div className="flex gap-2">
          {result.page > 0 ? <Button asChild size="sm" variant="outline"><Link href={`/tools/feedback?status=${status}&page=${result.page - 1}`}>Previous</Link></Button> : null}
          {last < result.total ? <Button asChild size="sm" variant="outline"><Link href={`/tools/feedback?status=${status}&page=${result.page + 1}`}>Next</Link></Button> : null}
        </div>
      </div>
    </div>
  )
}

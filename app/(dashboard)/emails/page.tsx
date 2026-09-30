import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmailOverview } from "./components/email-overview"
import { EmailLog } from "./components/email-log"
import { EmailTemplates } from "./components/email-templates"
import { ManualSend } from "./components/manual-send"
import { ReviewQueue } from "./components/review-queue"
import { listStaffEmailReviews } from "@/lib/actions/staff-email-review"
import { parseEmailReviewQueueOptions } from "@/lib/email/review-queue-query"
import {
  getEmailStats,
  getEmailLogs,
  getTemplateSettings,
  getDailyEmailCounts,
} from "@/lib/actions/emails"
import { connection } from "next/server"
import { Mail } from "lucide-react"

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const params = await searchParams
  const value = (name: string) =>
    typeof params[name] === "string" ? (params[name] as string) : undefined
  const reviewOptions = parseEmailReviewQueueOptions({
    reviewPage: value("reviewPage"),
    reviewFilter: value("reviewFilter"),
    reviewSearch: value("reviewSearch"),
    reviewPurpose: value("reviewPurpose"),
    reviewSort: value("reviewSort"),
    reviewDirection: value("reviewDirection"),
  })

  const [stats, logsData, templates, dailyCounts, reviews] = await Promise.all([
    getEmailStats(30),
    getEmailLogs({ limit: 50 }),
    getTemplateSettings(),
    getDailyEmailCounts(14),
    listStaffEmailReviews(reviewOptions),
  ])

  return (
    <div className="email-operations-page flex flex-col">
      <header className="email-operations-heading">
        <div className="email-heading-icon">
          <Mail aria-hidden="true" />
        </div>
        <div>
          <h1>Email operations</h1>
          <p>
            Monitor delivery, manage templates, and send workflow communications
          </p>
        </div>
      </header>

      <Tabs
        defaultValue={value("tab") === "templates" ? "templates" : "review"}
        className="w-full gap-0"
      >
        <div className="email-operations-tabs overflow-x-auto border-b border-border/80">
          <TabsList className="w-max border-b-0">
            <TabsTrigger value="review">Review &amp; send</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="logs">History</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="send">Manual Send</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="review" className="mt-0">
          <ReviewQueue
            key={`${reviews.view}:${reviews.page}:${reviews.search}:${reviews.purpose}`}
            queue={reviews}
          />
        </TabsContent>

        <TabsContent value="overview" className="mt-6">
          <EmailOverview stats={stats} dailyCounts={dailyCounts} />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <EmailLog initialLogs={logsData.logs} initialTotal={logsData.total} />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <EmailTemplates templates={templates} />
        </TabsContent>

        <TabsContent value="send" className="mt-6 space-y-6">
          <ManualSend />
        </TabsContent>
      </Tabs>
    </div>
  )
}

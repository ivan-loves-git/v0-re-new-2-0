import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmailOverview } from "./components/email-overview"
import { EmailLog } from "./components/email-log"
import { EmailTemplates } from "./components/email-templates"
import { ManualSend } from "./components/manual-send"
import { ReviewQueue } from "./components/review-queue"
import { listStaffEmailReviews } from "@/lib/actions/staff-email-review"
import { getEmailStats, getEmailLogs, getTemplateSettings, getDailyEmailCounts } from "@/lib/actions/emails"
import { connection } from "next/server"
import { Mail } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"


export default async function EmailsPage() {
  await connection()

  const [stats, logsData, templates, dailyCounts, reviews] = await Promise.all([
    getEmailStats(30),
    getEmailLogs({ limit: 50 }),
    getTemplateSettings(),
    getDailyEmailCounts(14),
    listStaffEmailReviews(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader title="Email operations" subtitle="Monitor delivery, manage templates, and send workflow communications" icon={Mail} tone="neutral" />


      <Tabs defaultValue="review" className="w-full">
        <TabsList className="grid w-full grid-cols-5 sm:w-fit sm:min-w-[650px]">
          <TabsTrigger value="review">Review &amp; send</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">History</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="send">Manual Send</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-6"><ReviewQueue reviews={reviews} /></TabsContent>

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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmailOverview } from "./components/email-overview"
import { EmailLog } from "./components/email-log"
import { EmailTemplates } from "./components/email-templates"
import { ManualSend } from "./components/manual-send"
import { getEmailStats, getEmailLogs, getTemplateSettings, getDailyEmailCounts } from "@/lib/actions/emails"
import { connection } from "next/server"
import { Mail } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"


export default async function EmailsPage() {
  await connection()

  const [stats, logsData, templates, dailyCounts] = await Promise.all([
    getEmailStats(30),
    getEmailLogs({ limit: 50 }),
    getTemplateSettings(),
    getDailyEmailCounts(14),
  ])

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader title="Email operations" subtitle="Monitor delivery, manage templates, and send workflow communications" icon={Mail} tone="neutral" />


      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 sm:w-fit sm:min-w-[520px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">History</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="send">Manual Send</TabsTrigger>
        </TabsList>

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

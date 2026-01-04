import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmailOverview } from "./components/email-overview"
import { EmailLog } from "./components/email-log"
import { EmailTemplates } from "./components/email-templates"
import { ManualSend } from "./components/manual-send"
import { getEmailStats, getEmailLogs, getTemplateSettings, getDailyEmailCounts } from "@/lib/actions/emails"

export const revalidate = 60

export default async function EmailsPage() {
  const [stats, logsData, templates, dailyCounts] = await Promise.all([
    getEmailStats(30),
    getEmailLogs({ limit: 50 }),
    getTemplateSettings(),
    getDailyEmailCounts(14),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Email Cockpit</h1>
        <p className="text-gray-600 mt-1">Monitor and manage email automation</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
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

        <TabsContent value="send" className="mt-6">
          <ManualSend />
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, ExternalLink } from "lucide-react"
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

      {/* Sandbox Mode Warning */}
      <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-900">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-900 font-semibold">Email Sandbox Mode</AlertTitle>
        <AlertDescription className="text-amber-800">
          <p className="mb-2">
            Emails are currently limited to the Resend account owner only. To send emails to all repreneurs:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Create a Resend account at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900 inline-flex items-center gap-1">resend.com <ExternalLink className="h-3 w-3" /></a></li>
            <li>Add and verify your domain (renew.com or similar)</li>
            <li>Update the RESEND_API_KEY in Vercel environment variables</li>
          </ol>
          <p className="mt-2 text-xs text-amber-700">
            Contact your technical lead for setup assistance.
          </p>
        </AlertDescription>
      </Alert>

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

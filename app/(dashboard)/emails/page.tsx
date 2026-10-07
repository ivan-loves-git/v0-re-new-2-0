import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmailOverview } from "./components/email-overview"
import { EmailLog } from "./components/email-log"
import { EmailTemplates } from "./components/email-templates"
import { ManualSend } from "./components/manual-send"
import { ReviewQueue } from "./components/review-queue"
import { listStaffEmailReviews } from "@/lib/actions/staff-email-review"
import { parseEmailReviewQueueOptions } from "@/lib/email/review-queue-query"
import { getTemplateSettings } from "@/lib/actions/emails"
import { getEmailHistory, getEmailOperationsAnalytics } from "@/lib/actions/email-operations"
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

  const [analytics, history, templates, sent, reviews] = await Promise.all([
    getEmailOperationsAnalytics(30),
    getEmailHistory().then(result=>({...result,error:null})).catch(()=>({records:[],total:0,page:1,pageSize:25,search:"",error:"Email history is unavailable. Retry to read the retained records."})),
    getTemplateSettings(),
    getEmailHistory({ sent: true }).then(result=>({...result,error:null})).catch(()=>({records:[],total:0,page:1,pageSize:150,search:"",error:"Sent history is unavailable. Retry to read the retained records."})),
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
        defaultValue={["templates", "logs", "send", "analytics"].includes(value("tab") ?? "") ? value("tab") : "review"}
        className="w-full gap-0"
      >
        <div className="email-operations-tabs overflow-x-auto border-b border-border/80">
          <TabsList className="w-max border-b-0">
            <TabsTrigger value="review">Review &amp; send</TabsTrigger>
            <TabsTrigger value="logs">History</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="send">Manual Send</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="review" className="mt-0">
          <ReviewQueue queue={reviews} sent={sent} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <EmailOverview initial={analytics} />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <EmailLog initialRecords={history.records} initialTotal={history.total} initialError={history.error} />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <EmailTemplates templates={templates} />
        </TabsContent>

        <TabsContent value="send" className="mt-6 space-y-6">
          <ManualSend templates={templates} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

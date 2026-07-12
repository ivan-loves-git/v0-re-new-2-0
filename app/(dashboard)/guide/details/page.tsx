import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Lightbulb, AlertCircle, CheckCircle2, Workflow } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"


const workflows = [
  {
    title: "Processing a New Lead",
    icon: Workflow,
    steps: [
      "Lead submits intake form → appears in Repreneurs list as 'Lead' with Tier 1 score",
      "Review their Tier 1 score on the Dashboard's 'Top Tier 1 Candidates' widget",
      "Click to open profile → review questionnaire responses and radar chart",
      "Schedule and conduct interview",
      "After interview: Set Tier 2 star rating (1-5) → automatically moves to 'Qualified'",
      "Add notes about the interview (select type: call/meeting/other)",
      "If ready: Assign an offer → automatically moves to 'Client'",
    ],
  },
  {
    title: "Managing an Active Client",
    icon: Workflow,
    steps: [
      "Navigate to their profile from Repreneurs list or Pipeline view",
      "Check their assigned offers in the Offers section",
      "Track milestones: Add deliverables and checkpoints as you complete them",
      "Log activities: Record meetings, calls, emails with duration for time tracking",
      "Add notes for important updates or decisions",
      "Update journey stage if their acquisition readiness changes",
    ],
  },
  {
    title: "Weekly Pipeline Review",
    icon: Workflow,
    steps: [
      "Start on Dashboard → review 'vs last week' changes in Pipeline Stats",
      "Check Top Tier 1 Candidates → prioritize leads for interviews",
      "Check Top Tier 2 Candidates → identify who's ready for offer assignment",
      "Review Activity Stream → ensure no clients are falling through cracks",
      "Use Pipeline view for visual overview of all statuses",
      "Check Conversion Funnel → monitor Lead → Qualified → Client flow",
    ],
  },
]

const tips = [
  {
    title: "Use keyboard shortcuts",
    description: "Press Tab to navigate between fields quickly when editing a profile.",
  },
  {
    title: "Hover for prefetch",
    description: "Hovering over a repreneur row prefetches their profile for faster navigation.",
  },
  {
    title: "Collapse sections",
    description: "In the Repreneurs list, click section headers to collapse status groups you don't need.",
  },
  {
    title: "Check the radar chart",
    description: "The Tier 1 radar chart shows WHY someone scored high or low across 5 dimensions.",
  },
  {
    title: "Use note types",
    description: "Tag notes as call/email/meeting/other to make them easier to scan later.",
  },
  {
    title: "Track milestones",
    description: "For active offers, add milestones to track deliverables and never miss a commitment.",
  },
]

const commonQuestions = [
  {
    question: "How do I move someone from Lead to Qualified?",
    answer: "Set their Tier 2 star rating (1-5 stars) on their profile. This automatically moves them to Qualified status.",
  },
  {
    question: "How do I move someone from Qualified to Client?",
    answer: "Assign them an offer. Any offer assignment automatically changes their status to Client.",
  },
  {
    question: "Can I undo a rejection?",
    answer: "Yes! Click the 'Unreject' button on their profile. Their previous status will be restored.",
  },
  {
    question: "Where does the Tier 1 score come from?",
    answer: "It's calculated automatically from their questionnaire answers across 5 dimensions: Experience, Leadership, M&A Knowledge, Readiness, and Financial. Click the radar chart to see the breakdown.",
  },
  {
    question: "What's the difference between status and journey stage?",
    answer: "Status (Lead/Qualified/Client) tracks their relationship with Re-New. Journey stage (Explorer/Learner/Ready/Serial Acquirer) tracks their acquisition readiness. A Lead might already be Ready, or a Client might still be a Learner.",
  },
  {
    question: "How do I add a new repreneur manually?",
    answer: "Click '+ New Repreneur' button on the Repreneurs page. This is rare — most come through the public intake form.",
  },
  {
    question: "Why can't I drag and drop in the Pipeline?",
    answer: "Status changes are action-driven for data integrity. Set stars to qualify, assign offers to convert. This ensures status always reflects real actions.",
  },
  {
    question: "How do I track time spent on a client?",
    answer: "Log activities with duration. The system tracks time per activity type, which will eventually power cost analytics per client.",
  },
]

export default function DetailedGuidePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SectionPageHeader
        title="Detailed usage guide"
        subtitle="Step-by-step workflows, practical tips, and answers to common questions"
        icon={Workflow}
        tone="neutral"
        actions={<Button asChild variant="outline" size="sm"><Link href="/guide"><ArrowLeft className="size-4" />Back to guide</Link></Button>}
      />

      {/* Workflows */}
      <section id="workflows" className="space-y-4 scroll-mt-8">
        <h2 className="text-lg font-semibold text-foreground">Common workflows</h2>
        <div className="space-y-4">
          {workflows.map((workflow, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <workflow.icon className="size-5 text-blue-600" />
                  {workflow.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {workflow.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex gap-3 text-sm leading-5 text-muted-foreground">
                      <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-foreground">
                        {stepIndex + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tips & Tricks */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Lightbulb className="size-5 text-amber-500" />
          Tips & Tricks
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {tips.map((tip, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="size-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{tip.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{tip.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="space-y-4 scroll-mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <AlertCircle className="size-5 text-blue-500" />
          Common Questions
        </h2>
        <div className="space-y-3">
          {commonQuestions.map((item, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <p className="font-medium text-foreground">{item.question}</p>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">{item.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="text-center py-8 border-t">
        <p className="text-sm text-muted-foreground">
          Still have questions? Reach out to Ivan for support.
        </p>
        <Link href="/guide" className="mt-4 inline-block">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="size-4" />
            Back to Main Guide
          </Button>
        </Link>
      </div>
    </div>
  )
}

import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  CircleDot,
  GitBranch,
  Route,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SectionPageHeader } from "@/components/ui/section-page-header"


const repreneurLifecycle = [
  { label: "Lead", note: "New or early relationship" },
  { label: "Qualified", note: "Worth active follow-up" },
  { label: "Client", note: "Working with Re-New" },
  { label: "To reactivate", note: "Paused but worth reopening" },
  { label: "Declined / Rejected", note: "Closed out of active work" },
]

const repreneurJourney = [
  { label: "Explorer", note: "Curious, early thinking" },
  { label: "Learner", note: "Building clarity and basics" },
  { label: "Ready", note: "Can engage serious targets" },
  { label: "Execution", note: "Actively moving on deals" },
  { label: "Post-acquisition", note: "After a completed acquisition" },
]

const opportunityLayers = [
  {
    title: "1. Availability",
    icon: BriefcaseBusiness,
    purpose: "Is the opportunity usable by the team?",
    values: ["Draft", "Active", "Paused", "Archived", "Closed"],
  },
  {
    title: "2. Match",
    icon: Users,
    purpose: "What is the relationship between one opportunity and one repreneur?",
    values: ["Draft", "Shortlisted", "Proposed", "Interested", "Declined", "Active pursuit", "Dropped"],
  },
  {
    title: "3. Pursuit",
    icon: GitBranch,
    purpose: "Where is the validated repreneur-deal path?",
    values: ["Interest", "Intermediary meeting", "Seller meeting", "LOI", "Closed", "Dropped"],
  },
  {
    title: "4. Journey",
    icon: Route,
    purpose: "The simple operating label shown to the team. It is derived from the first three layers.",
    values: ["Live in inventory", "Matching", "Proposed", "Interest received", "Active pursuit", "Seller meeting", "LOI", "Closed"],
  },
]

const opportunityJourney = [
  { label: "Draft", meaning: "Captured, not ready for use" },
  { label: "Live in inventory", meaning: "Active and available for matching" },
  { label: "Matching", meaning: "Repreneurs are being shortlisted internally" },
  { label: "Proposed", meaning: "Sent to one or more repreneurs" },
  { label: "Interest received", meaning: "A repreneur answered yes; staff review is needed" },
  { label: "Active pursuit", meaning: "One repreneur is validated as the live path" },
  { label: "Intermediary meeting", meaning: "Discussion with the M&A source or broker" },
  { label: "Seller meeting", meaning: "Repreneur is speaking with the seller side" },
  { label: "LOI", meaning: "Letter of intent stage" },
  { label: "Closed", meaning: "Deal completed" },
  { label: "Dropped", meaning: "Pursuit stopped" },
  { label: "Paused / Archived", meaning: "Parked or removed from active work" },
]

const platformMatchScoring = [
  { label: "Repreneur readiness", weight: "25", meaning: "Existing WHEN score: is this person ready to move on deals?" },
  { label: "Repreneur quality", weight: "20", meaning: "Existing WHO score: is this a strong enough operator profile?" },
  { label: "Sector fit", weight: "20", meaning: "Opportunity sector or activity versus repreneur target sectors." },
  { label: "Geography fit", weight: "15", meaning: "Opportunity location versus repreneur geographic preferences." },
  { label: "Deal size fit", weight: "15", meaning: "Opportunity size versus repreneur target deal size." },
  { label: "Risk flags", weight: "cap", meaning: "Unclear readiness, missing data, financial mismatch, or scoring flags limit confidence." },
]

function Flow({ items }: { items: { label: string; note?: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-stretch gap-2 pb-1">
        {items.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="flex min-h-24 w-44 flex-col justify-between rounded-md border bg-background p-3">
              <Badge variant="outline" className="w-fit">
                {index + 1}
              </Badge>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                {item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}
              </div>
            </div>
            {index < items.length - 1 && <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function LayerCard({
  title,
  purpose,
  values,
  icon: Icon,
}: {
  title: string
  purpose: string
  values: string[]
  icon: LucideIcon
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="rounded-md border bg-muted p-2 text-muted-foreground">
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
        <CardDescription>{purpose}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value} variant="secondary">
            {value}
          </Badge>
        ))}
      </CardContent>
    </Card>
  )
}

export default function GuidelinesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionPageHeader title="Guidelines" subtitle="The operating logic for repreneurs, opportunities, matching, and active deal progress" icon={BookOpenCheck} tone="neutral" />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-5 text-muted-foreground" />
              Repreneur lifecycle
            </CardTitle>
            <CardDescription>Commercial relationship status: how Re-New manages the person.</CardDescription>
          </CardHeader>
          <CardContent>
            <Flow items={repreneurLifecycle} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDot className="size-5 text-muted-foreground" />
              Repreneur readiness journey
            </CardTitle>
            <CardDescription>Acquisition maturity: how ready the repreneur is to move on deals.</CardDescription>
          </CardHeader>
          <CardContent>
            <Flow items={repreneurJourney} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-normal">Opportunity operating layers</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Opportunities have several statuses because the team needs to know different things: whether the deal is
            available, who it was proposed to, whether someone is pursuing it, and the simple journey label to show in
            tables.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {opportunityLayers.map((layer) => (
            <LayerCard key={layer.title} {...layer} />
          ))}
        </div>
      </section>

      <section id="platform-match-score" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-muted-foreground" />
              Platform match score
            </CardTitle>
            <CardDescription>How Wave creates the platform recommendation on an opportunity match.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="font-medium">The platform score is rule-based, not manually typed.</p>
              <p className="mt-1 text-muted-foreground">
                When staff saves a match between one repreneur and one opportunity, Wave calculates the platform
                recommendation, numeric score, and short reasons from the structured data already stored in the system.
                Staff judgment stays separate in the human recommendation and notes fields.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {platformMatchScoring.map((item) => (
                <div key={item.label} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.label}</p>
                    <Badge variant="outline">{item.weight}</Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">{item.meaning}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-4">
                <p className="font-medium">Recommendation bands</p>
                <div className="mt-3 space-y-2 text-muted-foreground">
                  <p>80-100: Strong fit</p>
                  <p>65-79: Possible fit</p>
                  <p>45-64: Weak fit</p>
                  <p>0-44: Not a fit</p>
                </div>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-medium">Confidence caps</p>
                <div className="mt-3 space-y-2 text-muted-foreground">
                  <p>WHEN score below 40 caps the match until readiness improves.</p>
                  <p>Missing sector, geography, score, or deal-size data limits confidence.</p>
                  <p>Clear financial mismatch or scoring flags prevent an inflated score.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Route className="size-5 text-muted-foreground" />
              Derived opportunity journey
            </CardTitle>
            <CardDescription>The label the team should see first in opportunity tables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {opportunityJourney.map((step) => (
              <div key={step.label} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[150px_1fr]">
                <Badge variant="outline" className="w-fit">
                  {step.label}
                </Badge>
                <p className="text-sm text-muted-foreground">{step.meaning}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-muted-foreground" />
              Rule of thumb
            </CardTitle>
            <CardDescription>What should be stored versus what should be shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="font-medium">Store the source facts.</p>
              <p className="mt-1 text-muted-foreground">
                Keep availability, match status, and pursuit stage as the source of truth. They describe different
                business facts and should not be merged.
              </p>
            </div>

            <div className="rounded-md border bg-muted/40 p-4">
              <p className="font-medium">Show the derived journey.</p>
              <p className="mt-1 text-muted-foreground">
                The opportunity journey is the user-facing summary. It should be calculated from the source facts so it
                cannot disagree with the workflow underneath.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="font-medium">Examples</p>
              <div className="space-y-2 text-muted-foreground">
                <p>Active opportunity with no matches: Live in inventory</p>
                <p>Shortlisted repreneurs: Matching</p>
                <p>Interested response waiting for staff: Interest received</p>
                <p>Active pursuit at seller meeting: Seller meeting</p>
                <p>Closed pursuit or closed opportunity: Closed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

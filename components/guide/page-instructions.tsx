"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { LayoutDashboard, Users, GitBranch, Compass, FileText, Mail } from "lucide-react"

// Helper to render text with **bold** and *italic* markdown syntax
function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return <em key={index} className="text-gray-700">{part.slice(1, -1)}</em>
    }
    return part
  })
}

const pages = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    content: `The Dashboard is your command center — a real-time overview of the entire repreneur pipeline.

**What you'll see:**
• **Pipeline Stats**: Total repreneurs broken down by status (Lead, Qualified, Client) with week-over-week comparison
• **Top Tier 1 Candidates**: Leads ranked by their automated questionnaire score — these are your best prospects to prioritize for interviews
• **Top Tier 2 Candidates**: Qualified repreneurs ranked by the manual star rating given after interviews
• **Conversion Funnel**: Visual flow from Lead → Qualified → Client showing conversion rates
• **Journey Stage Distribution**: Pie chart showing where repreneurs are in their acquisition readiness
• **Activity Stream**: Recent team activities (interviews, emails, meetings) across all repreneurs
• **Activity Heatmap**: GitHub-style heatmap showing daily activity over the past year
• **Trend Charts**: Weekly trends for new repreneurs and logged activities

**Pro tip:** Use this page to start your day — identify who needs follow-up and spot trends in the pipeline.`,
  },
  {
    id: "repreneurs",
    icon: Users,
    title: "Repreneurs",
    content: `The Repreneurs page is your master list of all contacts in the system, grouped by lifecycle status.

**Organization:**
• **Leads**: New contacts who submitted the intake form but haven't been interviewed yet. Shows their Tier 1 score.
• **Qualified**: Repreneurs who have been interviewed and given a Tier 2 star rating. Shows their star rating.
• **Clients**: Repreneurs with at least one active offer. Shows their assigned offers.
• **Rejected**: Contacts marked as not a fit (reversible).

**What you can do:**
• Click any row to open the full profile with all details, notes, activities, and offers
• Use the "+ New Repreneur" button to manually add someone (rare — most come via intake form)
• Search and filter to find specific contacts
• Each group is collapsible to focus on what matters

**Profile page features:**
• Edit any field inline by clicking on it
• View and add notes (tagged by type: call, email, meeting, other)
• Log activities with duration tracking
• See the Tier 1 radar chart showing scoring dimensions
• Set Tier 2 stars (automatically qualifies the lead)
• Assign offers (automatically makes them a client)`,
  },
  {
    id: "pipeline",
    icon: GitBranch,
    title: "Pipeline",
    content: `The Pipeline page shows the same repreneurs as a visual board, organized by status.

**Layout:**
• Four columns: Lead, Qualified, Client, Rejected
• Each card shows: name, avatar, key metrics (score or stars), and journey stage badge
• Cards are sorted by relevance within each column

**Key differences from Repreneurs page:**
• Visual, scannable view vs. detailed table
• Better for quick status overview and team standups
• Click any card to open the full profile

**Important:** Status changes are action-driven, not drag-and-drop. To move someone:
• Lead → Qualified: Set their Tier 2 star rating on their profile
• Qualified → Client: Assign them an offer
• Any → Rejected: Click the Reject button on their profile

This ensures data integrity — status always reflects real actions taken.`,
  },
  {
    id: "journey",
    icon: Compass,
    title: "Journey",
    content: `The Journey page tracks where repreneurs are in their acquisition readiness — independent of their status with Re-New.

**Journey Stages:**
1. **Explorer**: Just starting to think about acquisition, gathering information
2. **Learner**: Actively learning, attending workshops, building knowledge
3. **Ready**: Has clear investment thesis, actively looking for targets
4. **Serial Acquirer**: Has completed at least one acquisition, looking for the next

**Why this matters:**
• A repreneur can be a "Lead" in Re-New's pipeline but already "Ready" in their journey
• This helps prioritize who to focus on — a Ready lead is more urgent than an Explorer
• It informs which offer makes sense for each person

**How to use:**
• Set journey stage on the repreneur profile
• Use this page to see distribution and filter by stage
• The stage badge appears on profile cards throughout the platform`,
  },
  {
    id: "emails",
    icon: Mail,
    title: "Emails",
    content: `The Emails page is your command center for automated email communications with repreneurs.

**Email Cockpit:**
• View email analytics (opens, clicks, bounces)
• Browse email history with filters by type and status
• Enable/disable specific email templates
• Send manual emails to any repreneur

**Automated Email Triggers:**

**Intake Flow:**
• Welcome — when step 1 is completed
• Form Step Complete — after contact info captured
• Abandoned Reminder — 48h after abandonment (cron job)
• Thank You — when full form is completed
• High Score Alert — when Tier 1 score is 70+

**Offer Flow:**
• Offer Received — when an offer is assigned
• Offer Accepted — when client accepts
• Offer Activated — when engagement begins
• Milestone Completed — when any milestone is checked off

**Other:**
• Rejection — when marked as rejected

**GDPR Compliance:**
• Transactional emails (welcome, offers, rejection) always send
• Marketing emails check marketing_consent field first
• Abandoned reminders limited to 2 per repreneur

**Rate Limits (Free Tier):**
• 100 emails/day, 3,000 emails/month
• System tracks daily counts automatically`,
  },
  {
    id: "offers",
    icon: FileText,
    title: "Offers",
    content: `The Offers page manages Re-New's service packages and tracks which clients have which offers.

**Current Offers:**
• **Starter Pack** (~2,500€, 6 weeks): For less mature candidates starting their search
• **Deal Flow** (12-month contract, variable pricing): For candidates actively looking, includes curation and qualified introductions
• **Sparring Partner** (600€/month, 6 months): Subscription-based ongoing support

**What you can do:**
• View all offer packages and their details
• See which repreneurs have each offer assigned
• Create new offers or edit existing ones
• Track offer status: Offered → Active → Completed/Expired

**Milestones:**
Each active offer can have milestones — specific deliverables and checkpoints to track progress:
• **Deliverables**: Tangible outputs (e.g., "Investment thesis document completed")
• **Checkpoints**: Progress markers (e.g., "First interview conducted")

This helps track what's been delivered and what's remaining for each client engagement.`,
  },
]

export function PageInstructions() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Page-by-Page Guide</h2>
      <Accordion type="single" collapsible className="w-full">
        {pages.map((page) => (
          <AccordionItem key={page.id} value={page.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100">
                  <page.icon className="h-4 w-4 text-gray-600" />
                </div>
                <span className="font-medium">{page.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pl-12 pr-4 pb-2 text-sm text-gray-600 whitespace-pre-line">
                {renderFormattedText(page.content)}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

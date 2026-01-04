"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ArrowRight, Star, Target, Milestone } from "lucide-react"

const concepts = [
  {
    id: "lifecycle",
    icon: ArrowRight,
    title: "Repreneur Lifecycle (Lead → Qualified → Client)",
    content: `Every repreneur follows a lifecycle that reflects their relationship with Re-New:

**Lead**
• Entry point: Someone who submitted the intake form or was manually added
• No interview yet, no assessment from the team
• Has a Tier 1 score (automated from questionnaire answers)
• Action to advance: Complete an interview and set Tier 2 stars

**Qualified**
• The team has interviewed this person and assessed them
• Has both Tier 1 score and Tier 2 star rating
• Ready to potentially become a client
• Action to advance: Assign them an offer

**Client**
• Has at least one offer assigned (active or completed)
• This is where Re-New earns revenue
• Can have multiple offers over time
• Stays as client even after offers complete

**Rejected**
• Marked as not a fit for Re-New
• Reversible — can be un-rejected if circumstances change
• Keeps full history intact

**Key insight:** Status changes are automatic based on actions. This ensures the data always reflects reality.`,
  },
  {
    id: "journey",
    icon: Target,
    title: "Journey Stages (Explorer → Ready)",
    content: `Journey stage tracks where someone is in their personal acquisition journey — separate from their status with Re-New.

**Explorer**
• Just starting to consider acquisition as a path
• Gathering information, exploring the idea
• May need education before being ready to engage seriously

**Learner**
• Actively building knowledge and skills
• Attending workshops, reading, networking
• Developing their investment thesis

**Ready**
• Has a clear investment thesis and criteria
• Actively looking for targets
• Ready to engage seriously with Deal Flow

**Serial Acquirer**
• Has completed at least one acquisition
• Looking for the next opportunity
• Experienced, knows what they want

**Why both status and journey?**
A "Lead" in your pipeline might already be "Ready" in their journey (hot prospect!) or might be an "Explorer" (needs nurturing first). This helps prioritize outreach and choose the right offer.`,
  },
  {
    id: "scoring",
    icon: Star,
    title: "Scoring System (Tier 1 + Tier 2)",
    content: `Wave uses a two-tier scoring system to evaluate repreneurs:

**Tier 1: Automated Pre-Interview Score**
• Calculated automatically from questionnaire answers
• Evaluates: Experience, Leadership, M&A Knowledge, Readiness, Financial capacity
• Helps prioritize which leads to interview first
• Displayed as a percentage and radar chart on the profile
• Objective, consistent, no human input required

**Tier 2: Manual Post-Interview Assessment**
• Set by the team after interviewing the candidate
• Simple 1-5 star rating
• Reflects soft skills, leadership potential, cultural fit
• Setting any star rating automatically qualifies the lead
• Subjective human judgment layer

**How they work together:**
1. Lead comes in → Tier 1 score calculated automatically
2. Team reviews Tier 1 scores → prioritizes who to interview
3. After interview → Team sets Tier 2 stars
4. High Tier 2 candidates → prioritized for offer assignment

**Radar Chart Dimensions:**
• Experience (years in workforce, employment type, sector diversity)
• Leadership (team size managed, executive roles, board positions)
• M&A Knowledge (prior experience, involvement level)
• Readiness (journey stage, identified targets)
• Financial (investment capacity, funding strategy)`,
  },
  {
    id: "offers",
    icon: Milestone,
    title: "Offer Lifecycle & Milestones",
    content: `Offers are the core of Re-New's business model — they track paid engagements with clients.

**Offer Status Flow:**
1. **Offered**: Proposed to the client, awaiting acceptance
2. **Active**: Client accepted, engagement is ongoing
3. **Completed**: All deliverables finished, engagement successful
4. **Expired**: Offer not accepted within the validity period

**Offer Types:**
• **Starter Pack**: Short-term coaching for early-stage repreneurs (~6 weeks)
• **Deal Flow**: Active deal sourcing and introduction (12 months)
• **Sparring Partner**: Ongoing support subscription (6 months)

**Milestones:**
Each active offer can track specific milestones:

*Deliverables* — tangible outputs:
• Investment thesis document
• Target company profiles
• Due diligence reports
• Negotiation support materials

*Checkpoints* — progress markers:
• Kickoff meeting completed
• First target shortlist delivered
• LOI submitted
• Deal closed

**Why milestones matter:**
They help track what's been delivered vs. what's remaining, ensure nothing falls through the cracks, and provide visibility into the progress of each client engagement.`,
  },
]

export function CoreConcepts() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Core Concepts</h2>
      <Accordion type="single" collapsible className="w-full">
        {concepts.map((concept) => (
          <AccordionItem key={concept.id} value={concept.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <concept.icon className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-medium">{concept.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pl-12 pr-4 pb-2 text-sm text-gray-600 whitespace-pre-line">
                {concept.content}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

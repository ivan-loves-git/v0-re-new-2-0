import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KeyPrinciples } from "@/components/guide"
import { Target, Rocket, Users, TrendingUp, Heart } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"


export default function MissionPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionPageHeader title="Mission" subtitle="The operating intent and principles behind WAVE" icon={Target} tone="neutral" />

      <section className="grid gap-4 lg:grid-cols-2">

      {/* What is Wave? - Expanded */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="rounded-md border bg-muted p-2">
              <Target className="size-4 text-muted-foreground" />
            </span>
            What is Wave?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            <strong className="text-foreground">Wave is Re-New's internal management platform</strong> — built to replace
            Flatchr and give the team a purpose-built tool for managing repreneurs as long-term
            clients, not one-time candidates.
          </p>
          <p>
            Unlike a traditional ATS (Applicant Tracking System), Wave treats each repreneur as
            a relationship to nurture over time. A repreneur might start as a lead, become a
            qualified prospect after an interview, and eventually convert to a paying client
            across multiple offers.
          </p>
          <p>
            The platform is the <strong className="text-foreground">operational cockpit of Re-New</strong> — providing visibility
            into leads, active prospects, clients, and the full pipeline of activity.
          </p>
        </CardContent>
      </Card>

      {/* Why We Built This */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="rounded-md border bg-muted p-2">
              <Rocket className="size-4 text-muted-foreground" />
            </span>
            Why We Built This
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Re-New's business model is fundamentally different from traditional recruitment. You're not filling positions —
            you're building lasting relationships with entrepreneurs on their acquisition journey.
          </p>
          <p>
            <strong className="text-foreground">The problem with Flatchr:</strong> It was designed for one-time candidate processing.
            Once someone was "placed," the relationship ended. But repreneurs often need multiple touchpoints over months
            or years before they're ready to engage with Deal Flow or other services.
          </p>
          <p>
            <strong className="text-foreground">Wave's approach:</strong> Every repreneur has a single, persistent profile that
            tracks their entire journey — from initial contact through multiple offers and beyond. The system remembers
            every interaction, every note, and every milestone.
          </p>
        </CardContent>
      </Card>

      {/* Who It's For */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="rounded-md border bg-muted p-2">
              <Users className="size-4 text-muted-foreground" />
            </span>
            Who It's For
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Wave is built for the <strong className="text-foreground">Re-New team</strong> — Bertrand and the part-time collaborators
            who manage the repreneur pipeline day-to-day.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="font-medium text-foreground">Daily Users</p>
              <p className="text-xs mt-1">Review leads, conduct interviews, assign offers, log activities, track milestones</p>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="font-medium text-foreground">Weekly Reviews</p>
              <p className="text-xs mt-1">Pipeline standups, conversion analysis, activity heatmaps, trend monitoring</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The Vision */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="rounded-md border bg-muted p-2">
              <TrendingUp className="size-4 text-muted-foreground" />
            </span>
            The Vision
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Wave is the foundation. It solves the immediate operational needs: tracking repreneurs,
            managing offers, and providing pipeline visibility.
          </p>
          <p>
            <strong className="text-foreground">Future possibilities include:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Cost analytics per client (time tracking → ROI calculation)</li>
            <li>Automated email sequences based on journey stage</li>
            <li>Integration with external deal sourcing platforms</li>
            <li>Client-facing portal for document sharing and milestone tracking</li>
            <li>Advanced analytics and reporting dashboards</li>
          </ul>
          <p>
            The platform is designed to evolve with Re-New's needs — built with modern tools (Next.js, Supabase)
            that make it easy to extend and customize.
          </p>
        </CardContent>
      </Card>
      </section>

      {/* Key Principles */}
      <KeyPrinciples />

      {/* Footer */}
      <div className="border-t py-6 text-center text-sm text-muted-foreground">
        <p className="flex items-center justify-center gap-2">
          <Heart className="size-4 text-red-400" />
          Built with care for the Re-New team.
        </p>
      </div>
    </div>
  )
}

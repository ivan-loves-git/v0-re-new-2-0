import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KeyPrinciples } from "@/components/guide"
import { Target, Rocket, Users, TrendingUp, Heart } from "lucide-react"

export const revalidate = 3600 // Cache for 1 hour

export default function MissionPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">
          Mission
        </h1>
        <p className="text-gray-600 mt-2">
          The vision and principles behind Wave
        </p>
      </div>

      {/* What is Wave? - Expanded */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-blue-50">
              <Target className="h-4 w-4 text-blue-600" />
            </div>
            What is Wave?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600">
          <p>
            <strong className="text-gray-900">Wave is Re-New's internal management platform</strong> — built to replace
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
            The platform is the <strong className="text-gray-900">operational cockpit of Re-New</strong> — providing visibility
            into leads, active prospects, clients, and the full pipeline of activity.
          </p>
        </CardContent>
      </Card>

      {/* Why We Built This */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-purple-50">
              <Rocket className="h-4 w-4 text-purple-600" />
            </div>
            Why We Built This
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600">
          <p>
            Re-New's business model is fundamentally different from traditional recruitment. You're not filling positions —
            you're building lasting relationships with entrepreneurs on their acquisition journey.
          </p>
          <p>
            <strong className="text-gray-900">The problem with Flatchr:</strong> It was designed for one-time candidate processing.
            Once someone was "placed," the relationship ended. But repreneurs often need multiple touchpoints over months
            or years before they're ready to engage with Deal Flow or other services.
          </p>
          <p>
            <strong className="text-gray-900">Wave's approach:</strong> Every repreneur has a single, persistent profile that
            tracks their entire journey — from initial contact through multiple offers and beyond. The system remembers
            every interaction, every note, and every milestone.
          </p>
        </CardContent>
      </Card>

      {/* Who It's For */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-green-50">
              <Users className="h-4 w-4 text-green-600" />
            </div>
            Who It's For
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600">
          <p>
            Wave is built for the <strong className="text-gray-900">Re-New team</strong> — Bertrand and the part-time collaborators
            who manage the repreneur pipeline day-to-day.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">Daily Users</p>
              <p className="text-xs mt-1">Review leads, conduct interviews, assign offers, log activities, track milestones</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">Weekly Reviews</p>
              <p className="text-xs mt-1">Pipeline standups, conversion analysis, activity heatmaps, trend monitoring</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The Vision */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-amber-50">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            The Vision
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600">
          <p>
            Wave is the foundation. It solves the immediate operational needs: tracking repreneurs,
            managing offers, and providing pipeline visibility.
          </p>
          <p>
            <strong className="text-gray-900">Future possibilities include:</strong>
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

      {/* Key Principles */}
      <KeyPrinciples />

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 py-8 border-t">
        <p className="flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 text-red-400" />
          Built with care for the Re-New team.
        </p>
      </div>
    </div>
  )
}

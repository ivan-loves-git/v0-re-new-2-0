"use client"

import { motion } from "framer-motion"
import { Calendar, CheckCircle, Sparkles, Bug, Palette, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Roadmap events extracted from git history
// This captures the strategic development journey of Wave 1.0
const roadmapEvents = [
  {
    period: "Jan 4, 2026",
    title: "Polish & Consolidation",
    isCompleted: true,
    events: [
      {
        title: "Questionnaire forms consolidated",
        type: "refactor",
        description: "Eliminated ~1800 lines of duplicated code by sharing components between public intake and internal questionnaire. Both forms now use identical question definitions.",
      },
      {
        title: "Column alignment in Repreneurs table",
        type: "style",
        description: "Fixed column alignment across all status groups with fixed widths for consistent data display.",
      },
      {
        title: "Intake page standalone layout",
        type: "fix",
        description: "Public intake form now opens cleanly in its own tab without dashboard layout interference.",
      },
    ],
  },
  {
    period: "Jan 3, 2026",
    title: "Dashboard Redesign (Wave 1.0)",
    isCompleted: true,
    events: [
      {
        title: "Activity heatmap added",
        type: "feature",
        description: "GitHub-style heatmap showing 12 months of daily activity (new repreneurs + logged activities). Provides visual overview of team engagement patterns.",
      },
      {
        title: "Performance optimization with streaming",
        type: "feature",
        description: "Dashboard now loads in 3 independent streaming sections instead of blocking on all data. Parallel fetches and 30-second cache for fast navigation.",
      },
      {
        title: "Wave 1.0 branding",
        type: "feature",
        description: "Rebranded sidebar with 'Wave 1.0 - the repreneur CRM' and animated emoji. New 3-column dashboard layout with 12+ widgets.",
      },
      {
        title: "Tier rankings with pagination",
        type: "feature",
        description: "Top Tier 1 and Tier 2 candidates displayed with pagination (5 per page). Helps prioritize who to interview and who to convert.",
      },
      {
        title: "Conversion funnel visualization",
        type: "feature",
        description: "Lead → Qualified → Client funnel with conversion rates. Journey stage distribution pie chart. 'vs last week' comparisons for growth tracking.",
      },
    ],
  },
  {
    period: "Jan 2, 2026",
    title: "V1.0 Enhancements",
    isCompleted: true,
    events: [
      {
        title: "Offer milestones system",
        type: "feature",
        description: "Track specific deliverables and checkpoints for each client engagement. Milestones grouped by type (Deliverables vs Checkpoints) with completion tracking.",
      },
      {
        title: "Persona field added",
        type: "feature",
        description: "Categorize repreneurs by buyer type: First-time buyer, Serial acquirer, Corporate spin-off, Family succession. Helps tailor approach.",
      },
      {
        title: "Notes system redesign",
        type: "feature",
        description: "Note types (call, email, meeting, other) with icons and color coding. View dialogs for full content. Activity history also enhanced with view dialogs.",
      },
      {
        title: "Radar chart improvements",
        type: "fix",
        description: "Fixed scale to show actual max (~98 pts). Added raw score display in tooltips. Improved dimension descriptions showing questionnaire sources.",
      },
      {
        title: "Form field improvements",
        type: "feature",
        description: "Replaced free text with dropdowns: Investment Capacity, Sector Preferences (multi-select), Target Acquisition Size, Target Location (French regions).",
      },
    ],
  },
  {
    period: "Jan 1, 2026",
    title: "UI/UX Polish Sprint",
    isCompleted: true,
    events: [
      {
        title: "Skeleton loading screens",
        type: "feature",
        description: "Added loading skeletons for all dashboard pages. Loading states match actual layouts for seamless transitions.",
      },
      {
        title: "Page transition animations",
        type: "feature",
        description: "Framer Motion fade/slide animations between routes. Animated sidebar active indicator. Smooth, polished navigation feel.",
      },
      {
        title: "Toast notifications",
        type: "feature",
        description: "Sonner toast library integration. Success/error feedback for all CRUD operations. Positioned bottom-right with auto-dismiss.",
      },
      {
        title: "Optimistic UI updates",
        type: "feature",
        description: "Inline edits feel instant. UI updates immediately, then syncs with server. Automatic rollback on errors.",
      },
      {
        title: "Candidate radar chart",
        type: "feature",
        description: "Spider chart visualizing Tier 1 scoring across 5 dimensions: Experience, Leadership, M&A Knowledge, Readiness, Financial.",
      },
      {
        title: "Notion-style avatars",
        type: "style",
        description: "Replaced gradient avatars with 16 Notion face illustrations. More cohesive, modern visual language.",
      },
    ],
  },
  {
    period: "Dec 30, 2025",
    title: "Core Platform Build",
    isCompleted: true,
    events: [
      {
        title: "Scoring system (Tier 1 + Tier 2)",
        type: "feature",
        description: "Tier 1 automated scoring from 15 questionnaire questions with category breakdown. Tier 2 manual 1-5 star rating after interviews. Action-driven status transitions.",
      },
      {
        title: "Journey stage tracking",
        type: "feature",
        description: "Visual progression: Explorer → Learner → Ready → Serial Acquirer. Tracks repreneur maturity independent of pipeline status.",
      },
      {
        title: "Offer management system",
        type: "feature",
        description: "CRUD for offer packages. Assignment to repreneurs with status tracking (offered → active → completed/expired). Auto-client status on assignment.",
      },
      {
        title: "Notes system with optimistic updates",
        type: "feature",
        description: "Add/delete notes with author tracking. Chronological display. useOptimistic hook for instant feedback.",
      },
      {
        title: "Pipeline and list views",
        type: "feature",
        description: "Kanban converted to action-driven static pipeline. List view with status grouping, collapsible sections, and status-specific columns.",
      },
      {
        title: "Avatar system",
        type: "feature",
        description: "24 default avatars with deterministic assignment. Custom photo upload via Supabase Storage. Size variants and edit dialog.",
      },
    ],
  },
  {
    period: "Dec 27, 2025",
    title: "Foundation",
    isCompleted: true,
    events: [
      {
        title: "Next.js + Supabase setup",
        type: "feature",
        description: "Initialized project with V0, configured Supabase client, auth context, and Vercel deployment. Foundation for the entire platform.",
      },
      {
        title: "Authentication system",
        type: "feature",
        description: "Email/password auth with Supabase for 3 team members. Login page, protected routes, session persistence.",
      },
      {
        title: "Database schema",
        type: "feature",
        description: "Repreneur, Offer, Note, Activity tables with relationships and Row Level Security. Multiple migrations for scoring, avatars, questionnaire fields.",
      },
      {
        title: "Repreneur list and detail views",
        type: "feature",
        description: "Table with sorting/filtering. Detail page with inline editing. Editable text, select, and multi-select field components.",
      },
    ],
  },
]

const typeConfig = {
  feature: { icon: Sparkles, color: "text-blue-600", bgColor: "bg-blue-50", label: "Feature" },
  fix: { icon: Bug, color: "text-green-600", bgColor: "bg-green-50", label: "Fix" },
  style: { icon: Palette, color: "text-purple-600", bgColor: "bg-purple-50", label: "Style" },
  refactor: { icon: RefreshCw, color: "text-amber-600", bgColor: "bg-amber-50", label: "Refactor" },
}

export function DevelopmentRoadmap() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Development Roadmap</h2>
        <p className="text-sm text-gray-500 mt-1">
          The strategic journey of Wave 1.0 — what we built and why
        </p>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-blue-200" />

        {roadmapEvents.map((period, index) => (
          <motion.div
            key={index}
            className="relative pl-10 pb-8 last:pb-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            {/* Timeline dot */}
            <div className="absolute left-0 w-6 h-6 rounded-full bg-blue-500 border-4 border-white shadow-sm" />

            {/* Period card */}
            <Card className="overflow-hidden border-blue-100 py-0 gap-0">
              <CardContent className="p-0">
                <div className="p-4 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs bg-white">
                        <Calendar className="w-3 h-3 mr-1" />
                        {period.period}
                      </Badge>
                      {period.isCompleted && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {period.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {period.events.length} updates
                    </p>
                  </div>
                </div>

                <div className="px-3 pb-3 pt-2 border-t border-blue-100 space-y-2">
                  {period.events.map((event, i) => {
                    const config = typeConfig[event.type as keyof typeof typeConfig]
                    const Icon = config.icon
                    return (
                      <motion.div
                        key={i}
                        className="flex gap-2.5 py-2 px-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                      >
                        <div className={`p-1.5 rounded-md ${config.bgColor} h-fit`}>
                          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 text-sm">
                              {event.title}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {event.description}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlatformGoal, KeyPrinciples, PageInstructions, CoreConcepts, DevelopmentRoadmap } from "@/components/guide"
import { ArrowRight, Workflow, HelpCircle } from "lucide-react"

export const revalidate = 3600 // Cache for 1 hour

export default function GuidePage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">
          Wave Guide
        </h1>
        <p className="text-gray-600 mt-2">
          Everything you need to know about using the Wave 1.0 platform
        </p>
      </div>

      {/* Platform Goal */}
      <PlatformGoal />

      {/* Detailed Guide CTAs */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-blue-50">
                <Workflow className="h-4 w-4 text-blue-600" />
              </div>
              Common Workflows
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Step-by-step guides for processing leads, managing clients, and running weekly pipeline reviews.
            </p>
            <Link href="/guide/details#workflows">
              <Button className="gap-2">
                View Workflows
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-amber-50">
                <HelpCircle className="h-4 w-4 text-amber-600" />
              </div>
              FAQ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Answers to common questions about status changes, scoring, rejections, and time tracking.
            </p>
            <Link href="/guide/details#faq">
              <Button variant="outline" className="gap-2">
                View FAQ
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Page Instructions */}
      <PageInstructions />

      {/* Core Concepts */}
      <CoreConcepts />

      {/* Key Principles */}
      <KeyPrinciples />

      {/* Development Roadmap */}
      <DevelopmentRoadmap />

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 py-8 border-t">
        <p>
          Built with care for the Re-New team.
        </p>
        <p className="mt-1">
          Questions? Reach out to Ivan or check the roadmap for upcoming features.
        </p>
      </div>
    </div>
  )
}

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageInstructions, CoreConcepts } from "@/components/guide"
import { ArrowRight, Workflow, HelpCircle } from "lucide-react"

export const revalidate = 3600 // Cache for 1 hour

export default function InstructionsPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">
          Instructions
        </h1>
        <p className="text-gray-600 mt-2">
          How to use the Wave 1.0 platform effectively
        </p>
      </div>

      {/* Workflows and FAQ CTAs */}
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
              <Button className="gap-2">
                View FAQ
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Page-by-Page Guide */}
      <PageInstructions />

      {/* Core Concepts */}
      <CoreConcepts />

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 py-8 border-t">
        <p>
          Need more help? Check the <Link href="/guide" className="text-blue-600 hover:underline">Mission</Link> page
          for the vision behind Wave, or the <Link href="/guide/roadmap" className="text-blue-600 hover:underline">Roadmap</Link> for
          what's been built.
        </p>
      </div>
    </div>
  )
}

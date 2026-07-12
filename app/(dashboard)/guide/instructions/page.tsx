import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageInstructions, CoreConcepts } from "@/components/guide"
import { ArrowRight, Workflow, HelpCircle } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"


export default function InstructionsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionPageHeader title="Instructions" subtitle="Practical guidance for using WAVE consistently" icon={Workflow} tone="neutral" />

      {/* Workflows and FAQ CTAs */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="rounded-md border bg-muted p-2">
                <Workflow className="size-4 text-muted-foreground" />
              </span>
              Common Workflows
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-5 text-muted-foreground">
              Step-by-step guides for processing leads, managing clients, and running weekly pipeline reviews.
            </p>
            <Link href="/guide/details#workflows">
              <Button className="gap-2">
                View Workflows
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="rounded-md border bg-muted p-2">
                <HelpCircle className="size-4 text-muted-foreground" />
              </span>
              FAQ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-5 text-muted-foreground">
              Answers to common questions about status changes, scoring, rejections, and time tracking.
            </p>
            <Link href="/guide/details#faq">
              <Button className="gap-2">
                View FAQ
                <ArrowRight className="size-4" />
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
      <div className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>
          Need more help? Check the <Link href="/guide" className="text-blue-600 hover:underline">Mission</Link> page
          for the vision behind Wave, or the <Link href="/guide/roadmap" className="text-blue-600 hover:underline">Roadmap</Link> for
          what's been built.
        </p>
      </div>
    </div>
  )
}

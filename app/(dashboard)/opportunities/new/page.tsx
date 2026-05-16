import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OpportunityForm } from "@/components/opportunities/opportunity-form"
import { createOpportunity } from "@/lib/actions/opportunities"

export default function NewOpportunityPage() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/opportunities">
          <ArrowLeft className="size-4" />
          Back to Opportunities
        </Link>
      </Button>

      <OpportunityForm action={createOpportunity} submitLabel="Create opportunity" />
    </div>
  )
}

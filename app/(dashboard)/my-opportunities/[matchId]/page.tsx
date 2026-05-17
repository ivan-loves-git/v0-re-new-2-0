import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RepreneurOpportunityDetail } from "@/components/opportunities/repreneur-opportunity-detail"
import { getMyRepreneurOpportunity } from "@/lib/actions/repreneur-opportunities"

export const revalidate = 30

export default async function MyOpportunityDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const opportunity = await getMyRepreneurOpportunity(matchId)

  if (!opportunity) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/my-opportunities">
          <ArrowLeft data-icon="inline-start" />
          Back to My Opportunities
        </Link>
      </Button>

      <RepreneurOpportunityDetail opportunity={opportunity} />
    </div>
  )
}

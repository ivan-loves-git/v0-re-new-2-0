import { notFound } from "next/navigation"
import { connection } from "next/server"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RepreneurOpportunityDetail } from "@/components/opportunities/repreneur-opportunity-detail"
import { getMyRepreneurOpportunity } from "@/lib/actions/repreneur-opportunities"


export default async function PortalDealDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  await connection()
  const { matchId } = await params
  const opportunity = await getMyRepreneurOpportunity(matchId)

  if (!opportunity) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="w-fit">
        <Link href="/portal/deals">
          <ArrowLeft data-icon="inline-start" />
          Back to deals
        </Link>
      </Button>
      <RepreneurOpportunityDetail opportunity={opportunity} />
    </div>
  )
}

import { connection } from "next/server"
import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import { listMyRepreneurOpportunities } from "@/lib/actions/repreneur-opportunities"
import { BriefcaseBusiness } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"


export default async function PortalDealsPage() {
  await connection()
  const { repreneur, opportunities } = await listMyRepreneurOpportunities()

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader title="Your deals" subtitle="Anonymized opportunities selected for you by the Re-New team" icon={BriefcaseBusiness} tone="opportunity" />
      <RepreneurOpportunityList repreneur={repreneur} opportunities={opportunities} />
    </div>
  )
}

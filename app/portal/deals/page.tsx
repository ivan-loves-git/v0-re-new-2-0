import { connection } from "next/server"
import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import { listMyRepreneurOpportunities } from "@/lib/actions/repreneur-opportunities"


export default async function PortalDealsPage() {
  await connection()
  const { repreneur, opportunities } = await listMyRepreneurOpportunities()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Deals</h1>
        <p className="text-sm text-muted-foreground">Anonymized opportunities selected by the Re-New team.</p>
      </div>
      <RepreneurOpportunityList repreneur={repreneur} opportunities={opportunities} />
    </div>
  )
}

import { connection } from "next/server"
import { PortalDealsContent } from "@/components/portal/portal-deals-content"
import { listMyRepreneurDealFlow } from "@/lib/actions/repreneur-opportunities"
import { parseRepreneurDealSort } from "@/lib/utils/repreneur-deal-flow"

interface PortalDealsPageProps {
  searchParams: Promise<{ sort?: string }>
}

export default async function PortalDealsPage({ searchParams }: PortalDealsPageProps) {
  await connection()
  const params = await searchParams
  const sort = parseRepreneurDealSort(params.sort)
  const result = await listMyRepreneurDealFlow(sort)
  return <PortalDealsContent result={result} sort={sort} />
}

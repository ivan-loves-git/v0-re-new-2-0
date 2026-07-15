import { connection } from "next/server"
import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import { listMyRepreneurOpportunities } from "@/lib/actions/repreneur-opportunities"
import { getMyRepreneurProfile } from "@/lib/actions/repreneur-profile"


export default async function PortalProfilePage() {
  await connection()
  const [repreneur, { opportunities }] = await Promise.all([
    getMyRepreneurProfile(),
    listMyRepreneurOpportunities(),
  ])

  return <RepreneurProfileSummary repreneur={repreneur} opportunities={opportunities} />
}

import { connection } from "next/server"
import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import { listMyRepreneurOpportunities } from "@/lib/actions/repreneur-opportunities"
import { getMyRepreneurProfile } from "@/lib/actions/repreneur-profile"
import { getMyDiscoveryDigestOptOut } from "@/lib/actions/discovery-digest"
import { DiscoveryDigestOptOut } from "@/components/portal/discovery-digest-opt-out"


export default async function PortalProfilePage() {
  await connection()
  const [repreneur, { opportunities }, optedOut] = await Promise.all([
    getMyRepreneurProfile(),
    listMyRepreneurOpportunities(),
    getMyDiscoveryDigestOptOut(),
  ])

  return <div className="flex flex-col gap-6">
    <RepreneurProfileSummary repreneur={repreneur} opportunities={opportunities} />
    {repreneur ? <DiscoveryDigestOptOut optedOut={optedOut} /> : null}
  </div>
}

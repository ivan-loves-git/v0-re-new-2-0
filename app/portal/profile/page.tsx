import { connection } from "next/server"
import { PortalProfileContent } from "@/components/portal/portal-profile-content"
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

  return <PortalProfileContent repreneur={repreneur} opportunities={opportunities}
    accountPreferences={<DiscoveryDigestOptOut optedOut={optedOut} />} />
}

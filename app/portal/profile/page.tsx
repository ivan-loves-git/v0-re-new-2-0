import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import { getMyRepreneurProfile } from "@/lib/actions/repreneur-profile"

export const dynamic = "force-dynamic"

export default async function PortalProfilePage() {
  const { repreneur, leadershipAssessment } = await getMyRepreneurProfile()

  return <RepreneurProfileSummary repreneur={repreneur} leadershipAssessment={leadershipAssessment} />
}

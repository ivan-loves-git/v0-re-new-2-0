import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import { getMyRepreneurProfile } from "@/lib/actions/repreneur-profile"

export const revalidate = 30

export default async function PortalProfilePage() {
  const { repreneur, leadershipAssessment } = await getMyRepreneurProfile()

  return <RepreneurProfileSummary repreneur={repreneur} leadershipAssessment={leadershipAssessment} />
}

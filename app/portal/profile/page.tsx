import { connection } from "next/server"
import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import { getMyRepreneurProfile } from "@/lib/actions/repreneur-profile"


export default async function PortalProfilePage() {
  await connection()
  const { repreneur, leadershipAssessment } = await getMyRepreneurProfile()

  return <RepreneurProfileSummary repreneur={repreneur} leadershipAssessment={leadershipAssessment} />
}

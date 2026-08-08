import { notFound } from "next/navigation"
import { MaFirmIndicatorDetail } from "@/components/opportunities/ma-relationship-indicator-detail"
import { getMaRelationshipWorkspace } from "@/lib/actions/ma-relationships"

export default async function MaFirmIndicatorPage({
  params,
}: {
  params: Promise<{ firmId: string }>
}) {
  const { firmId } = await params
  const workspace = await getMaRelationshipWorkspace()
  const firm = workspace.firms.find((candidate) => candidate.id === firmId)

  if (!firm) notFound()

  return (
    <MaFirmIndicatorDetail
      firm={firm}
      offices={workspace.offices.filter((office) => office.firmId === firm.id)}
    />
  )
}

import { notFound } from "next/navigation"
import { MaOfficeIndicatorDetail } from "@/components/opportunities/ma-relationship-indicator-detail"
import { getMaRelationshipWorkspace } from "@/lib/actions/ma-relationships"

export default async function MaOfficeIndicatorPage({
  params,
}: {
  params: Promise<{ officeId: string }>
}) {
  const { officeId } = await params
  const workspace = await getMaRelationshipWorkspace()
  const office = workspace.offices.find(
    (candidate) => candidate.id === officeId,
  )

  if (!office) notFound()

  return (
    <MaOfficeIndicatorDetail
      office={office}
      firm={workspace.firms.find((firm) => firm.id === office.firmId) ?? null}
    />
  )
}

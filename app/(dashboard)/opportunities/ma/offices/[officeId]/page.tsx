import { notFound } from "next/navigation"
import { MaOfficeWorkspaceDetail } from "@/components/opportunities/ma-relationship-workspace-detail"
import { getMaOfficeWorkspace } from "@/lib/actions/ma-relationship-workspaces"
import { isUuid } from "@/lib/uuid"

export default async function MaOfficeWorkspacePage({
  params,
}: {
  params: Promise<{ officeId: string }>
}) {
  const { officeId } = await params
  if (!isUuid(officeId)) notFound()
  const workspace = await getMaOfficeWorkspace(officeId)
  if (!workspace) notFound()
  return <MaOfficeWorkspaceDetail workspace={workspace} />
}

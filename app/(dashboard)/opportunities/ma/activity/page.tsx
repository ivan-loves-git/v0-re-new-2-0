import { MaRelationshipWorkspace } from "@/components/opportunities/ma-relationship-workspace"
import { getMaRelationshipWorkspace } from "@/lib/actions/ma-relationships"

export default async function MaActivityPage() {
  const workspace = await getMaRelationshipWorkspace()
  return <MaRelationshipWorkspace workspace={workspace} initialView="timeline" />
}

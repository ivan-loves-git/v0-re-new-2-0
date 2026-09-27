import { connection } from "next/server"
import { PortalPursuitsContent } from "@/components/portal/portal-pursuits-content"
import { listExternalPursuitBoard } from "@/lib/actions/external-pursuits"
import { getExternalPursuitAttachmentMap } from "@/lib/actions/external-pursuit-attachments"
import { listPortalReNewPursuitBoard } from "@/lib/actions/external-pursuit-board"

export default async function PortalPursuitsPage() {
  await connection()
  const [external, renew] = await Promise.all([listExternalPursuitBoard(), listPortalReNewPursuitBoard()])
  const attachmentsByPursuit = await getExternalPursuitAttachmentMap(external.map((record) => record.id))
  return <PortalPursuitsContent external={external} renew={renew} attachmentsByPursuit={attachmentsByPursuit} />
}

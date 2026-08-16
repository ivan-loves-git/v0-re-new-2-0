import { connection } from "next/server"
import { BriefcaseBusiness } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { ExternalPursuitBoard } from "@/components/pursuits/external-pursuit-board"
import { listExternalPursuitBoard } from "@/lib/actions/external-pursuits"
import { getExternalPursuitAttachmentMap } from "@/lib/actions/external-pursuit-attachments"
import { listExternalPursuitOwners, listStaffReNewPursuitBoard } from "@/lib/actions/external-pursuit-board"

export default async function StaffPursuitsPage() {
  await connection()
  const [external, renew, owners] = await Promise.all([listExternalPursuitBoard(), listStaffReNewPursuitBoard(), listExternalPursuitOwners()])
  const attachmentsByPursuit = await getExternalPursuitAttachmentMap(external.map((record) => record.id))
  return <div className="flex flex-col gap-6">
    <SectionPageHeader title="Pursuits" subtitle="External dossiers and read-only canonical Re-New journey context" icon={BriefcaseBusiness} tone="opportunity" />
    <ExternalPursuitBoard external={external} renew={renew} attachmentsByPursuit={attachmentsByPursuit} isStaff owners={owners} />
  </div>
}

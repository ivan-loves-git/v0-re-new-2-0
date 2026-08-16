import { connection } from "next/server"
import { BriefcaseBusiness } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { ExternalPursuitBoard } from "@/components/pursuits/external-pursuit-board"
import { listExternalPursuitBoard } from "@/lib/actions/external-pursuits"
import { listExternalPursuitOwners, listStaffReNewPursuitBoard } from "@/lib/actions/external-pursuit-board"

export default async function StaffPursuitsPage() {
  await connection()
  const [external, renew, owners] = await Promise.all([listExternalPursuitBoard(), listStaffReNewPursuitBoard(), listExternalPursuitOwners()])
  return <div className="flex flex-col gap-6">
    <SectionPageHeader title="Pursuits" subtitle="External dossiers and read-only canonical Re-New journey context" icon={BriefcaseBusiness} tone="opportunity" />
    <ExternalPursuitBoard external={external} renew={renew} isStaff owners={owners} />
  </div>
}

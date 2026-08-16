import { connection } from "next/server"
import { BriefcaseBusiness } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { ExternalPursuitBoard } from "@/components/pursuits/external-pursuit-board"
import { listExternalPursuitBoard } from "@/lib/actions/external-pursuits"
import { listPortalReNewPursuitBoard } from "@/lib/actions/external-pursuit-board"

export default async function PortalPursuitsPage() {
  await connection()
  const [external, renew] = await Promise.all([listExternalPursuitBoard(), listPortalReNewPursuitBoard()])
  return <div className="flex flex-col gap-6">
    <SectionPageHeader title="Your pursuits" subtitle="Your independent external dossiers alongside a read-only view of active Re-New journeys" icon={BriefcaseBusiness} tone="opportunity" />
    <ExternalPursuitBoard external={external} renew={renew} isStaff={false} />
  </div>
}

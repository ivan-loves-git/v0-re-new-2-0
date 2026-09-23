import { connection } from "next/server"
import { BriefcaseBusiness } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { StaffPursuitsWorkspace } from "@/components/pursuits/staff-pursuits-workspace"
import { listExternalPursuitBoard } from "@/lib/actions/external-pursuits"
import { getExternalPursuitAttachmentMap } from "@/lib/actions/external-pursuit-attachments"
import { listExternalPursuitOwners, listStaffReNewPursuitBoards } from "@/lib/actions/external-pursuit-board"
import { listUnconvertedExternalPursuitIds } from "@/lib/actions/external-pursuit-conversion"
import { listMaOfficeIntakeOptions, listOpportunityGeographyOptions } from "@/lib/actions/opportunity-intake"

export default async function StaffPursuitsPage() {
  await connection()
  const [external, renew, owners] = await Promise.all([listExternalPursuitBoard(), listStaffReNewPursuitBoards(), listExternalPursuitOwners()])
  const [attachmentsByPursuit, conversionPursuitIds, conversionOfficeOptions, conversionGeographyOptions] = await Promise.all([
    getExternalPursuitAttachmentMap(external.map((record) => record.id)),
    listUnconvertedExternalPursuitIds(external.map((record) => record.id)),
    listMaOfficeIntakeOptions(),
    listOpportunityGeographyOptions(),
  ])
  return <div className="flex min-w-0 flex-col gap-6">
    <SectionPageHeader title="Pursuits" subtitle="Follow each Re-New pursuit and manage external dossiers" icon={BriefcaseBusiness} tone="opportunity" />
    <StaffPursuitsWorkspace renew={renew.macro} externalReNewContext={renew.externalContext} external={external} attachmentsByPursuit={attachmentsByPursuit} owners={owners} conversionPursuitIds={conversionPursuitIds} conversionOfficeOptions={conversionOfficeOptions} conversionGeographyOptions={conversionGeographyOptions} />
  </div>
}

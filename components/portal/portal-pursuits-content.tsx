"use client"

import { BriefcaseBusiness } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { ExternalPursuitBoard } from "@/components/pursuits/external-pursuit-board"
import { useUiCopy } from "@/components/i18n/ui-text"
import type { ReNewPursuitBoardRecord } from "@/lib/actions/external-pursuit-board"
import type { ExternalPursuitAttachment } from "@/lib/external-pursuit-attachments"
import type { ExternalPursuitBoardRecord } from "@/lib/types/external-pursuit"

export function PortalPursuitsContent({ external, renew, attachmentsByPursuit }: {
  external: ExternalPursuitBoardRecord[]
  renew: ReNewPursuitBoardRecord[]
  attachmentsByPursuit: Record<string, ExternalPursuitAttachment[]>
}) {
  const copy = useUiCopy()
  return <div className="flex flex-col gap-6">
    <SectionPageHeader title={copy("Your pursuits")} subtitle={copy("Your independent external dossiers alongside a read-only view of active Re-New journeys")} icon={BriefcaseBusiness} tone="opportunity" />
    <ExternalPursuitBoard external={external} renew={renew} attachmentsByPursuit={attachmentsByPursuit} isStaff={false} />
  </div>
}

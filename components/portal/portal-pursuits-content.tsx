"use client"

import Link from "next/link"
import { BriefcaseBusiness } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { Button } from "@/components/ui/button"
import { ExternalPursuitBoard } from "@/components/pursuits/external-pursuit-board"
import { RepreneurPursuitWorkspace, type SidebarDeal } from "@/components/portal/repreneur-pursuit-workspace"
import { useUiCopy } from "@/components/i18n/ui-text"
import type { PortalDealAction } from "@/lib/data/current-pursuit"
import type { ExternalPursuitAttachment } from "@/lib/external-pursuit-attachments"
import type { ExternalPursuitBoardRecord } from "@/lib/types/external-pursuit"

export function PortalPursuitsContent({ view, deals, actions, responseAsOf, initialQuery, initialStatus, external, attachmentsByPursuit }: {
  view: "renew" | "external"
  deals: SidebarDeal[]
  actions: Record<string, PortalDealAction>
  responseAsOf: string
  initialQuery?: string
  initialStatus?: "all" | "active" | "awaiting" | "ended"
  external: ExternalPursuitBoardRecord[]
  attachmentsByPursuit: Record<string, ExternalPursuitAttachment[]>
}) {
  const copy = useUiCopy()
  return <div className="flex flex-col gap-6">
    <SectionPageHeader title={copy("Your pursuits")} subtitle={copy("Your Re-New matches and current discussions.")} icon={BriefcaseBusiness} tone="opportunity" />
    <nav aria-label={copy("Pursuit spaces")} className="flex flex-wrap gap-2">
      <Button asChild variant={view === "renew" ? "default" : "outline"} size="sm"><Link href="/portal/pursuits" aria-current={view === "renew" ? "page" : undefined}>{copy("Re-New Pursuits")}</Link></Button>
      <Button asChild variant={view === "external" ? "default" : "outline"} size="sm"><Link href="/portal/pursuits?view=external" aria-current={view === "external" ? "page" : undefined}>{copy("External Pursuits")}</Link></Button>
    </nav>
    {view === "renew"
      ? <RepreneurPursuitWorkspace opportunity={null} deals={deals} actions={actions} journey={null}
          responseAsOf={responseAsOf} initialQuery={initialQuery} initialStatus={initialStatus} returnHref="/portal/pursuits" />
      : <ExternalPursuitBoard external={external} renew={[]} attachmentsByPursuit={attachmentsByPursuit} isStaff={false} />}
  </div>
}

"use client"

import { useRouter } from "next/navigation"
import { createPortalPreviewSectionHref, type PortalPreviewSection } from "@/lib/portal-preview-routes"
import { Button } from "@/components/ui/button"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUiCopy } from "@/components/i18n/ui-text"

export function StaffPortalPreviewAreas({ repreneurId, workspaceId }: { repreneurId: string; workspaceId?: string | null }) {
  const copy = useUiCopy()
  const router = useRouter()
  const prefetch = (section: PortalPreviewSection) => router.prefetch(createPortalPreviewSectionHref(repreneurId, section, workspaceId))
  return <div className="flex flex-wrap items-center gap-2"><TabsList aria-label={copy("Selected repreneur portal areas")}>
    <TabsTrigger value="deals" onMouseEnter={() => prefetch("deals")} onFocus={() => prefetch("deals")}>{copy("Deals")}</TabsTrigger>
    <TabsTrigger value="profile" onMouseEnter={() => prefetch("profile")} onFocus={() => prefetch("profile")}>{copy("Profile")}</TabsTrigger>
    <TabsTrigger value="renew-pursuits" onMouseEnter={() => prefetch("renew-pursuits")} onFocus={() => prefetch("renew-pursuits")}>{copy("Re-New Pursuits")}</TabsTrigger>
    <TabsTrigger value="external-pursuits" onMouseEnter={() => prefetch("external-pursuits")} onFocus={() => prefetch("external-pursuits")}>{copy("External Pursuits")}</TabsTrigger>
  </TabsList>
    <Button variant="ghost" size="sm" disabled title={copy("Account preferences and feedback can only be submitted by the repreneur in their own portal.")}>
      {copy("Share feedback")} — {copy("Unavailable in staff preview")}
    </Button>
  </div>
}

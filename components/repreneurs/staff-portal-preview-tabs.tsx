"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Tabs } from "@/components/ui/tabs"
import { createPortalPreviewSectionHref, type PortalPreviewSection } from "@/lib/portal-preview-routes"

export function StaffPortalPreviewTabs({
  repreneurId,
  workspaceId,
  section,
  children,
}: {
  repreneurId: string
  workspaceId?: string | null
  section: PortalPreviewSection
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <Tabs
      value={section}
      onValueChange={(value) => router.push(createPortalPreviewSectionHref(repreneurId, value as PortalPreviewSection, workspaceId))}
      className="flex min-w-0 flex-col gap-5"
    >
      {children}
    </Tabs>
  )
}

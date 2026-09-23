"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Tabs } from "@/components/ui/tabs"
import { createPortalPreviewSectionHref, type PortalPreviewSection } from "@/lib/portal-preview-routes"

export function StaffPortalPreviewTabs({
  repreneurId,
  section,
  children,
}: {
  repreneurId: string
  section: PortalPreviewSection
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <Tabs
      value={section}
      onValueChange={(value) => router.push(createPortalPreviewSectionHref(repreneurId, value as PortalPreviewSection))}
      className="flex min-w-0 flex-col gap-5"
    >
      {children}
    </Tabs>
  )
}

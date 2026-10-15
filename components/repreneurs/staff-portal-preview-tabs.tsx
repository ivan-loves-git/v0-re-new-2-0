"use client"

import { useTransition, type ReactNode } from "react"
import { useUiCopy } from "@/components/i18n/ui-text"
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
  const copy = useUiCopy()
  const [pending, startTransition] = useTransition()
  return (
    <Tabs
      value={section}
      onValueChange={(value) => startTransition(() => router.push(createPortalPreviewSectionHref(repreneurId, value as PortalPreviewSection, workspaceId)))}
      aria-busy={pending}
      className="flex min-w-0 flex-col gap-5"
    >
      {pending ? <p role="status" className="text-sm text-muted-foreground">{copy("Loading…")}</p> : null}
      {children}
    </Tabs>
  )
}

import type React from "react"
import { requirePortalAccess } from "@/lib/access-control"
import { PortalShell } from "@/components/portal/portal-shell"

export const dynamic = "force-dynamic"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requirePortalAccess()

  return (
    <PortalShell userEmail={user.email} userName={user.name}>
      {children}
    </PortalShell>
  )
}

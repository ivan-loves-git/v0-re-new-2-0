import type React from "react"
import { Suspense } from "react"
import { requirePortalAccess } from "@/lib/access-control"
import { PortalShell } from "@/components/portal/portal-shell"
import { WaveTelemetryIdentity } from "@/lib/telemetry/provider"

async function PortalGate({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requirePortalAccess()

  return (
    <>
      <WaveTelemetryIdentity userId={user.id} role="repreneur" />
      <PortalShell userEmail={user.email} userName={user.name}>
        {children}
      </PortalShell>
    </>
  )
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <Suspense fallback={null}><PortalGate>{children}</PortalGate></Suspense>
}

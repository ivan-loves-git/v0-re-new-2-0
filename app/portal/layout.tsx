import type React from "react"
import { Suspense } from "react"
import { requirePortalAccess } from "@/lib/access-control"
import { PortalShell } from "@/components/portal/portal-shell"
import { getOpaqueTelemetryUserId } from "@/lib/telemetry/identity"
import { WaveTelemetryIdentity } from "@/lib/telemetry/provider"
import { queueM2RepreneurEvent } from "@/lib/telemetry/m2-repreneur"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { resolvedRepreneurUiLanguage } from "@/lib/i18n/server-language"

async function PortalGate({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requirePortalAccess()
  const { language, accountLanguage } = await resolvedRepreneurUiLanguage(user.id)
  queueM2RepreneurEvent({
    userId: user.id,
    routeTemplate: "/portal",
    workflow: "portal_access",
    action: "access",
    outcome: "success",
  })

  return (
    <>
      <WaveTelemetryIdentity
        userId={getOpaqueTelemetryUserId(user.id)}
        role="repreneur"
      />
      <LanguageProvider key={user.id} initialLanguage={language} accountLanguage={accountLanguage} scope="account" showSkipLink>
        <PortalShell userEmail={user.email} userName={user.name}>
          {children}
        </PortalShell>
      </LanguageProvider>
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

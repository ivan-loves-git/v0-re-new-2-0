"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { KeyRound, Mail, Power, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  enableRepreneurPortalAccess,
  resendRepreneurPortalAccessLink,
  disableRepreneurPortalAccess,
  type RepreneurPortalAccessStatus,
} from "@/lib/actions/portal-access"

interface PortalAccessCardProps {
  repreneurId: string
  status: RepreneurPortalAccessStatus
}

function formatDate(value: string | null) {
  if (!value) return "Never"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function PortalAccessCard({ repreneurId, status }: PortalAccessCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function runAction(action: () => Promise<unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        await action()
        toast.success(successMessage)
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Portal access action failed."
        toast.error(message)
      }
    })
  }

  const canEnable = Boolean(status.repreneurEmail) && !status.enabled
  const canResend = Boolean(status.repreneurEmail) && status.enabled

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5" />
              Portal Access
            </CardTitle>
            <CardDescription>Staff-controlled login for the external repreneur portal.</CardDescription>
          </div>
          <Badge variant={status.enabled ? "default" : "secondary"} className="w-fit">
            {status.enabled ? (
              <>
                <ShieldCheck data-icon="inline-start" />
                Enabled
              </>
            ) : (
              <>
                <ShieldOff data-icon="inline-start" />
                Disabled
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Auth user</p>
            <p className="font-medium">{status.hasAuthUser ? "Linked" : "Missing"}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Password login</p>
            <p className="font-medium">{status.hasCredentialAccount ? "Ready" : "Missing"}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Active sessions</p>
            <p className="font-medium">{status.activeSessionCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Last access email</p>
            <p className="font-medium">{formatDate(status.lastAccessEmailSentAt)}</p>
          </div>
        </div>

        {!status.repreneurEmail && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Add an email address before enabling portal access.
          </p>
        )}

        {status.roleId && !status.enabled && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            A portal role exists but is not fully linked to this repreneur. Enable access to repair the linkage and send a fresh setup link.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            disabled={!canEnable || isPending}
            onClick={() => runAction(() => enableRepreneurPortalAccess(repreneurId), "Portal access enabled and setup link sent.")}
          >
            <Power data-icon="inline-start" />
            Enable portal access
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canResend || isPending}
            onClick={() => runAction(() => resendRepreneurPortalAccessLink(repreneurId), "Portal access link sent.")}
          >
            {isPending ? <RefreshCw data-icon="inline-start" className="animate-spin" /> : <Mail data-icon="inline-start" />}
            Resend access link
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!status.enabled || isPending}
            onClick={() => runAction(() => disableRepreneurPortalAccess(repreneurId), "Portal access disabled and sessions revoked.")}
          >
            <ShieldOff data-icon="inline-start" />
            Disable portal access
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

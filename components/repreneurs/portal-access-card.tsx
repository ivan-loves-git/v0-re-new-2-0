"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, KeyRound, Mail, Power, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react"
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

interface PortalAccessActionResponse {
  success?: boolean
  emailSent?: boolean
  warning?: boolean
  lastAccessEmailSentAt?: string
  message?: string
}

function formatDate(value: string | null) {
  if (!value) return "Never"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value))
}

function getPortalRecoveryMessage(status: RepreneurPortalAccessStatus) {
  if (status.enabled) return null

  if (status.portalEmailValidationError) {
    return status.portalEmailValidationError
  }

  if (!status.repreneurEmail) {
    return "Add an email address before enabling portal access."
  }

  if (status.identityIssue === "staff_email") {
    return "This email belongs to a staff login and cannot also be used for repreneur portal access. Use a separate repreneur email."
  }

  if (status.identityIssue === "multiple_auth_users") {
    return "More than one login identity uses this email. Access was left unchanged to avoid linking the wrong account."
  }

  if (status.identityIssue === "assigned_to_another_repreneur") {
    return "This login identity is already assigned to another repreneur. Access was left unchanged to protect both accounts."
  }

  if (status.identityIssue === "inconsistent_link") {
    return "Portal access points to an outdated email or login identity. Use Repair portal access & send link to relink the current account."
  }

  if (status.roleId || status.hasAuthUser || status.hasCredentialAccount) {
    return "Portal setup is incomplete. Use Repair portal access & send link to relink the account."
  }

  return null
}

export function PortalAccessCard({ repreneurId, status }: PortalAccessCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function runAction(action: () => Promise<PortalAccessActionResponse | unknown>, successMessage: string, fallbackErrorMessage: string) {
    startTransition(async () => {
      try {
        const result = await action()
        const actionResult = result && typeof result === "object" ? (result as PortalAccessActionResponse) : null
        const message = actionResult?.lastAccessEmailSentAt
          ? `${actionResult.message ?? successMessage} Last sent ${formatDate(actionResult.lastAccessEmailSentAt)}.`
          : (actionResult?.message ?? successMessage)
        if (actionResult?.warning || actionResult?.emailSent === false) {
          toast.warning(message)
        } else {
          toast.success(message)
        }
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : fallbackErrorMessage
        toast.error(message)
      }
    })
  }

  const hasValidPortalEmail = Boolean(
    status.repreneurEmail && !status.portalEmailValidationError,
  )
  const canEnable = hasValidPortalEmail && !status.enabled && status.repairable
  const hasExistingPortalAccess = Boolean(
    status.roleId ||
      status.linkedUserId ||
      status.hasAuthUser ||
      status.hasCredentialAccount,
  )
  const needsRecoveryRepair =
    !status.enabled && status.repairable && hasExistingPortalAccess
  const canResend = hasValidPortalEmail && status.enabled
  const recoveryMessage = getPortalRecoveryMessage(status)
  const enableButtonLabel = needsRecoveryRepair
    ? "Repair portal access & send link"
    : "Enable portal access"

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
            {status.portalEmailValidationError ? (
              <>
                <AlertCircle data-icon="inline-start" />
                Recipient invalid
              </>
            ) : status.enabled ? (
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
        <div className="rounded-md border px-3 py-2 text-sm">
          <p className="text-xs text-muted-foreground">Portal recipient</p>
          <p className="font-medium">{status.repreneurEmail ?? "Not set"}</p>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Auth user</p>
            <p className="font-medium">
              {status.portalEmailValidationError
                ? "Not checked"
                : status.hasAuthUser
                  ? "Linked"
                  : "Missing"}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Password login</p>
            <p className="font-medium">
              {status.portalEmailValidationError
                ? "Not checked"
                : status.hasCredentialAccount
                  ? "Ready"
                  : "Missing"}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Active sessions</p>
            <p className="font-medium">
              {status.portalEmailValidationError
                ? "Not checked"
                : status.activeSessionCount}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Last access email</p>
            <p className="font-medium">
              {status.portalEmailValidationError
                ? "Not checked"
                : formatDate(status.lastAccessEmailSentAt)}
            </p>
          </div>
        </div>

        {recoveryMessage && (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {recoveryMessage}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {!status.enabled && (
            <Button
              type="button"
              disabled={!canEnable || isPending}
              onClick={() =>
                runAction(
                  () => enableRepreneurPortalAccess(repreneurId),
                  "Portal access enabled and setup link sent.",
                  "Portal access could not be enabled. Check the repreneur email and retry."
                )
              }
            >
              <Power data-icon="inline-start" />
              {enableButtonLabel}
            </Button>
          )}
          {status.enabled && (
            <Button
              type="button"
              variant="outline"
              disabled={!canResend || isPending}
              onClick={() =>
                runAction(
                  () => resendRepreneurPortalAccessLink(repreneurId),
                  "Portal access link sent.",
                  "The access link could not be sent. Retry after checking the repreneur email."
                )
              }
            >
              {isPending ? <RefreshCw data-icon="inline-start" className="animate-spin" /> : <Mail data-icon="inline-start" />}
              Resend access link
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={
              (!status.enabled && !status.portalEmailValidationError) ||
              isPending
            }
            onClick={() =>
              runAction(
                () => disableRepreneurPortalAccess(repreneurId),
                "Portal access disabled and sessions revoked.",
                "Portal access could not be disabled. Refresh the page and retry."
              )
            }
          >
            <ShieldOff data-icon="inline-start" />
            Disable portal access
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

"use server"

import { Pool } from "pg"
import { requireStaffAccess } from "@/lib/access-control"
import {
  disableRepreneurPortalAccess,
  enableRepreneurPortalAccess,
  getRepreneurPortalAccessStatus,
  resendRepreneurPortalAccessLink,
} from "@/lib/actions/portal-access"
import {
  isPortalAccessActionAvailable,
  portalAccessSnapshotMatches,
  type PortalAccessConfirmationInput,
} from "@/lib/portal-access-confirmation"
import { consumeRequestRateLimit } from "@/lib/security/intake-upload"
import { env } from "@/lib/env"

const PORTAL_ACCESS_CONFIRMATION_TTL_SECONDS = 24 * 60 * 60
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// A dedicated single-connection pool keeps lock waiters from consuming the
// query pool needed by the action that currently owns the lock.
let confirmationLockPool: Pool | null = null

function getConfirmationLockPool() {
  if (!confirmationLockPool) {
    confirmationLockPool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
    })
  }
  return confirmationLockPool
}

async function withRepreneurPortalAccessActionLock<T>(
  repreneurId: string,
  action: () => Promise<T>,
) {
  const client = await getConfirmationLockPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`repreneur-portal-confirm:${repreneurId}`],
    )
    const result = await action()
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/**
 * The only browser-callable mutation boundary for staff portal-access actions.
 * One repreneur-scoped database lock keeps the consequence check and selected
 * command together, including while an email provider response is pending.
 */
export async function confirmRepreneurPortalAccessAction(
  repreneurId: string,
  confirmation: PortalAccessConfirmationInput,
) {
  await requireStaffAccess()

  if (
    !confirmation ||
    !["enable", "resend", "disable"].includes(confirmation.action) ||
    !UUID_PATTERN.test(confirmation.operationKey) ||
    !confirmation.snapshot ||
    typeof confirmation.snapshot !== "object"
  ) {
    throw new Error(
      "Portal access confirmation is invalid. Reopen the action and try again.",
    )
  }

  return withRepreneurPortalAccessActionLock(repreneurId, async () => {
    const currentStatus = await getRepreneurPortalAccessStatus(repreneurId)
    if (!portalAccessSnapshotMatches(currentStatus, confirmation.snapshot)) {
      throw new Error(
        "Portal access changed after this confirmation opened. Refresh the page and confirm the current state.",
      )
    }
    if (!isPortalAccessActionAvailable(confirmation.action, currentStatus)) {
      throw new Error(
        "This portal access action is no longer available. Refresh the page and review the current state.",
      )
    }

    const consumption = await consumeRequestRateLimit(
      `portal-access-confirm:${repreneurId}:${confirmation.action}:${confirmation.operationKey}`,
      1,
      PORTAL_ACCESS_CONFIRMATION_TTL_SECONDS,
    )
    if (!consumption.allowed) {
      throw new Error(
        "This portal access confirmation has already been submitted. Refresh the page before choosing another action.",
      )
    }

    if (confirmation.action === "enable") {
      return enableRepreneurPortalAccess(repreneurId)
    }
    if (confirmation.action === "resend") {
      return resendRepreneurPortalAccessLink(repreneurId)
    }
    return disableRepreneurPortalAccess(repreneurId)
  })
}

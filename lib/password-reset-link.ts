import "server-only"
import { Pool, type PoolClient } from "pg"
import { env } from "@/lib/env"

const BETTER_AUTH_RESET_TOKEN_PATTERN = /^[A-Za-z0-9]{24}$/

let pool: Pool | null = null

type QueryExecutor = Pick<PoolClient, "query">

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
    })
  }
  return pool
}

export function isPasswordResetToken(
  token: string | null | undefined,
): token is string {
  return Boolean(token && BETTER_AUTH_RESET_TOKEN_PATTERN.test(token))
}

export function passwordResetUserLockKey(userId: string) {
  return `password-reset-user:${userId}`
}

async function findAuthorizedResetUser(
  executor: QueryExecutor,
  token: string,
  requireCurrentRole: boolean,
) {
  const rolePredicate = requireCurrentRole
    ? `AND EXISTS (
           SELECT 1
           FROM public.app_user_roles AS role
           WHERE role.user_id::text = verification."value"
             AND role.role::text IN ('staff', 'repreneur')
         )`
    : ""
  const { rows } = await executor.query<{ user_id: string }>(
    `SELECT verification."value" AS user_id
     FROM public."verification" AS verification
     WHERE verification."identifier" = $1
       AND verification."expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
       ${rolePredicate}
     LIMIT 1`,
    [`reset-password:${token}`],
  )
  return rows[0]?.user_id ?? null
}

/**
 * Non-consuming preflight for Better Auth's current reset-token record.
 * The native reset endpoint remains the only authority that can consume a
 * token and change a password.
 */
export async function validatePasswordResetLink(
  token: string | null | undefined,
) {
  if (!isPasswordResetToken(token)) return false

  try {
    const { rows } = await getPool().query<{ valid: number }>(
      `SELECT 1 AS valid
       FROM public."verification" AS verification
       WHERE verification."identifier" = $1
         AND verification."expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
         AND EXISTS (
           SELECT 1
           FROM public.app_user_roles AS role
           WHERE role.user_id::text = verification."value"
             AND role.role::text IN ('staff', 'repreneur')
         )
       LIMIT 1`,
      [`reset-password:${token}`],
    )
    return rows.length === 1
  } catch {
    // Fail closed without putting the reset token or database detail in logs.
    console.error("Password reset link validation was unavailable.")
    return false
  }
}

/**
 * Serializes the reset mutation with portal Disable, then rechecks both the
 * one-use token and the user's current application role. All browser reset
 * mutations pass through this boundary before Better Auth consumes the token.
 */
export async function withPasswordResetAuthority<T>(
  token: string | null | undefined,
  action: () => Promise<T>,
): Promise<{ authorized: false } | { authorized: true; result: T }> {
  if (!isPasswordResetToken(token)) return { authorized: false }

  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    const initialUserId = await findAuthorizedResetUser(client, token, false)
    if (!initialUserId) {
      await client.query("COMMIT")
      return { authorized: false }
    }

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [passwordResetUserLockKey(initialUserId)],
    )

    const authorizedUserId = await findAuthorizedResetUser(client, token, true)
    if (authorizedUserId !== initialUserId) {
      await client.query("COMMIT")
      return { authorized: false }
    }

    const result = await action()
    await client.query("COMMIT")
    return { authorized: true, result }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/**
 * Better Auth creates a reset record before calling the delivery hook. Keep
 * the hook silent for revoked identities and remove that undelivered token so
 * a later re-enable cannot make it usable.
 */
export async function authorizePasswordResetDelivery(
  userId: string,
  token: string,
) {
  if (!userId || !isPasswordResetToken(token)) return false

  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [passwordResetUserLockKey(userId)],
    )

    const authorizedUserId = await findAuthorizedResetUser(client, token, true)
    if (authorizedUserId !== userId) {
      await client.query(
        `DELETE FROM public."verification"
         WHERE "identifier" = $1
           AND "value" = $2`,
        [`reset-password:${token}`, userId],
      )
      await client.query("COMMIT")
      return false
    }

    await client.query("COMMIT")
    return true
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

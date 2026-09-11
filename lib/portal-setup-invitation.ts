import "server-only"
import { randomBytes } from "node:crypto"
import { Pool } from "pg"
import { env } from "@/lib/env"
import { FROM_EMAIL, FROM_NAME, resend } from "@/lib/email/resend-client"
import { renderPortalAccessSetupEmail } from "@/lib/email/portal-setup-email"
import { buildPasswordResetBrowserUrl } from "@/lib/password-reset-browser-url"
import { authorizePasswordResetDelivery, passwordResetUserLockKey } from "@/lib/password-reset-link"
import { PORTAL_SETUP_TOKEN_PREFIX } from "@/lib/password-reset-token"
import { postgresSslForConnection } from "@/lib/postgres-ssl"
import { startCriticalOperation } from "@/lib/observability/critical-operation"

interface PortalSetupIdentity {
  repreneurId: string
  roleId: string
  userId: string
  email: string
}

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: postgresSslForConnection(env.DATABASE_URL),
      max: 2,
    })
  }
  return pool
}

/**
 * Called only by the staff-guarded Enable/Repair/Resend actions. Browser intent
 * cannot reach issuance. Better Auth remains the only password-write path.
 */
export async function sendRepreneurPortalSetupInvitation(identity: PortalSetupIdentity) {
  const client = await getPool().connect()
  const token = `${PORTAL_SETUP_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`
  let recipient: { setup_user_id: string; name: string | null; email: string }

  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `repreneur-portal:${identity.email}`,
    ])
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      passwordResetUserLockKey(identity.userId),
    ])
    const { rows } = await client.query<typeof recipient>(
      `SELECT auth_user.id AS setup_user_id, auth_user.name, auth_user.email
       FROM public.app_user_roles AS role
       JOIN public."user" AS auth_user ON auth_user.id = role.user_id
       JOIN public.repreneurs AS repreneur ON repreneur.id = role.repreneur_id
       WHERE role.id = $1 AND role.user_id = $2 AND role.repreneur_id = $3
         AND role.role::text = 'repreneur'
         AND LOWER(role.email) = $4 AND LOWER(auth_user.email) = $4
         AND LOWER(TRIM(repreneur.email)) = $4
         AND (SELECT COUNT(*) FROM public."user" WHERE LOWER(email) = $4) = 1
         AND (SELECT COUNT(*) FROM public.app_user_roles WHERE user_id = $2) = 1
         AND EXISTS (SELECT 1 FROM public."account"
                     WHERE "userId" = $2 AND "providerId" = 'credential' AND password IS NOT NULL)
       FOR UPDATE OF role, auth_user, repreneur`,
      [identity.roleId, identity.userId, identity.repreneurId, identity.email],
    )
    if (rows.length !== 1) {
      throw new Error("Portal access changed. Refresh and confirm the current recipient.")
    }
    recipient = rows[0]
    // Prefix comparison is literal: SQL LIKE would treat underscores as
    // wildcards and could revoke an unrelated native recovery token.
    await client.query(
      `DELETE FROM public."verification"
       WHERE "value" = $1 AND LEFT("identifier", LENGTH($2)) = $2`,
      [identity.userId, `reset-password:${PORTAL_SETUP_TOKEN_PREFIX}`],
    )
    await client.query(
      `WITH issued AS (SELECT clock_timestamp() AT TIME ZONE 'UTC' AS at)
       INSERT INTO public."verification" (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
       SELECT $1, $2, $3, issued.at + INTERVAL '7 days', issued.at, issued.at FROM issued`,
      [randomBytes(16).toString("hex"), `reset-password:${token}`, identity.userId],
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  const trace = startCriticalOperation("email.password_reset_send")
  try {
    // Disable or repair may have won after issuance committed. Never claim a
    // delivery if the current native verification/role authority rejects it.
    if (!(await authorizePasswordResetDelivery(identity.userId, token))) {
      trace.failure("precondition_failed")
      throw new Error("Portal access changed before the setup link could be sent.")
    }
    const url = buildPasswordResetBrowserUrl(env.BETTER_AUTH_URL, token, true)
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipient.email,
      subject: "Votre accès à votre espace Re-New",
      html: renderPortalAccessSetupEmail(recipient.name, url, "7 jours"),
    })
    if (error) {
      trace.failure("provider_rejected")
      throw new Error("The setup email provider rejected delivery.")
    }
    trace.success()
  } catch (error) {
    trace.failure("provider_unavailable")
    throw error
  }
}

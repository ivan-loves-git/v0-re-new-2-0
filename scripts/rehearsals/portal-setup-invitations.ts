import assert from "node:assert/strict"
import { Pool } from "pg"
import { hashPassword, verifyPassword } from "better-auth/crypto"
import { auth } from "@/lib/auth"
import { sendRepreneurPortalSetupInvitation } from "@/lib/portal-setup-invitation"
import { validatePasswordResetLink, withPasswordResetAuthority, passwordResetUserLockKey } from "@/lib/password-reset-link"

const database = new URL(process.env.DATABASE_URL ?? "http://invalid")
if (process.env.PORTAL_SETUP_REHEARSAL !== "1" || database.hostname !== "127.0.0.1" || database.pathname !== "/renew_portal_setup_rehearsal" || process.env.QA_MAIL_MODE !== "allowlist") {
  throw new Error("Only the dedicated local portal setup rehearsal is allowed.")
}
const pool = new Pool({ connectionString: database.toString(), ssl: false })
const identity = {
  userId: "synthetic-portal-setup-user",
  repreneurId: "93000000-0000-4000-8000-000000000011",
  roleId: "93000000-0000-4000-8000-000000000021",
  email: "delivered+test-portal-setup@resend.dev",
}
let stage = "seed"

async function currentSetupToken() {
  const { rows } = await pool.query<{ identifier: string }>(`SELECT identifier FROM public."verification" WHERE value=$1 AND LEFT(identifier,28)='reset-password:portal_setup_'`, [identity.userId])
  assert.equal(rows.length, 1)
  return rows[0].identifier.slice("reset-password:".length)
}

async function main() {
  const password = await hashPassword("Synthetic initial password 123!")
  await pool.query(`INSERT INTO public.repreneurs(id,email,first_name,last_name) VALUES($1,$2,'Synthetic','Setup')`, [identity.repreneurId, identity.email])
  await pool.query(`INSERT INTO public."user"(id,email,name,"emailVerified") VALUES($1,$2,'Synthetic Setup',true)`, [identity.userId, identity.email])
  await pool.query(`INSERT INTO public."account"(id,"userId","accountId","providerId",password) VALUES('synthetic-portal-account',$1,$1,'credential',$2)`, [identity.userId, password])
  await pool.query(`INSERT INTO public.app_user_roles(id,user_id,email,role,repreneur_id) VALUES($1,$2,$3,'repreneur',$4)`, [identity.roleId, identity.userId, identity.email, identity.repreneurId])

  stage = "native-one-hour"
  await auth.api.requestPasswordReset({ body: { email: identity.email, redirectTo: "/auth/reset-password?intent=portal" } })
  const native = await pool.query<{ identifier: string; lifetime: number }>(`SELECT identifier, EXTRACT(EPOCH FROM ("expiresAt"-"createdAt"))::float AS lifetime FROM public."verification" WHERE value=$1`, [identity.userId])
  assert.equal(native.rows.length, 1)
  assert.match(native.rows[0].identifier, /^reset-password:[A-Za-z0-9]{24}$/)
  assert.ok(Math.abs(native.rows[0].lifetime - 3600) < 2)
  const nativeToken = native.rows[0].identifier.slice("reset-password:".length)

  stage = "seven-days-and-resend"
  await sendRepreneurPortalSetupInvitation(identity)
  const firstToken = await currentSetupToken()
  const duration = await pool.query<{ lifetime: number }>(`SELECT EXTRACT(EPOCH FROM ("expiresAt"-"createdAt"))::float AS lifetime FROM public."verification" WHERE identifier=$1`, [`reset-password:${firstToken}`])
  assert.equal(duration.rows[0].lifetime, 604800)
  assert.equal(await validatePasswordResetLink(firstToken), true)
  await sendRepreneurPortalSetupInvitation(identity)
  const secondToken = await currentSetupToken()
  assert.equal(firstToken === secondToken, false)
  assert.equal(await validatePasswordResetLink(firstToken), false)
  assert.equal(await validatePasswordResetLink(secondToken), true)
  assert.equal(await validatePasswordResetLink(nativeToken), true)

  stage = "native-single-use-consumption"
  const consumed = await withPasswordResetAuthority(secondToken, () => auth.api.resetPassword({ body: { token: secondToken, newPassword: "Synthetic replacement password 456!" } }))
  assert.equal(consumed.authorized, true)
  assert.equal(await validatePasswordResetLink(secondToken), false)
  const repeated = await withPasswordResetAuthority(secondToken, () => { throw new Error("Consumed token reached password mutation") })
  assert.equal(repeated.authorized, false)
  const credential = await pool.query<{ password: string }>(`SELECT password FROM public."account" WHERE "userId"=$1`, [identity.userId])
  assert.equal(await verifyPassword({ hash: credential.rows[0].password, password: "Synthetic replacement password 456!" }), true)

  stage = "expiry"
  await sendRepreneurPortalSetupInvitation(identity)
  const expiringToken = await currentSetupToken()
  await pool.query(`UPDATE public."verification" SET "expiresAt"=(clock_timestamp() AT TIME ZONE 'UTC')+INTERVAL '10 seconds' WHERE identifier=$1`, [`reset-password:${expiringToken}`])
  assert.equal(await validatePasswordResetLink(expiringToken), true)
  await pool.query(`UPDATE public."verification" SET "expiresAt"=clock_timestamp() AT TIME ZONE 'UTC' WHERE identifier=$1`, [`reset-password:${expiringToken}`])
  assert.equal(await validatePasswordResetLink(expiringToken), false)
  const expired = await withPasswordResetAuthority(expiringToken, () => { throw new Error("Expired token reached password mutation") })
  assert.equal(expired.authorized, false)

  stage = "identity-binding"
  await assert.rejects(sendRepreneurPortalSetupInvitation({ ...identity, email: "different@example.com" }))
  await pool.query(`UPDATE public.app_user_roles SET role='staff' WHERE id=$1`, [identity.roleId])
  await assert.rejects(sendRepreneurPortalSetupInvitation(identity))
  await pool.query(`UPDATE public.app_user_roles SET role='repreneur' WHERE id=$1`, [identity.roleId])

  stage = "concurrent-issuance"
  const attempts = await Promise.allSettled([sendRepreneurPortalSetupInvitation(identity), sendRepreneurPortalSetupInvitation(identity)])
  assert.ok(attempts.some((attempt) => attempt.status === "fulfilled"))
  const remainingToken = await currentSetupToken()
  assert.equal(await validatePasswordResetLink(remainingToken), true)

  stage = "revocation-no-resurrection"
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [passwordResetUserLockKey(identity.userId)])
    await client.query(`DELETE FROM public.app_user_roles WHERE id=$1`, [identity.roleId])
    await client.query(`DELETE FROM public."verification" WHERE value=$1 AND identifier LIKE 'reset-password:%'`, [identity.userId])
    await client.query("COMMIT")
  } finally { client.release() }
  assert.equal(await validatePasswordResetLink(remainingToken), false)
  await pool.query(`INSERT INTO public.app_user_roles(id,user_id,email,role,repreneur_id) VALUES($1,$2,$3,'repreneur',$4)`, [identity.roleId, identity.userId, identity.email, identity.repreneurId])
  assert.equal(await validatePasswordResetLink(remainingToken), false)
  assert.equal(await validatePasswordResetLink(nativeToken), false)

  console.log(JSON.stringify({ rehearsal: "portal-setup-invitations", passed: true, nativeResetSeconds: 3600, staffSetupSeconds: 604800, supersededLinkInvalid: true, singleUseNativeConsumption: true, expiredLinkDenied: true, identityMismatchDenied: true, concurrentIssuanceSerialized: true, noResurrection: true, productionCredentials: false, outboundProvider: false }))
  await pool.end()
}

main().then(() => process.exit(0)).catch((error) => {
  const message = String(error?.message ?? "").replace(/https?:\/\/\S+|(?:portal_setup_)?[A-Za-z0-9]{24,}/g, "[redacted]").slice(0, 250)
  console.error(JSON.stringify({ rehearsal: "portal-setup-invitations", passed: false, stage, errorType: error?.name, code: error?.code, message }))
  process.exit(1)
})

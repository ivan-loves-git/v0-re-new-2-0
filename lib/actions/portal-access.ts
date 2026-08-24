"use server"

import { randomBytes } from "crypto"
import { Pool, type PoolClient } from "pg"
import { hashPassword } from "better-auth/crypto"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { requireStaffAccess } from "@/lib/access-control"
import {
  normalizePortalEmail,
  planPortalRoleReconciliation,
  type PortalAccessIdentityIssue,
  type PortalRoleCandidate,
  validatePortalEmail,
} from "@/lib/portal-access-reconciliation"
import { createAdminClient } from "@/lib/supabase/admin"
import { env } from "@/lib/env"
import { databaseTls } from "@/lib/database-tls"

export interface RepreneurPortalAccessStatus {
  repreneurId: string
  repreneurEmail: string | null
  portalEmailValidationError: string | null
  repreneurName: string
  enabled: boolean
  repairable: boolean
  identityIssue: PortalAccessIdentityIssue | null
  authIdentityCount: number
  hasAuthUser: boolean
  hasCredentialAccount: boolean
  linkedUserId: string | null
  roleId: string | null
  roleEmail: string | null
  roleRepreneurId: string | null
  accessEnabledAt: string | null
  lastAccessEmailSentAt: string | null
  activeSessionCount: number
}

export interface PortalAccessActionResult {
  success: true
  accessReady: boolean
  emailSent: boolean
  warning?: boolean
  repaired?: boolean
  lastAccessEmailSentAt?: string
  message: string
}

interface AuthUserRow {
  id: string
  email: string
  name: string | null
}

interface PortalRoleRow extends PortalRoleCandidate {
  access_enabled_at?: string | null
  last_access_email_sent_at?: string | null
}

type QueryExecutor = Pick<PoolClient, "query">

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: databaseTls(env.DATABASE_URL, env),
      max: 3,
    })
  }
  return pool
}

function fullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Repreneur"
}

function randomId() {
  return randomBytes(16).toString("hex")
}

async function getRepreneur(repreneurId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email")
    .eq("id", repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Repreneur not found")
  return data as {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  }
}

async function findAuthUsersByEmail(
  executor: QueryExecutor,
  email: string,
  forUpdate = false,
): Promise<AuthUserRow[]> {
  const { rows } = await executor.query<AuthUserRow>(
    `SELECT id, email, name
     FROM "user"
     WHERE LOWER(email) = LOWER($1)
     ORDER BY "createdAt" ASC, id ASC${forUpdate ? " FOR UPDATE" : ""}`,
    [email],
  )
  return rows
}

async function findAuthUserById(
  executor: QueryExecutor,
  userId: string,
): Promise<AuthUserRow | null> {
  const { rows } = await executor.query<AuthUserRow>(
    'SELECT id, email, name FROM "user" WHERE id = $1 LIMIT 1',
    [userId],
  )
  return rows[0] ?? null
}

async function listPortalRoles(
  executor: QueryExecutor,
  repreneurId: string,
  email: string | null,
  authUserId: string | null = null,
  forUpdate = false,
): Promise<PortalRoleRow[]> {
  const { rows } = await executor.query<PortalRoleRow>(
    `SELECT id, user_id, email, role::text AS role, repreneur_id,
            access_enabled_at, last_access_email_sent_at
     FROM public.app_user_roles
     WHERE repreneur_id = $1
        OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
        OR ($3::text IS NOT NULL AND user_id = $3)
     ORDER BY created_at ASC, id ASC${forUpdate ? " FOR UPDATE" : ""}`,
    [repreneurId, email, authUserId],
  )
  return rows
}

async function ensureCredentialAccount(
  executor: QueryExecutor,
  userId: string,
) {
  const { rows } = await executor.query<{ id: string }>(
    'SELECT id FROM "account" WHERE "userId" = $1 AND "providerId" = $2 LIMIT 1',
    [userId, "credential"],
  )
  if (rows[0]) return

  const unusablePassword = randomBytes(32).toString("base64url")
  const passwordHash = await hashPassword(unusablePassword)
  await executor.query(
    `INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'credential', $4, NOW(), NOW())`,
    [randomId(), userId, userId, passwordHash],
  )
}

async function rotateCredentialAndSessions(
  executor: QueryExecutor,
  userId: string,
) {
  await ensureCredentialAccount(executor, userId)
  const unusablePassword = randomBytes(32).toString("base64url")
  const passwordHash = await hashPassword(unusablePassword)
  await executor.query(
    'UPDATE "account" SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = $3',
    [passwordHash, userId, "credential"],
  )
  await executor.query('DELETE FROM "session" WHERE "userId" = $1', [userId])
}

async function createAuthUser(
  executor: QueryExecutor,
  email: string,
  name: string,
): Promise<AuthUserRow> {
  const id = randomId()
  const { rows } = await executor.query<AuthUserRow>(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, TRUE, NOW(), NOW())
     RETURNING id, email, name`,
    [id, email, name],
  )
  return rows[0] ?? { id, email, name }
}

async function getCredentialAccountState(userId: string | null) {
  if (!userId) return false
  const { rows } = await getPool().query<{ has_password: boolean }>(
    'SELECT password IS NOT NULL AS has_password FROM "account" WHERE "userId" = $1 AND "providerId" = $2 LIMIT 1',
    [userId, "credential"],
  )
  return Boolean(rows[0]?.has_password)
}

async function countActiveSessions(userIds: string[]) {
  if (userIds.length === 0) return 0
  const { rows } = await getPool().query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM "session" WHERE "userId" = ANY($1::text[]) AND "expiresAt" > NOW()',
    [userIds],
  )
  return Number(rows[0]?.count ?? 0)
}

async function sendAccessEmail(email: string, failureMessage: string) {
  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: "/auth/reset-password?intent=portal",
      },
    })
  } catch (error) {
    console.error("Failed to send repreneur portal access email", error)
    throw new Error(failureMessage)
  }
}

async function recordAccessEmailSent({
  roleId,
  repreneurId,
  userId,
  sentAt,
}: {
  roleId: string
  repreneurId: string
  userId: string
  sentAt: string
}) {
  const { rows } = await getPool().query<{ id: string }>(
    `UPDATE public.app_user_roles
     SET last_access_email_sent_at = $1, updated_at = NOW()
     WHERE id = $2
       AND role = 'repreneur'
       AND repreneur_id = $3
       AND user_id = $4
     RETURNING id`,
    [sentAt, roleId, repreneurId, userId],
  )
  return Boolean(rows[0])
}

async function provisionPortalAccess({
  repreneurId,
  email,
  name,
}: {
  repreneurId: string
  email: string
  name: string
}) {
  const client = await getPool().connect()

  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`repreneur-portal:${email}`],
    )

    const authUsers = await findAuthUsersByEmail(client, email, true)
    if (authUsers.length > 1) {
      throw new Error(
        "Multiple login identities use this email. Portal access was not changed; an administrator must merge the duplicate identities first.",
      )
    }

    const existingAuthUser = authUsers[0] ?? null
    const authUser =
      existingAuthUser ?? (await createAuthUser(client, email, name))
    const roles = await listPortalRoles(
      client,
      repreneurId,
      email,
      authUser.id,
      true,
    )
    const plan = planPortalRoleReconciliation({
      roles,
      repreneurId,
      email,
      authUserId: authUser.id,
    })
    const wasRepair = Boolean(
      existingAuthUser || plan.targetRoleId || plan.redundantRoleIds.length > 0,
    )

    if (existingAuthUser) {
      await rotateCredentialAndSessions(client, authUser.id)
    } else {
      await ensureCredentialAccount(client, authUser.id)
    }

    if (plan.redundantRoleIds.length > 0) {
      await client.query(
        `DELETE FROM public.app_user_roles
         WHERE role = 'repreneur' AND id = ANY($1::uuid[])`,
        [plan.redundantRoleIds],
      )
    }

    const accessEnabledAt = new Date().toISOString()
    const roleWrite = plan.targetRoleId
      ? await client.query<{ id: string }>(
          `UPDATE public.app_user_roles
           SET user_id = $1, email = $2, repreneur_id = $3,
               access_enabled_at = $4, updated_at = NOW()
           WHERE id = $5 AND role = 'repreneur'
           RETURNING id`,
          [authUser.id, email, repreneurId, accessEnabledAt, plan.targetRoleId],
        )
      : await client.query<{ id: string }>(
          `INSERT INTO public.app_user_roles
             (user_id, email, role, repreneur_id, access_enabled_at)
           VALUES ($1, $2, 'repreneur', $3, $4)
           RETURNING id`,
          [authUser.id, email, repreneurId, accessEnabledAt],
        )

    const roleId = roleWrite.rows[0]?.id
    if (!roleId) {
      throw new Error("Portal access could not be linked to this repreneur.")
    }

    await client.query("COMMIT")
    return { authUser, roleId, wasRepair }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

function revalidatePortalAccess(repreneurId: string) {
  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/repreneurs")
  revalidatePath("/portal/deals")
  revalidatePath("/portal/profile")
}

export async function getRepreneurPortalAccessStatus(
  repreneurId: string,
): Promise<RepreneurPortalAccessStatus> {
  await requireStaffAccess()

  const repreneur = await getRepreneur(repreneurId)
  const { email: normalizedEmail, error: portalEmailValidationError } =
    validatePortalEmail(repreneur.email)
  if (portalEmailValidationError) {
    return {
      repreneurId,
      repreneurEmail: normalizedEmail,
      portalEmailValidationError,
      repreneurName: fullName(repreneur.first_name, repreneur.last_name),
      enabled: false,
      repairable: false,
      identityIssue: null,
      authIdentityCount: 0,
      hasAuthUser: false,
      hasCredentialAccount: false,
      linkedUserId: null,
      roleId: null,
      roleEmail: null,
      roleRepreneurId: null,
      accessEnabledAt: null,
      lastAccessEmailSentAt: null,
      activeSessionCount: 0,
    }
  }
  const [roles, emailAuthUsers] = await Promise.all([
    listPortalRoles(getPool(), repreneurId, normalizedEmail),
    normalizedEmail
      ? findAuthUsersByEmail(getPool(), normalizedEmail)
      : Promise.resolve([]),
  ])
  const role =
    roles.find(
      (row) => row.role === "repreneur" && row.repreneur_id === repreneurId,
    ) ??
    roles.find(
      (row) =>
        row.role === "repreneur" &&
        normalizePortalEmail(row.email) === normalizedEmail,
    ) ??
    null
  const canonicalAuthUser =
    emailAuthUsers.length === 1 ? emailAuthUsers[0] : null
  const linkedAuthUser = role?.user_id
    ? (emailAuthUsers.find((user) => user.id === role.user_id) ??
      (await findAuthUserById(getPool(), role.user_id)))
    : null
  const statusAuthUser = canonicalAuthUser ?? linkedAuthUser
  const hasCredentialAccount = await getCredentialAccountState(
    statusAuthUser?.id ?? null,
  )
  const sessionUserIds = Array.from(
    new Set(
      [canonicalAuthUser?.id, linkedAuthUser?.id].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  )
  const activeSessionCount = await countActiveSessions(sessionUserIds)
  const staffConflict = roles.some(
    (candidate) =>
      candidate.role === "staff" &&
      (candidate.repreneur_id === repreneurId ||
        normalizePortalEmail(candidate.email) === normalizedEmail ||
        candidate.user_id === canonicalAuthUser?.id),
  )
  const assignmentConflict = roles.some(
    (candidate) =>
      candidate.role === "repreneur" &&
      candidate.repreneur_id !== null &&
      candidate.repreneur_id !== repreneurId &&
      (normalizePortalEmail(candidate.email) === normalizedEmail ||
        candidate.user_id === canonicalAuthUser?.id),
  )
  const linkIsConsistent = Boolean(
    normalizedEmail &&
    role &&
    canonicalAuthUser &&
    role.repreneur_id === repreneurId &&
    role.user_id === canonicalAuthUser.id &&
    normalizePortalEmail(role.email) === normalizedEmail &&
    normalizePortalEmail(canonicalAuthUser.email) === normalizedEmail,
  )

  let identityIssue: PortalAccessIdentityIssue | null = null
  if (staffConflict) identityIssue = "staff_email"
  else if (emailAuthUsers.length > 1) identityIssue = "multiple_auth_users"
  else if (assignmentConflict) identityIssue = "assigned_to_another_repreneur"
  else if (role && !canonicalAuthUser) identityIssue = "missing_auth_user"
  else if (linkIsConsistent && !hasCredentialAccount)
    identityIssue = "missing_credential"
  else if ((role || canonicalAuthUser) && !linkIsConsistent)
    identityIssue = "inconsistent_link"

  const repairable = Boolean(
    normalizedEmail &&
    identityIssue !== "staff_email" &&
    identityIssue !== "multiple_auth_users" &&
    identityIssue !== "assigned_to_another_repreneur",
  )

  return {
    repreneurId,
    repreneurEmail: normalizedEmail,
    portalEmailValidationError: null,
    repreneurName: fullName(repreneur.first_name, repreneur.last_name),
    enabled: Boolean(linkIsConsistent && hasCredentialAccount),
    repairable,
    identityIssue,
    authIdentityCount: emailAuthUsers.length,
    hasAuthUser: Boolean(statusAuthUser),
    hasCredentialAccount,
    linkedUserId: statusAuthUser?.id ?? role?.user_id ?? null,
    roleId: role?.id ?? null,
    roleEmail: role?.email ?? null,
    roleRepreneurId: role?.repreneur_id ?? null,
    accessEnabledAt: role?.access_enabled_at ?? null,
    lastAccessEmailSentAt: role?.last_access_email_sent_at ?? null,
    activeSessionCount,
  }
}

export async function enableRepreneurPortalAccess(
  repreneurId: string,
): Promise<PortalAccessActionResult> {
  await requireStaffAccess()

  const repreneur = await getRepreneur(repreneurId)
  const { email, error: portalEmailValidationError } = validatePortalEmail(
    repreneur.email,
  )
  if (portalEmailValidationError) throw new Error(portalEmailValidationError)
  if (!email) {
    throw new Error(
      "This repreneur needs an email before portal access can be enabled.",
    )
  }

  const { authUser, roleId, wasRepair } = await provisionPortalAccess({
    repreneurId,
    email,
    name: fullName(repreneur.first_name, repreneur.last_name),
  })

  try {
    await sendAccessEmail(
      email,
      `Portal access is ${wasRepair ? "repaired" : "enabled"}, but the setup email could not be sent. Check email delivery before resending.`,
    )
  } catch (error) {
    revalidatePortalAccess(repreneurId)
    return {
      success: true,
      accessReady: true,
      emailSent: false,
      warning: true,
      message:
        error instanceof Error
          ? error.message
          : `Portal access is ${wasRepair ? "repaired" : "enabled"}, but the setup email could not be sent.`,
    }
  }

  let recorded = false
  const sentAt = new Date().toISOString()
  try {
    recorded = await recordAccessEmailSent({
      roleId,
      repreneurId,
      userId: authUser.id,
      sentAt,
    })
  } catch (error) {
    console.error(
      "Failed to save repreneur portal access email timestamp",
      error,
    )
  }

  revalidatePortalAccess(repreneurId)
  if (!recorded) {
    return {
      success: true,
      accessReady: true,
      emailSent: true,
      warning: true,
      message: `Portal access is ${wasRepair ? "repaired" : "enabled"} and the setup link was sent, but the delivery time could not be recorded. Do not resend unless the recipient did not receive it.`,
    }
  }

  return {
    success: true,
    accessReady: true,
    emailSent: true,
    repaired: wasRepair,
    lastAccessEmailSentAt: sentAt,
    message: `Portal access ${wasRepair ? "repaired" : "enabled"} and setup link sent.`,
  }
}

export async function resendRepreneurPortalAccessLink(
  repreneurId: string,
): Promise<PortalAccessActionResult> {
  await requireStaffAccess()

  const status = await getRepreneurPortalAccessStatus(repreneurId)
  if (status.portalEmailValidationError) {
    throw new Error(status.portalEmailValidationError)
  }
  const email = normalizePortalEmail(status.repreneurEmail)
  if (!email) {
    throw new Error(
      "This repreneur needs an email before a portal access link can be sent.",
    )
  }
  const hasExistingPortalAccess = Boolean(
    status.roleId ||
      status.linkedUserId ||
      status.hasAuthUser ||
      status.hasCredentialAccount,
  )
  if (!hasExistingPortalAccess) {
    throw new Error(
      "Enable portal access before resending an access link.",
    )
  }

  if (!status.enabled) {
    if (!status.repairable) {
      throw new Error(
        "Portal access cannot be reconciled safely. Resolve the staff, duplicate-login, or cross-repreneur conflict before resending.",
      )
    }

    // A recovery is an access repair, not an ordinary resend. Reuse the
    // repair flow so an existing credential and its sessions are invalidated
    // before the fresh setup link is sent.
    return enableRepreneurPortalAccess(repreneurId)
  }

  if (!status.roleId || !status.linkedUserId || status.identityIssue) {
    throw new Error(
      "Repair portal access before resending. The current role and login identity do not resolve to the same repreneur email.",
    )
  }

  await sendAccessEmail(
    email,
    "The access link could not be sent. Please retry in a moment.",
  )

  let recorded = false
  const sentAt = new Date().toISOString()
  try {
    recorded = await recordAccessEmailSent({
      roleId: status.roleId,
      repreneurId,
      userId: status.linkedUserId,
      sentAt,
    })
  } catch (error) {
    console.error(
      "Failed to save repreneur portal access email timestamp",
      error,
    )
  }

  revalidatePortalAccess(repreneurId)
  if (!recorded) {
    return {
      success: true,
      accessReady: true,
      emailSent: true,
      repaired: false,
      warning: true,
      message:
        "The access link was sent, but the delivery time could not be recorded. Do not resend unless the recipient did not receive it.",
    }
  }

  return {
    success: true,
    accessReady: true,
    emailSent: true,
    repaired: false,
    lastAccessEmailSentAt: sentAt,
    message: "Portal access link sent.",
  }
}

export async function disableRepreneurPortalAccess(repreneurId: string) {
  await requireStaffAccess()

  const repreneur = await getRepreneur(repreneurId)
  const email = normalizePortalEmail(repreneur.email)
  const client = await getPool().connect()

  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`repreneur-portal:${email ?? repreneurId}`],
    )
    const roles = await listPortalRoles(client, repreneurId, email, null, true)
    const removableRoles = roles.filter(
      (role) =>
        role.role === "repreneur" &&
        (role.repreneur_id === repreneurId ||
          (role.repreneur_id === null &&
            normalizePortalEmail(role.email) === email)),
    )
    const userIds = Array.from(
      new Set(
        removableRoles
          .map((role) => role.user_id)
          .filter((value): value is string => Boolean(value)),
      ),
    )

    if (removableRoles.length > 0) {
      await client.query(
        `DELETE FROM public.app_user_roles
         WHERE role = 'repreneur' AND id = ANY($1::uuid[])`,
        [removableRoles.map((role) => role.id)],
      )
    }
    if (userIds.length > 0) {
      await client.query(
        'DELETE FROM "session" WHERE "userId" = ANY($1::text[])',
        [userIds],
      )
    }

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  revalidatePortalAccess(repreneurId)
  return { success: true }
}

"use server"

import { randomBytes } from "crypto"
import { Pool } from "pg"
import { hashPassword } from "better-auth/crypto"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

export interface RepreneurPortalAccessStatus {
  repreneurId: string
  repreneurEmail: string | null
  repreneurName: string
  enabled: boolean
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

interface AuthUserRow {
  id: string
  email: string
  name: string | null
}

interface PortalRoleRow {
  id: string
  user_id: string | null
  email: string | null
  role: string
  repreneur_id: string | null
  access_enabled_at?: string | null
  last_access_email_sent_at?: string | null
}

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  }
  return pool
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}

function fullName(firstName: string | null | undefined, lastName: string | null | undefined) {
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
  return data as { id: string; first_name: string | null; last_name: string | null; email: string | null }
}

async function findAuthUserByEmail(email: string): Promise<AuthUserRow | null> {
  const { rows } = await getPool().query<AuthUserRow>(
    'SELECT id, email, name FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email]
  )
  return rows[0] ?? null
}

async function findAuthUserById(userId: string): Promise<AuthUserRow | null> {
  const { rows } = await getPool().query<AuthUserRow>(
    'SELECT id, email, name FROM "user" WHERE id = $1 LIMIT 1',
    [userId]
  )
  return rows[0] ?? null
}

async function ensureCredentialAccount(userId: string) {
  const { rows } = await getPool().query<{ id: string }>(
    'SELECT id FROM "account" WHERE "userId" = $1 AND "providerId" = $2 LIMIT 1',
    [userId, "credential"]
  )
  if (rows[0]) return true

  const unusablePassword = randomBytes(32).toString("base64url")
  const passwordHash = await hashPassword(unusablePassword)
  await getPool().query(
    `INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'credential', $4, NOW(), NOW())`,
    [randomId(), userId, userId, passwordHash]
  )
  return true
}

async function createAuthUser(email: string, name: string): Promise<AuthUserRow> {
  const id = randomId()
  await getPool().query(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
    [id, email, name]
  )
  await ensureCredentialAccount(id)
  return { id, email, name }
}

async function getCredentialAccountState(userId: string | null) {
  if (!userId) return false
  const { rows } = await getPool().query<{ has_password: boolean }>(
    'SELECT password IS NOT NULL AS has_password FROM "account" WHERE "userId" = $1 AND "providerId" = $2 LIMIT 1',
    [userId, "credential"]
  )
  return Boolean(rows[0]?.has_password)
}

async function countActiveSessions(userIds: string[]) {
  if (userIds.length === 0) return 0
  const { rows } = await getPool().query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM "session" WHERE "userId" = ANY($1::text[]) AND "expiresAt" > NOW()',
    [userIds]
  )
  return Number(rows[0]?.count ?? 0)
}

async function sendAccessEmail(email: string, failureMessage: string) {
  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: "/auth/reset-password",
      },
    })
  } catch (error) {
    console.error("Failed to send repreneur portal access email", error)
    throw new Error(failureMessage)
  }
}

export async function getRepreneurPortalAccessStatus(repreneurId: string): Promise<RepreneurPortalAccessStatus> {
  await requireStaffAccess()

  const repreneur = await getRepreneur(repreneurId)
  const normalizedEmail = normalizeEmail(repreneur.email)
  const supabase = createAdminClient()

  const { data: roleRows, error: roleError } = await supabase
    .from("app_user_roles")
    .select("id, user_id, email, role, repreneur_id, access_enabled_at, last_access_email_sent_at")
    .or(`repreneur_id.eq.${repreneurId}${normalizedEmail ? `,email.ilike.${normalizedEmail}` : ""}`)
    .limit(20)

  if (roleError && roleError.code !== "42P01") throw new Error(roleError.message)

  const roles = (roleRows as PortalRoleRow[] | null) ?? []
  const role =
    roles.find((row) => row.role === "repreneur" && row.repreneur_id === repreneurId) ??
    roles.find((row) => row.role === "repreneur" && normalizeEmail(row.email) === normalizedEmail) ??
    null

  const authUser =
    role?.user_id ? await findAuthUserById(role.user_id) : normalizedEmail ? await findAuthUserByEmail(normalizedEmail) : null
  const hasCredentialAccount = await getCredentialAccountState(authUser?.id ?? null)
  const activeSessionCount = authUser?.id ? await countActiveSessions([authUser.id]) : 0

  return {
    repreneurId,
    repreneurEmail: normalizedEmail,
    repreneurName: fullName(repreneur.first_name, repreneur.last_name),
    enabled: Boolean(role && authUser && hasCredentialAccount && role.repreneur_id === repreneurId),
    hasAuthUser: Boolean(authUser),
    hasCredentialAccount,
    linkedUserId: authUser?.id ?? role?.user_id ?? null,
    roleId: role?.id ?? null,
    roleEmail: role?.email ?? null,
    roleRepreneurId: role?.repreneur_id ?? null,
    accessEnabledAt: role?.access_enabled_at ?? null,
    lastAccessEmailSentAt: role?.last_access_email_sent_at ?? null,
    activeSessionCount,
  }
}

export async function enableRepreneurPortalAccess(repreneurId: string) {
  await requireStaffAccess()

  const repreneur = await getRepreneur(repreneurId)
  const email = normalizeEmail(repreneur.email)
  if (!email) throw new Error("This repreneur needs an email before portal access can be enabled.")

  const name = fullName(repreneur.first_name, repreneur.last_name)
  const existingUser = await findAuthUserByEmail(email)
  const authUser = existingUser ?? await createAuthUser(email, name)
  await ensureCredentialAccount(authUser.id)

  const supabase = createAdminClient()
  const { data: existingRoles, error: roleLookupError } = await supabase
    .from("app_user_roles")
    .select("id, user_id, email, role, repreneur_id")
    .or(`email.ilike.${email},user_id.eq.${authUser.id},repreneur_id.eq.${repreneurId}`)
    .limit(20)

  if (roleLookupError && roleLookupError.code !== "42P01") throw new Error(roleLookupError.message)

  const roles = (existingRoles as PortalRoleRow[] | null) ?? []
  const staffRole = roles.find((row) => row.role === "staff")
  if (staffRole) {
    throw new Error("This email is already assigned to staff access. Staff emails cannot be enabled as repreneur portal users.")
  }

  const existingRepreneurRole =
    roles.find((row) => row.role === "repreneur" && normalizeEmail(row.email) === email) ??
    roles.find((row) => row.role === "repreneur" && row.repreneur_id === repreneurId) ??
    roles.find((row) => row.role === "repreneur" && row.user_id === authUser.id) ??
    null

  await sendAccessEmail(email, "Portal access was not enabled because the setup email could not be sent. Please retry in a moment.")

  const now = new Date().toISOString()
  const rolePayload = {
    user_id: authUser.id,
    email,
    role: "repreneur",
    repreneur_id: repreneurId,
    access_enabled_at: now,
    last_access_email_sent_at: now,
  }

  const roleWrite = existingRepreneurRole
    ? await supabase.from("app_user_roles").update(rolePayload).eq("id", existingRepreneurRole.id)
    : await supabase.from("app_user_roles").insert(rolePayload)

  if (roleWrite.error) {
    throw new Error(`The setup email was sent, but portal access could not be linked: ${roleWrite.error.message}`)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/repreneurs")
  revalidatePath("/portal/deals")
  revalidatePath("/portal/profile")

  return { success: true }
}

export async function resendRepreneurPortalAccessLink(repreneurId: string) {
  await requireStaffAccess()

  const status = await getRepreneurPortalAccessStatus(repreneurId)
  const email = normalizeEmail(status.repreneurEmail)
  if (!email) throw new Error("This repreneur needs an email before a portal access link can be sent.")
  if (!status.linkedUserId || !status.enabled) {
    throw new Error("Enable portal access before resending an access link.")
  }

  await sendAccessEmail(email, "The access link could not be sent. Please retry in a moment.")

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("app_user_roles")
    .update({
      last_access_email_sent_at: new Date().toISOString(),
    })
    .eq("id", status.roleId)

  if (error) {
    throw new Error(`The access email was sent, but the sent timestamp could not be saved: ${error.message}`)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  return { success: true }
}

export async function disableRepreneurPortalAccess(repreneurId: string) {
  await requireStaffAccess()

  const status = await getRepreneurPortalAccessStatus(repreneurId)
  const userIds = status.linkedUserId ? [status.linkedUserId] : []

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("app_user_roles")
    .delete()
    .eq("role", "repreneur")
    .or(`repreneur_id.eq.${repreneurId}${status.repreneurEmail ? `,email.ilike.${status.repreneurEmail}` : ""}`)

  if (error && error.code !== "42P01") throw new Error(error.message)

  if (userIds.length > 0) {
    await getPool().query('DELETE FROM "session" WHERE "userId" = ANY($1::text[])', [userIds])
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/repreneurs")
  revalidatePath("/portal/deals")
  revalidatePath("/portal/profile")

  return { success: true }
}

import { redirect } from "next/navigation"
import { getCurrentUser, requireUser } from "@/lib/auth-server"
import { createAdminClient } from "@/lib/supabase/admin"

export type AppUserRole = "staff" | "repreneur"
export type CurrentUserRole = AppUserRole | "unassigned"

export interface CurrentUserAccess {
  user: Awaited<ReturnType<typeof requireUser>>
  role: CurrentUserRole
  repreneurId: string | null
  repreneurName: string | null
}

interface RoleRow {
  role: AppUserRole
  user_id?: string | null
  email?: string | null
  repreneur_id?: string | null
}

interface RepreneurAccessRow {
  id: string
  first_name: string | null
  last_name: string | null
  email?: string | null
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}

function sameNormalizedEmail(candidate: string | null | undefined, email: string) {
  return normalizeEmail(candidate) === email
}

function displayName(row: RepreneurAccessRow | null) {
  if (!row) return null
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || null
}

function hasPortalAccess(access: CurrentUserAccess | null) {
  return Boolean(access?.role === "repreneur" && access.repreneurId)
}

async function findRole(email: string, userId: string): Promise<RoleRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("app_user_roles")
    .select("role, email, user_id, repreneur_id")
    .or(`email.ilike.${email},user_id.eq.${userId}`)
    .limit(20)

  if (error) {
    if (error.code === "42P01") return null
    throw new Error(error.message)
  }

  const roles = ((data as RoleRow[] | null) ?? []).filter(
    (row) => sameNormalizedEmail(row.email, email) || row.user_id === userId
  )
  const staffRole = roles.find((row) => row.role === "staff")
  if (staffRole) return staffRole

  const repreneurRole =
    roles.find((row) => row.role === "repreneur" && row.user_id === userId) ??
    roles.find((row) => row.role === "repreneur" && sameNormalizedEmail(row.email, email)) ??
    null
  return repreneurRole
}

async function findRepreneurByEmail(
  email: string,
  supabase = createAdminClient()
): Promise<RepreneurAccessRow | null> {
  const { data, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email")
    .ilike("email", email)
    .limit(20)

  if (error) throw new Error(error.message)
  return ((data as RepreneurAccessRow[] | null) ?? []).find((row) => sameNormalizedEmail(row.email, email)) ?? null
}

async function findRepreneurById(id: string, supabase = createAdminClient()): Promise<RepreneurAccessRow | null> {
  const { data, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email")
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as RepreneurAccessRow | null) ?? null
}

async function findRepreneurForRole(role: RoleRow, fallbackEmail: string): Promise<RepreneurAccessRow | null> {
  const supabase = createAdminClient()
  if (role.repreneur_id) {
    const linkedRepreneur = await findRepreneurById(role.repreneur_id, supabase)
    if (linkedRepreneur) return linkedRepreneur
  }

  return findRepreneurByEmail(fallbackEmail, supabase)
}

export async function getCurrentUserAccess(): Promise<CurrentUserAccess | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const email = normalizeEmail(user.email)
  if (!email) {
    return {
      user,
      role: "unassigned",
      repreneurId: null,
      repreneurName: null,
    }
  }

  const explicitRole = await findRole(email, user.id)

  if (explicitRole?.role === "staff") {
    return {
      user,
      role: "staff",
      repreneurId: null,
      repreneurName: null,
    }
  }

  if (explicitRole?.role === "repreneur") {
    const repreneur = await findRepreneurForRole(explicitRole, email)
    return {
      user,
      role: "repreneur",
      repreneurId: repreneur?.id ?? null,
      repreneurName: displayName(repreneur),
    }
  }

  return {
    user,
    role: "unassigned",
    repreneurId: null,
    repreneurName: null,
  }
}

export async function getPostLoginDestination() {
  const access = await getCurrentUserAccess()
  if (!access) return "/auth/login"
  if (access.role === "staff") return "/dashboard_re"
  if (hasPortalAccess(access)) return "/portal/deals"
  return "/auth/logout"
}

export async function requireStaffAccess() {
  const access = await getCurrentUserAccess()
  if (!access) redirect("/auth/login")
  if (access.role === "repreneur" && access.repreneurId) redirect("/portal/deals")
  if (access.role !== "staff") redirect("/auth/logout")
  return access
}

export async function requirePortalAccess() {
  const access = await getCurrentUserAccess()
  if (!access) redirect("/auth/login")
  if (hasPortalAccess(access)) return access
  if (access.role === "staff") redirect("/dashboard_re")
  redirect("/auth/logout")
}

export async function requireAuthenticatedAccess() {
  const user = await requireUser()
  return user
}

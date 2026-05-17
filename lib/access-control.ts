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
  email?: string | null
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

async function findRoleByEmail(email: string, userId: string): Promise<AppUserRole | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("app_user_roles")
    .select("role, email")
    .ilike("email", email)
    .limit(20)

  if (error) {
    if (error.code === "42P01") return null
    throw new Error(error.message)
  }

  const role = ((data as RoleRow[] | null) ?? []).find((row) => sameNormalizedEmail(row.email, email))?.role ?? null
  if (role) return role

  const { data: userRole, error: userRoleError } = await supabase
    .from("app_user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (userRoleError) {
    if (userRoleError.code === "42P01") return null
    throw new Error(userRoleError.message)
  }

  return (userRole as RoleRow | null)?.role ?? null
}

async function findRepreneurByEmail(email: string): Promise<RepreneurAccessRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email")
    .ilike("email", email)
    .limit(20)

  if (error) throw new Error(error.message)
  return ((data as RepreneurAccessRow[] | null) ?? []).find((row) => sameNormalizedEmail(row.email, email)) ?? null
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

  const [explicitRole, repreneur] = await Promise.all([
    findRoleByEmail(email, user.id),
    findRepreneurByEmail(email),
  ])
  // Explicit platform roles are the source of truth; staff wins over a repreneur email match.
  const role: CurrentUserRole = explicitRole ?? (repreneur ? "repreneur" : "unassigned")

  return {
    user,
    role,
    repreneurId: repreneur?.id ?? null,
    repreneurName: displayName(repreneur),
  }
}

export async function getPostLoginDestination() {
  const access = await getCurrentUserAccess()
  if (!access) return "/auth/login"
  if (access.role === "staff") return "/dashboard"
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
  if (access.role === "staff") redirect("/dashboard")
  redirect("/auth/logout")
}

export async function requireAuthenticatedAccess() {
  const user = await requireUser()
  return user
}

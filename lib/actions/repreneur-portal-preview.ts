"use server"

import { requireStaffAccess } from "@/lib/access-control"
import {
  normalizePortalRepreneurProfile,
  PORTAL_REPRENEUR_PROFILE_SELECT,
  type PortalRepreneurProfile,
} from "@/lib/data/portal-profile"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import { getStaffPreviewRepreneurOpportunity, listStaffPreviewOwnedOpportunities, listStaffPreviewRepreneurDealFlow } from "@/lib/actions/repreneur-opportunities"
import type { RepreneurDealSort } from "@/lib/utils/repreneur-deal-flow"
import type { ExternalPursuitBoardRecord } from "@/lib/types/external-pursuit"

interface PortalRoleRow {
  role: string
  email: string | null
  repreneur_id: string | null
}

interface PreviewRepreneurRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  lifecycle_status: string | null
  is_demo: boolean
}

export interface StaffPortalPreviewOption {
  id: string
  name: string
  email: string | null
  lifecycleStatus: string | null
  portalRoleLinked: boolean
  isDemo: boolean
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}

function fullName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Unnamed repreneur"
}

export async function listStaffPortalPreviewOptions(): Promise<StaffPortalPreviewOption[]> {
  await requireStaffAccess()

  const supabase = createAdminClient()
  const [repreneursResult, rolesResult] = await Promise.all([
    supabase
      .from("repreneurs")
      .select("id, first_name, last_name, email, lifecycle_status, is_demo")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("app_user_roles")
      .select("role, email, repreneur_id")
      .eq("role", "repreneur"),
  ])

  if (repreneursResult.error) throw new Error(repreneursResult.error.message)
  if (rolesResult.error && rolesResult.error.code !== "42P01") throw new Error(rolesResult.error.message)
  const roles = (rolesResult.data as PortalRoleRow[] | null) ?? []
  const repreneurs = (repreneursResult.data as PreviewRepreneurRow[] | null) ?? []
  const existingIds = new Set(repreneurs.map((repreneur) => repreneur.id))
  const roleRepreneurIds = new Set(roles.map((role) => role.repreneur_id).filter(Boolean))
  const fallbackRoleEmails = new Set(roles
    .filter((role) => !role.repreneur_id || !existingIds.has(role.repreneur_id))
    .map((role) => normalizeEmail(role.email))
    .filter(Boolean))
  return repreneurs.map((repreneur) => {
    const normalizedEmail = normalizeEmail(repreneur.email)

    return {
      id: repreneur.id,
      name: fullName(repreneur.first_name, repreneur.last_name),
      email: normalizedEmail,
      lifecycleStatus: repreneur.lifecycle_status,
      portalRoleLinked: roleRepreneurIds.has(repreneur.id) || Boolean(normalizedEmail && fallbackRoleEmails.has(normalizedEmail)),
      isDemo: repreneur.is_demo,
    }
  })
}

/** Exact-owner, owner-safe External Pursuit projection for a staff-selected portal. */
export async function listStaffPortalPreviewExternalPursuits(
  repreneurId: string,
): Promise<ExternalPursuitBoardRecord[]> {
  await requireStaffAccess()
  if (!isUuid(repreneurId)) return []

  const supabase = createAdminClient()
  const { data: owner, error: ownerError } = await supabase
    .from("repreneurs")
    .select("id, is_demo")
    .eq("id", repreneurId)
    .maybeSingle()
  if (ownerError) throw new Error(ownerError.message)
  if (!owner || typeof owner.is_demo !== "boolean") return []

  // Do not use the all-owner staff board here: it also contains staff-only notes.
  const { data: dossiers, error: dossierError } = await supabase
    .from("external_pursuits")
    .select("id, owner_repreneur_id, title, stage, availability, deletion_status, external_url, target_company, source_channel, revenue_meur, ebitda_keur, headcount, next_action, responsible_party, due_at, updated_at")
    .eq("owner_repreneur_id", repreneurId)
    .eq("deletion_status", "active")
    .order("updated_at", { ascending: false })
  if (dossierError) throw new Error(dossierError.message)
  const active = dossiers ?? []
  if (active.some((row) => row.owner_repreneur_id !== repreneurId || row.deletion_status !== "active")) {
    throw new Error("Selected-owner dossier mismatch.")
  }
  const dossierIds = active.map((row) => row.id)
  if (dossierIds.length === 0) return []

  const [notesResult, contactsResult, conversionsResult] = await Promise.all([
    supabase.from("external_pursuit_notes")
      .select("external_pursuit_id, shared_notes")
      .in("external_pursuit_id", dossierIds),
    supabase.from("external_pursuit_contacts")
      .select("id, external_pursuit_id, name, organisation, role_title, email, phone")
      .in("external_pursuit_id", dossierIds)
      .order("created_at", { ascending: true }),
    supabase.from("external_pursuit_opportunity_conversions")
      .select("external_pursuit_id")
      .in("external_pursuit_id", dossierIds),
  ])
  if (notesResult.error) throw new Error(notesResult.error.message)
  if (contactsResult.error) throw new Error(contactsResult.error.message)
  if (conversionsResult.error) throw new Error(conversionsResult.error.message)
  const sharedNotes = new Map((notesResult.data ?? []).map((row) => [row.external_pursuit_id, row.shared_notes]))
  const convertedIds = new Set((conversionsResult.data ?? []).map((row) => row.external_pursuit_id))
  const contactsByDossier = new Map<string, ExternalPursuitBoardRecord["contacts"]>()
  for (const contact of contactsResult.data ?? []) {
    const records = contactsByDossier.get(contact.external_pursuit_id) ?? []
    records.push({
      id: contact.id,
      name: contact.name,
      organisation: contact.organisation,
      roleTitle: contact.role_title,
      email: contact.email,
      phone: contact.phone,
    })
    contactsByDossier.set(contact.external_pursuit_id, records)
  }

  return active.map((row) => ({
    id: row.id,
    ownerRepreneurId: row.owner_repreneur_id,
    ownerName: null,
    title: row.title,
    stage: row.stage,
    availability: row.availability,
    deletionStatus: "active" as const,
    isOpenCapacity: !["completed", "dropped_archived"].includes(row.stage) && !convertedIds.has(row.id),
    externalUrl: row.external_url,
    targetCompany: row.target_company,
    sourceChannel: row.source_channel,
    revenueMeur: row.revenue_meur === null ? null : Number(row.revenue_meur),
    ebitdaKeur: row.ebitda_keur === null ? null : Number(row.ebitda_keur),
    headcount: row.headcount,
    contacts: contactsByDossier.get(row.id) ?? [],
    nextAction: row.next_action,
    responsibleParty: row.responsible_party,
    dueAt: row.due_at,
    sharedNotes: sharedNotes.get(row.id) ?? null,
    updatedAt: row.updated_at,
  }))
}

export async function getStaffPortalPreviewProfile(repreneurId: string): Promise<{
  repreneur: PortalRepreneurProfile | null
}> {
  await requireStaffAccess()
  if (!isUuid(repreneurId)) return { repreneur: null }

  const supabase = createAdminClient()
  const { data: repreneur, error } = await supabase
    .from("repreneurs")
    .select(PORTAL_REPRENEUR_PROFILE_SELECT)
    .eq("id", repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return { repreneur: normalizePortalRepreneurProfile(repreneur) }
}

export async function listStaffPortalPreviewOwnedOpportunities(repreneurId: string) {
  return listStaffPreviewOwnedOpportunities(repreneurId)
}

export async function listStaffPortalPreviewOpportunities(repreneurId: string, selectedDealId?: string | null, sort: RepreneurDealSort = "relevance") {
  await requireStaffAccess()
  const result = await listStaffPreviewRepreneurDealFlow(repreneurId, sort, selectedDealId)
  return { ...result, opportunities: result.deals }
}

export async function getStaffPortalPreviewOpportunity(repreneurId: string, dealId: string) {
  return getStaffPreviewRepreneurOpportunity(repreneurId, dealId)
}

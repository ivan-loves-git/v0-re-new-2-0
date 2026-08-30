import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { safePdrFilename } from "@/lib/pdr/attachment-path"
import type { PdrDisposition } from "@/lib/pdr/disposition-eligibility"

export const PDR_ATTACHMENT_BUCKET = "pdr-intake-attachments"
export const PDR_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "image/jpeg", "image/png",
])

export type { PdrDisposition } from "@/lib/pdr/disposition-eligibility"

export type PdrHistoryRequest = {
  id: string
  title: string
  originalText: string
  conversation: unknown[]
  screening: {
    proposalType: string
    problemStatement: string
    aiRationale: string
    status: string
  }
  requester: { displayName: string | null; userId: string | null; actor: string; legacyLabel: string }
  intakeProvenance: string | null
  disposition: { kind: PdrDisposition | null; byUserId: string | null; at: string | null; note: string }
  createdAt: string
  updatedAt: string
  attachments: PdrHistoryAttachment[]
  provenance: "proposal" | "request"
}
export type PdrHistoricalWorkCard = { id: string; referenceNumber: number; title: string; notes: string; status: string; owner: string; createdAt: string; updatedAt: string; attachments: PdrHistoryAttachment[] }

export type PdrHistoryAttachment = {
  id: string
  originalFilename: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

type ProposalRow = {
  id: string; original_text: string; conversation: unknown
  proposal_type: string; problem_statement: string; ai_rationale: string; status: string
  created_by: string; requester_actor: string; requester_user_id?: string | null; requester_display_name?: string | null; intake_provenance?: string | null
  disposition_kind?: string | null; disposition_by_user_id?: string | null; disposition_at?: string | null
  reviewer_note: string; created_at: string; updated_at: string
}
type RequestRow = { id: string; title: string; description: string; challenge_prompts: unknown; challenge_score: number; status: string; decision_note: string; created_by: string; created_at: string; updated_at: string }

function asArray(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }

function projectProposal(row: ProposalRow, attachments: PdrHistoryAttachment[]): PdrHistoryRequest {
  return {
    id: row.id,
    title: row.problem_statement?.trim() || "Untitled request",
    originalText: row.original_text,
    conversation: asArray(row.conversation),
    screening: { proposalType: row.proposal_type, problemStatement: row.problem_statement, aiRationale: row.ai_rationale, status: row.status },
    requester: { displayName: row.requester_display_name ?? null, userId: row.requester_user_id ?? null, actor: row.requester_actor, legacyLabel: row.created_by },
    intakeProvenance: row.intake_provenance ?? null,
    disposition: {
      kind: row.disposition_kind === "approved" || row.disposition_kind === "declined" ? row.disposition_kind : null,
      byUserId: row.disposition_by_user_id ?? null, at: row.disposition_at ?? null, note: row.reviewer_note,
    },
    createdAt: row.created_at, updatedAt: row.updated_at, attachments, provenance: "proposal",
  }
}
function projectRequest(row: RequestRow): PdrHistoryRequest {
  return { id: row.id, title: row.title, originalText: row.description, conversation: asArray(row.challenge_prompts), screening: { proposalType: "legacy_request", problemStatement: row.title, aiRationale: `Challenge score: ${row.challenge_score}`, status: row.status }, requester: { displayName: null, userId: null, actor: "", legacyLabel: row.created_by }, intakeProvenance: null, disposition: { kind: null, byUserId: null, at: null, note: row.decision_note }, createdAt: row.created_at, updatedAt: row.updated_at, attachments: [], provenance: "request" }
}

async function attachmentsFor(parentColumn: "proposal_id" | "work_card_id", parentIds: string[]) {
  if (!parentIds.length) return new Map<string, PdrHistoryAttachment[]>()
  const { data, error } = await createAdminClient().from("wave_pdr_history_attachments")
    .select("id, proposal_id, work_card_id, original_filename, content_type, size_bytes, created_at").in(parentColumn, parentIds)
    .order("created_at", { ascending: true })
  if (error) throw new Error("PDR history is temporarily unavailable.")
  const output = new Map<string, PdrHistoryAttachment[]>()
  for (const row of data ?? []) {
    const parentId = row[parentColumn]
    if (!parentId) continue
    const items = output.get(parentId) ?? []
    items.push({ id: row.id, originalFilename: row.original_filename, contentType: row.content_type, sizeBytes: row.size_bytes, createdAt: row.created_at })
    output.set(parentId, items)
  }
  return output
}

/** Server-only adapter. It never returns legacy attachment JSON/URLs to a browser. */
export async function listPdrRequestHistory(): Promise<PdrHistoryRequest[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from("pdr_proposals")
    .select("id, original_text, conversation, proposal_type, problem_statement, ai_rationale, status, created_by, requester_actor, requester_user_id, requester_display_name, intake_provenance, disposition_kind, disposition_by_user_id, disposition_at, reviewer_note, created_at, updated_at")
    .order("created_at", { ascending: false })
  const requestResult = await supabase.from("pdr_requests").select("id, title, description, challenge_prompts, challenge_score, status, decision_note, created_by, created_at, updated_at").order("created_at", { ascending: false })
  if (error || requestResult.error) throw new Error("PDR history is temporarily unavailable.")
  const rows = (data ?? []) as ProposalRow[]
  const attachments = await attachmentsFor("proposal_id", rows.map((row) => row.id))
  return [...rows.map((row) => projectProposal(row, attachments.get(row.id) ?? [])), ...((requestResult.data ?? []) as RequestRow[]).map(projectRequest)].sort((a,b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getPdrRequestHistory(id: string): Promise<PdrHistoryRequest | null> {
  const supabase = createAdminClient(); const { data, error } = await supabase.from("pdr_proposals")
    .select("id, original_text, conversation, proposal_type, problem_statement, ai_rationale, status, created_by, requester_actor, requester_user_id, requester_display_name, intake_provenance, disposition_kind, disposition_by_user_id, disposition_at, reviewer_note, created_at, updated_at")
    .eq("id", id).maybeSingle()
  if (error) throw new Error("PDR history is temporarily unavailable.")
  if (!data) { const { data: legacy, error: legacyError } = await supabase.from("pdr_requests").select("id, title, description, challenge_prompts, challenge_score, status, decision_note, created_by, created_at, updated_at").eq("id",id).maybeSingle(); if (legacyError) throw new Error("PDR history is temporarily unavailable."); return legacy ? projectRequest(legacy as RequestRow) : null }
  const row = data as ProposalRow
  const attachments = await attachmentsFor("proposal_id", [row.id])
  return projectProposal(row, attachments.get(row.id) ?? [])
}

export async function canDispositionPdr(userId: string) {
  const { data, error } = await createAdminClient().from("wave_pdr_governance_capabilities")
    .select("actor_user_id").eq("singleton", true).eq("actor_user_id", userId).eq("can_disposition", true).maybeSingle()
  if (error) throw new Error("PDR governance capability is unavailable.")
  return Boolean(data)
}

export async function listHistoricalPdrWorkCards(): Promise<PdrHistoricalWorkCard[]> {
  const { data, error } = await createAdminClient().from("pdr_work_cards").select("id, reference_number, title, notes, status, owner, created_at, updated_at").order("reference_number", { ascending: false })
  if (error) throw new Error("PDR Work Card history is temporarily unavailable.")
  const attachments = await attachmentsFor("work_card_id", (data ?? []).map((row) => row.id))
  return (data ?? []).map((row) => ({ id: row.id, referenceNumber: row.reference_number, title: row.title, notes: row.notes, status: row.status, owner: row.owner, createdAt: row.created_at, updatedAt: row.updated_at, attachments: attachments.get(row.id) ?? [] }))
}

export function assertPdrAttachment(file: File) {
  if (!file.name || file.size < 1 || file.size > PDR_ATTACHMENT_MAX_BYTES || !ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    throw new Error("Attachments must be an approved type and no larger than 4 MiB.")
  }
}

export function pdrAttachmentPath(proposalId: string, filename: string) {
  const safe = safePdrFilename(filename)
  return `${proposalId}/${crypto.randomUUID()}-${safe}`
}

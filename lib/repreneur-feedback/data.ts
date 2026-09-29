import "server-only"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { type FeedbackCategory, type FeedbackContext, type FeedbackStatus } from "./validation"

export type StaffFeedbackItem = {
  id: string
  category: FeedbackCategory
  context: FeedbackContext | null
  message: string | null
  status: FeedbackStatus
  createdAt: string
  redactedAt: string | null
  version: number
  repreneurName: string
}

export type StaffFeedbackPage = {
  items: StaffFeedbackItem[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 25

/** Staff-only service projection. No sender user ID or raw profile row reaches the UI. */
export async function listStaffRepreneurFeedback(
  status: FeedbackStatus,
  page: number,
): Promise<StaffFeedbackPage> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const safePage = Number.isSafeInteger(page) ? Math.max(0, Math.min(page, 1000)) : 0
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data, count, error } = await supabase
    .from("repreneur_feedback")
    .select("id,sender_repreneur_id,category,message,context_key,status,created_at,redacted_at,version", { count: "exact" })
    .eq("status", status)
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE - 1)

  if (error) throw new Error("The feedback queue is unavailable. Try again later.")
  const rows = data ?? []
  const ids = [...new Set(rows.map((row) => row.sender_repreneur_id))]
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: repreneurs, error: repreneurError } = await supabase
      .from("repreneurs")
      .select("id,first_name,last_name")
      .in("id", ids)
    if (repreneurError) throw new Error("The feedback queue is unavailable. Try again later.")
    for (const repreneur of repreneurs ?? []) {
      names.set(repreneur.id, [repreneur.first_name, repreneur.last_name].filter(Boolean).join(" ") || "Repreneur")
    }
  }
  return {
    items: rows.map((row) => ({
      id: row.id,
      category: row.category as FeedbackCategory,
      context: row.context_key as FeedbackContext | null,
      message: row.message,
      status: row.status as FeedbackStatus,
      createdAt: row.created_at,
      redactedAt: row.redacted_at,
      version: Number(row.version),
      repreneurName: names.get(row.sender_repreneur_id) ?? "Repreneur",
    })),
    total: count ?? 0,
    page: safePage,
    pageSize: PAGE_SIZE,
  }
}

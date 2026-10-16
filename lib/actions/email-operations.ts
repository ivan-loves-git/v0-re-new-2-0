"use server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAccess } from "@/lib/access-control"
import { emailReviewSearchPattern } from "@/lib/email/review-queue-query"
import { businessTrackingCapability } from "@/lib/email/business-mail"
export interface EmailHistoryRecord {
  id: string
  provider_message_id: string | null
  template_key: string
  subject: string | null
  body_text: string | null
  body_html: string | null
  recipient_email: string | null
  recipient_name: string | null
  cc: string[] | null
  status: string
  source_status: string
  sent_at: string | null
  created_at: string | null
  reason: string | null
  review_id: string | null
  opportunity_id: string | null
  repreneur_id: string | null
  namespace: string
  tracking_verified: boolean
  delivered: boolean
  opened: boolean
  clicked: boolean
  bounced: boolean
  category: string
}
const summaryColumns =
  "id,provider_message_id,template_key,subject,recipient_email,recipient_name,status,source_status,sent_at,created_at,reason,review_id,opportunity_id,repreneur_id,namespace,tracking_verified,delivered,opened,clicked,bounced,category"
export async function getEmailHistory(
  options: { search?: string; status?: string; page?: number; sent?: boolean } = {},
) {
  await requireStaffAccess()
  const search = (options.search ?? "").trim().slice(0, 120),
    page = Math.max(1, Math.min(100000, Math.trunc(options.page ?? 1))),
    size = options.sent ? 150 : 25
  let query = createAdminClient()
    .from("email_operations_history")
    .select(summaryColumns, { count: "exact" })
  if (search) query = query.ilike("search_text", emailReviewSearchPattern(search))
  if (options.status && options.status !== "all") query = query.eq("status", options.status)
  if (options.sent)
    query = query
      .not("provider_message_id", "is", null)
      .or("sent_at.not.is.null,source_status.in.(sent,delivered,opened,clicked,bounced,complained)")
  const { data, error, count } = await query
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(options.sent ? 0 : (page - 1) * size, options.sent ? 149 : page * size - 1)
  if (error || typeof count !== "number")
    throw new Error("Email history is unavailable. Retry to read the retained records.")
  return {
    records: (data ?? []) as unknown as EmailHistoryRecord[],
    total: count,
    page,
    pageSize: size,
    search,
  }
}
export async function getEmailHistoryDetail(id: string) {
  await requireStaffAccess()
  if (!/^(log|review|ma|handoff):[0-9a-f-]{36}$/i.test(id))
    throw new Error("Choose a valid retained record.")
  const db = createAdminClient(),
    { data, error } = await db
      .from("email_operations_history")
      .select("*")
      .eq("id", id)
      .maybeSingle()
  if (error || !data) throw new Error("This retained message is unavailable.")
  const record = data as EmailHistoryRecord
  // The personal access senders intentionally have no content ledger here.
  if (["portal_access_setup", "password_reset"].includes(record.template_key)) {
    record.body_text = null
    record.body_html = null
  }
  const events = record.provider_message_id
    ? await db
        .from("email_provider_events")
        .select("event_type,occurred_at,recipient_kind,reason")
        .eq("provider_message_id", record.provider_message_id)
        .order("occurred_at", { ascending: false })
        .limit(100)
    : { data: [], error: null }
  if (events.error) throw new Error("Message activity is unavailable; retry the detail.")
  return {
    record,
    events: [...(events.data ?? [])].reverse() as Array<{
      event_type: string
      occurred_at: string
      recipient_kind: string
      reason: string | null
    }>,
  }
}
export interface EmailOperationsAnalytics {
  state: "available" | "unavailable"
  from: string
  to: string
  days: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  coveredDelivered: number
  uncoveredSent: number
  openRate: number | null
  clickRate: number | null
  bounceRate: number | null
  daily: Array<{ date: string; count: number }>
  categories: Array<{ category: string; count: number }>
  tracking: string
}
export async function getEmailOperationsAnalytics(days = 30): Promise<EmailOperationsAnalytics> {
  await requireStaffAccess()
  days = [7, 30, 90].includes(days) ? days : 30
  const to = new Date().toISOString(),
    from = new Date(Date.parse(to) - days * 86400000).toISOString()
  const blank = {
    from,
    to,
    days,
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalBounced: 0,
    coveredDelivered: 0,
    uncoveredSent: 0,
    openRate: null,
    clickRate: null,
    bounceRate: null,
    daily: [],
    categories: [],
    tracking: businessTrackingCapability().reason,
  }
  const { data, error } = await createAdminClient().rpc("email_operations_analytics", {
    p_from: from,
    p_to: to,
  })
  if (
    error ||
    !data ||
    ![
      "totalSent",
      "totalDelivered",
      "totalBounced",
      "totalOpened",
      "totalClicked",
      "coveredDelivered",
      "uncoveredSent",
    ].every((key) => Number.isSafeInteger(data[key]) && data[key] >= 0) ||
    !Array.isArray(data.daily) ||
    !Array.isArray(data.categories)
  )
    return { ...blank, state: "unavailable" }
  return {
    ...blank,
    ...data,
    state: "available",
    from,
    to,
    days,
    openRate: data.coveredDelivered > 0 ? (data.totalOpened / data.coveredDelivered) * 100 : null,
    clickRate: data.coveredDelivered > 0 ? (data.totalClicked / data.coveredDelivered) * 100 : null,
    bounceRate: data.totalSent > 0 ? (data.totalBounced / data.totalSent) * 100 : null,
    categories: ["status", "intake", "offer", "ma"].map((category) => ({
      category,
      count:
        data.categories?.find(
          (item: { category: string; count: number }) => item.category === category,
        )?.count ?? 0,
    })),
  }
}

import "server-only"
import { createElement } from "react"
import { createAdminClient } from "@/lib/supabase/admin"
import { manualRecommendationEmail } from "@/lib/repreneur-matching-eligibility"
import { deliverNotification } from "@/lib/email/notification-delivery"
import { sendEmail } from "@/lib/email/send-email"
import { RecommendationAssignmentEmailV1 } from "@/lib/email/templates/recommendation-assignment-v1"
import type { OpportunityMatch } from "@/lib/types/opportunity"

export type RecommendationAssignmentDeliveryStatus = "sent" | "already_sent" | "busy" | "failed" | "blocked" | "not_requested"
export type RecommendationAssignmentDeliveryResult = { status: RecommendationAssignmentDeliveryStatus; message: string }

const messages: Record<RecommendationAssignmentDeliveryStatus, string> = {
  sent: "Recommendation saved. Assignment email sent.",
  already_sent: "Recommendation saved. Assignment email was already sent; no duplicate was sent.",
  busy: "Recommendation saved. An email attempt is in progress. Check its status before retrying.",
  failed: "Recommendation saved. Email delivery is not confirmed. Use Retry assignment email; do not create another recommendation.",
  blocked: "Recommendation saved. Email is blocked because recipient, public content, eligibility or template settings changed. Ask staff to review it.",
  not_requested: "Recommendation saved. No assignment email was requested for this existing or DEMO recommendation.",
}

const result = (status: RecommendationAssignmentDeliveryStatus): RecommendationAssignmentDeliveryResult => ({ status, message: messages[status] })
export const recommendationAssignmentKey = (notificationId: string) => `recommendation-assignment:${notificationId}`

// Called only after the staff match reader's authorization and namespace
// filter. Return content-free delivery state, never snapshot addresses/text.
export async function withAssignmentEmailStatus<T extends Pick<OpportunityMatch, "id">>(matches: T[], actor: string): Promise<(T & Pick<OpportunityMatch, "assignment_email_status">)[]> {
  const states = new Map<string, OpportunityMatch["assignment_email_status"]>()
  try {
    const db = createAdminClient()
    for (let offset = 0; offset < matches.length; offset += 100) {
      const { data: notifications, error } = await db.rpc("list_recommendation_assignment_notification_states", {
        p_match_ids: matches.slice(offset, offset + 100).map(match => match.id), p_actor: actor,
      })
      if (error) throw new Error("Delivery state unavailable")
      for (const notification of notifications ?? []) {
        const status = ["pending", "sent", "failed", "blocked", "review_required", "delivery_issue"].includes(notification.status)
          ? notification.status as OpportunityMatch["assignment_email_status"] : "unavailable"
        states.set(notification.match_id, status)
      }
    }
    return matches.map(match => ({ ...match, assignment_email_status: states.get(match.id) ?? null }))
  } catch {
    return matches.map(match => ({ ...match, assignment_email_status: "unavailable" }))
  }
}

// Not a server action. Callers must authenticate staff first; the service-only
// RPC repeats the exact current staff-id and mutable eligibility checks.
export async function deliverRecommendationAssignment(matchId: string, actor: string): Promise<RecommendationAssignmentDeliveryResult> {
  try {
    const db = createAdminClient()
    const { data: notification, error } = await db.from("opportunity_recommendation_assignment_notifications")
      .select("id").eq("match_id", matchId).maybeSingle()
    if (error) return result("failed")
    if (!notification) return result("not_requested")
    let blocked = false
    const delivery = await deliverNotification({
      idempotencyKey: recommendationAssignmentKey(notification.id),
      send: async (idempotencyKey) => {
        // Revalidate inside the acquired lease, not before waiting for it.
        const { data: payload, error: payloadError } = await db.rpc("get_recommendation_assignment_notification", {
          p_match_id: matchId, p_actor: actor,
        })
        const { data: template, error: templateError } = await db.from("email_templates")
          .select("is_active, requires_consent").eq("template_key", "opportunity_recommendation_assignment").maybeSingle()
        if (payloadError || !payload || payload.id !== notification.id || payload.copy_version !== 1
          || typeof payload.email_subject !== "string" || !payload.email_subject.trim()
          || !manualRecommendationEmail(payload.recipient_email) || templateError || !template || template.is_active !== true) {
          blocked = true
          return { success: false }
        }
        return sendEmail({
          to: payload.recipient_email, repreneurId: payload.repreneur_id,
          templateKey: "opportunity_recommendation_assignment", subject: payload.email_subject,
          react: createElement(RecommendationAssignmentEmailV1, {
            firstName: payload.recipient_first_name, publicTitle: payload.public_title, teaser: payload.teaser_summary,
          }),
          idempotencyKey,
        })
      },
    })
    if (delivery.status === "failed" && delivery.error?.includes("Review the provider record")) {
      return { status: "failed", message: "Recommendation saved. The earlier email attempt is uncertain and too old to retry safely. Staff must review the provider record before any further send." }
    }
    return result(blocked ? "blocked" : delivery.status)
  } catch {
    // Assignment persistence and mail delivery are separate outcomes. Never
    // expose provider/DB errors (which can contain addresses) in staff UI.
    return result("failed")
  }
}

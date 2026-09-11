"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendMaSourceWorkflowEmailPayload } from "@/lib/ma-workflows"
import { preparePursuitHandoff, beginPursuitHandoff, finalizePursuitHandoff, assertPursuitHandoffCurrent } from "@/lib/pursuit-handoff-delivery"
import { fingerprintResendDeliveryRequest, classifyResendDeliveryOutcome } from "@/lib/email/resend-delivery-outcome"
import { FROM_EMAIL, FROM_NAME, resend } from "@/lib/email/resend-client"
import { isMaContactEmailAddressSuppressed } from "@/lib/email/ma-contact-email-authorization"
import { env } from "@/lib/env"

function failure(error: unknown) {
  return { success: false as const, message: error instanceof Error ? error.message : "The current pursuit handoff could not be verified." }
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}

export async function sendPursuitIntermediaryHandoff(matchId: string, type: "e4" | "e7") {
  await requireStaffAccess()
  if (type !== "e4" && type !== "e7") return { success: false as const, message: "Unsupported intermediary handoff." }
  const db = createAdminClient()
  try {
    const { handoff, context } = await preparePursuitHandoff(db, matchId, type)
    const blankPresent = context.upstream.metadata?.blank_nda_present_at_validation
    if (type === "e4" && typeof blankPresent !== "boolean") throw new Error("This historical validation has no frozen NDA request. Record a new mutual-interest validation before starting a new handoff.")
    const body = type === "e4"
      ? `Bonjour {firstName},\n\nUn des repreneurs que nous accompagnons est intéressé par une de vos opportunités : {opportunityTitle}.${blankPresent ? "\n\nLe NDA de votre cabinet étant déjà en notre possession, nous attendons votre validation avant de le faire signer au repreneur." : "\n\nPourriez-vous, s'il vous plaît, nous transmettre un NDA à signer afin de recevoir l'IM ?"}\n\nBien à vous,\n\nL'équipe Re-New`
      : "Bonjour {firstName},\n\nVous trouverez ci-joint le NDA signé par le repreneur et par nous pour l'opportunité : {opportunityTitle}.\n\nPourriez-vous, s'il vous plaît, nous transmettre l'IM et les éléments de présentation disponibles sur le dossier ?\n\nBien à vous,\n\nL'équipe Re-New"
    const result = await sendMaSourceWorkflowEmailPayload(handoff.opportunityId, { templateKey: "ma_nda_info_memo_request", subject: type === "e4" ? "Processus NDA - {opportunityTitle}" : "NDA signé - Demande de mémo d'information - {opportunityTitle}", body, clientOperationKey: handoff.upstreamId }, handoff)
    if (!result.success || !result.eventId) return { success: false as const, message: result.message }
    return { success: true as const, message: type === "e4" ? "Qualification request sent." : "Signed copies and memo request sent.", eventId: result.eventId }
  } catch (error) { return failure(error) }
}

export async function sendPursuitNdaReadyNotice(matchId: string) {
  const staff = await requireStaffAccess()
  const db = createAdminClient()
  try {
    const { handoff, context } = await preparePursuitHandoff(db, matchId, "e6")
    const email = context.repreneur.email?.trim()
    if (!email) throw new Error("Add an email to this repreneur before sending the NDA-ready notice.")
    if (await isMaContactEmailAddressSuppressed(email)) throw new Error("The existing email suppression policy blocks this recipient.")
    const url = `${(env.NEXT_PUBLIC_APP_URL ?? "https://app.re-new.team").replace(/\/$/, "")}/portal/deals/${matchId}`
    const text = `Bonjour${context.repreneur.first_name ? ` ${context.repreneur.first_name}` : ""},\n\nLe NDA de l'opportunité est désormais disponible sur votre espace Re-New Wave.\n\nNous enverrons la demande du mémo dès que le NDA aura été signé et uploadé dans la plateforme.\n\nSi vous avez la moindre question sur le contenu du document, n'hésitez pas à revenir vers nous avant signature.\n\nAccéder à mon espace : ${url}\n\nMerci,\n\nL'équipe Re-New`
    const request = { from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [email], subject: "Votre NDA est prêt à signer", html: `<p>${escapeHtml(text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`, text }
    const attempt = await beginPursuitHandoff(db, handoff, fingerprintResendDeliveryRequest(request, `e6:${handoff.upstreamId}`), staff.user.email)
    if (attempt.delivery_status === "sent" && attempt.evidence_id) return { success: true as const, message: "NDA-ready notice was already sent.", eventId: attempt.evidence_id }
    if (attempt.delivery_status === "in_flight") return { success: false as const, message: "The NDA-ready notice is still in flight. Retry the unchanged notice in two minutes." }
    await assertPursuitHandoffCurrent(db, handoff)
    // Recheck the exact recipient and suppression immediately before provider I/O.
    const { data: current, error } = await db.from("repreneurs").select("email").eq("id", context.repreneur.id).maybeSingle()
    if (error || current?.email?.trim() !== email || await isMaContactEmailAddressSuppressed(email)) throw new Error("The NDA-ready recipient changed or cannot receive email. No new email was sent.")
    let outcome
    try { outcome = classifyResendDeliveryOutcome(await resend.emails.send(request, { idempotencyKey: attempt.operation_key })) }
    catch { return { success: false as const, message: "The NDA-ready result is uncertain. Retry this unchanged notice in two minutes; its send key will be reused." } }
    if (outcome.outcome === "pending") return { success: false as const, message: "The NDA-ready result is uncertain. Retry this unchanged notice in two minutes; its send key will be reused." }
    let eventId
    try { eventId = await finalizePursuitHandoff(db, attempt, staff.user.email, outcome.outcome, outcome.outcome === "sent" ? outcome.providerMessageId : null, outcome.outcome === "failed" ? outcome.error : null) }
    catch { return { success: false as const, message: "The provider result needs to be recorded. Retry this unchanged notice in two minutes to reconcile it safely." } }
    if (outcome.outcome === "failed") return { success: false as const, message: "The provider rejected the NDA-ready notice. Correct the sending problem, then retry this handoff." }
    return { success: true as const, message: "NDA-ready notice sent.", eventId: eventId! }
  } catch (error) { return failure(error) }
}

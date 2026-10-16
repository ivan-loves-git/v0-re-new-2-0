import { z } from "zod"
import { OPPORTUNITY_PAUSE_REASON_OPTIONS, type OpportunityPauseReason } from "@/lib/opportunity-outcome-reasons"

export const PUBLIC_PAUSE_REASONS = {
  paused_cabinet: "Mise en pause par le cabinet",
  seller_paused_sale: "Le cédant a suspendu la vente",
  exclusivity_another_buyer: "Une exclusivité a été accordée à un autre acquéreur",
  waiting_updated_information: "En attente d’informations ou de données financières actualisées",
  other: "Autre motif de suspension",
} satisfies Record<OpportunityPauseReason, string>

export const PAUSE_EMAIL_SUBJECT = "L’opportunité {opportunityTitle} est en pause"
export const PAUSE_EMAIL_BODY = "Bonjour {firstName},\n\nL’opportunité {opportunityTitle} est temporairement mise en pause."

export const pauseNotificationSourceContext = z.object({
  kind: z.literal("opportunity_pause"),
  notificationId: z.string().uuid(),
  pauseId: z.string().uuid(),
  matchId: z.string().uuid(),
})

export const pauseNotificationPayload = z.object({
  notificationId: z.string().uuid(),
  pauseId: z.string().uuid(),
  matchId: z.string().uuid(),
  repreneurId: z.string().uuid(),
  recipientEmail: z.string().email(),
  firstName: z.string(),
  publicTitle: z.string().trim().min(1),
  reason: z.enum(OPPORTUNITY_PAUSE_REASON_OPTIONS.map(option => option.value)),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
})

export function renderOpportunityPauseCopy(payload: z.infer<typeof pauseNotificationPayload>) {
  const variables: Record<string, string> = {
    firstName: payload.firstName,
    opportunityTitle: payload.publicTitle,
    pauseReason: PUBLIC_PAUSE_REASONS[payload.reason],
  }
  const substitute = (text: string) => text.replace(/\{(\w+)\}/g, (token, key: string) => variables[key] ?? token)
  return { subject: substitute(payload.subject), body: payload.body, variables, reason: variables.pauseReason }
}

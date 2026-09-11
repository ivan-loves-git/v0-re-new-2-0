import type { EmailTemplateKey } from "@/lib/types/email"

// Colin's catalogue defaults. Database overrides remain authoritative.
export const TEMPLATE_DEFAULT_SUBJECTS: Partial<Record<EmailTemplateKey, string>> = {
  ma_opportunity_validity_check: "Statut du process pour {opportunityTitle}",
  ma_process_follow_up: "Toujours d'actualité ? — {opportunityTitle}",
  booking_reminder: "Réservez votre entretien avec Re-New",
  interview_reminder: "Rappel — votre entretien avec Re-New",
}

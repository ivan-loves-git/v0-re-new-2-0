import type { EmailTemplateKey } from "@/lib/types/email"

// Colin's catalogue defaults. Database overrides remain authoritative.
export const TEMPLATE_DEFAULT_SUBJECTS: Partial<Record<EmailTemplateKey, string>> = {
  welcome: "Votre inscription Re-New est confirmée",
  thank_you: "Votre inscription Re-New est confirmée",
  rejection: "Suite à la revue de votre dossier repreneur",
  ma_opportunity_validity_check: "Statut du process pour {opportunityTitle}",
  ma_process_follow_up: "Toujours d'actualité ? — {opportunityTitle}",
  booking_reminder: "Réservez votre entretien avec Re-New",
  interview_reminder: "Rappel — votre entretien avec Re-New",
  memo_feedback_reminder: "Un retour sur votre mémorandum — {opportunityTitle}",
  recommendation_response_reminder: "Votre recommandation — {opportunityTitle}",
  recommendation_unanswered_staff_alert: "Recommandation sans réponse — {opportunityTitle}",
  interest_outcome_validated: "Suite à votre intérêt pour {opportunityTitle}",
  interest_outcome_rejected: "Suite à votre intérêt pour {opportunityTitle}",
  proposed_opportunity_response_staff: "Réponse à une opportunité proposée — {opportunityTitle}",
}

// Exact shipped subjects only: staff-written subjects remain authoritative.
// Resolve at read time so alignment needs no reset of stored templates or flags.
const PREVIOUS_DEFAULT_SUBJECTS: Partial<Record<EmailTemplateKey, readonly string[]>> = {
  welcome: ["Bienvenue chez Re-New!", "Bienvenue chez Re-New !", "Bienvenue chez Re-New"],
  thank_you: ["Thank you for completing your Re-New profile", "Merci pour votre inscription chez Re-New!", "Merci pour votre inscription Re-New"],
  rejection: ["Update on your Re-New application", "Mise à jour concernant votre candidature Re-New"],
  ma_opportunity_validity_check: ["Point rapide sur {opportunityTitle}"],
  ma_process_follow_up: ["Suivi de process - {opportunityTitle}", "Suivi du processus vendeur - {opportunityTitle}"],
  booking_reminder: ["Planifions un premier échange Re-New", "Planifiez votre entretien Re-New"],
  interview_reminder: ["Rappel : votre entretien Re-New demain", "Rappel de votre entretien Re-New"],
}

export function resolveTemplateSubject(templateKey: EmailTemplateKey, stored: string | null | undefined, fallback = "") {
  const subject = stored?.trim()
  if (subject && !PREVIOUS_DEFAULT_SUBJECTS[templateKey]?.includes(subject)) return subject
  return TEMPLATE_DEFAULT_SUBJECTS[templateKey] || subject || fallback
}

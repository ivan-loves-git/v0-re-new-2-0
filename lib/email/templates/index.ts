// Email templates registry

export { BaseLayout, heading, paragraph, button, highlight, highlightText } from "./base-layout"
export { WelcomeEmail } from "./welcome"
export { FormStepCompleteEmail } from "./form-step-complete"
export { AbandonedReminderEmail } from "./abandoned-reminder"
export { ThankYouEmail } from "./thank-you"
export { HighScoreAlertEmail } from "./high-score-alert"
export { OfferReceivedEmail } from "./offer-received"
export { MilestoneCompletedEmail } from "./milestone-completed"
export { OfferAcceptedEmail } from "./offer-accepted"
export { OfferActivatedEmail } from "./offer-activated"
export { RejectionEmail } from "./rejection"
export { InterviewReminderEmail } from "./interview-reminder"
export { BookingReminderEmail } from "./booking-reminder"
export { MaIntermediaryEmail } from "./ma-intermediary"

import type { EmailTemplateKey } from "@/lib/types/email"

export type EmailTemplateAudience = "rep" | "opp"
export type EmailTemplateCategory = "intake" | "offer" | "status" | "ma"

export const TEMPLATE_AUDIENCE_LABELS: Record<EmailTemplateAudience, string> = {
  rep: "Rep",
  opp: "Opp",
}

export const MA_TEMPLATE_DEFAULT_BODIES: Partial<Record<EmailTemplateKey, string>> = {
  ma_opportunity_validity_check: `Bonjour {firstName},

Je me permets de vous contacter au sujet de {opportunityTitle}.

Pouvez-vous me confirmer si l'opportunite est toujours active, et si le calendrier vendeur a evolue depuis notre dernier echange ?

Si elle est toujours ouverte, nous serions preneurs des prochaines etapes utiles pour qualifier l'interet cote Re-New.

Merci beaucoup,

L'equipe Re-New`,
  ma_request_more_information: `Bonjour {firstName},

Merci pour les premiers elements partages sur {opportunityTitle}.

Pour avancer proprement cote Re-New, pourriez-vous nous transmettre les elements disponibles sur le perimetre, la rentabilite, le calendrier, et les attentes du vendeur ?

Une version anonymisee suffit si certains elements doivent rester confidentiels a ce stade.

Merci beaucoup,

L'equipe Re-New`,
  ma_repreneur_interest_feedback: `Bonjour {firstName},

Nous avons un retour d'interet cote Re-New pour {opportunityTitle}.

Le profil concerne {repreneurName}. A ce stade, l'interet semble coherent avec le secteur, la taille d'entreprise, et la maturite du projet.

Pouvez-vous nous indiquer si vous souhaitez recevoir un court profil anonymise, ou si vous preferez organiser {nextStep} ?

Merci beaucoup,

L'equipe Re-New`,
  ma_process_follow_up: `Bonjour {firstName},

Je reviens vers vous concernant {opportunityTitle}.

Pouvez-vous nous confirmer ou en est le process, les prochaines etapes prevues, et s'il existe une date limite pour manifester un interet qualifie ?

Cela nous aidera a cadrer le bon niveau d'effort cote Re-New et a eviter de pousser un profil hors timing.

Merci beaucoup,

L'equipe Re-New`,
}

// Template metadata for UI display
export const TEMPLATE_METADATA: Record<
  EmailTemplateKey,
  {
    name: string
    description: string
    category: EmailTemplateCategory
    audience: EmailTemplateAudience
  }
> = {
  welcome: {
    name: "Welcome",
    description: "Sent after first contact is captured",
    category: "intake",
    audience: "rep",
  },
  form_step_complete: {
    name: "Step Complete",
    description: "Sent after each form step is completed",
    category: "intake",
    audience: "rep",
  },
  abandoned_reminder: {
    name: "Form Reminder",
    description: "Sent 24h after form abandonment",
    category: "intake",
    audience: "rep",
  },
  thank_you: {
    name: "Thank You",
    description: "Sent when full form is completed",
    category: "intake",
    audience: "rep",
  },
  high_score_alert: {
    name: "High Score",
    description: "Sent when score exceeds 70/100",
    category: "intake",
    audience: "rep",
  },
  offer_received: {
    name: "Offer Received",
    description: "Sent when an offer is assigned",
    category: "offer",
    audience: "rep",
  },
  milestone_completed: {
    name: "Milestone Complete",
    description: "Sent when a milestone is completed",
    category: "offer",
    audience: "rep",
  },
  offer_accepted: {
    name: "Offer Accepted",
    description: "Confirmation of offer acceptance",
    category: "offer",
    audience: "rep",
  },
  offer_activated: {
    name: "Offer Activated",
    description: "Sent when engagement starts",
    category: "offer",
    audience: "rep",
  },
  rejection: {
    name: "Rejection",
    description: "Sent when a candidate is rejected",
    category: "status",
    audience: "rep",
  },
  interview_reminder: {
    name: "Interview Reminder",
    description: "Sent 24h before a scheduled interview",
    category: "status",
    audience: "rep",
  },
  booking_reminder: {
    name: "Booking Reminder",
    description: "Sent once after 5 days if no interview is booked",
    category: "intake",
    audience: "rep",
  },
  ma_opportunity_validity_check: {
    name: "M&A Validity Check",
    description: "Ask an intermediary whether an opportunity is still active",
    category: "ma",
    audience: "opp",
  },
  ma_request_more_information: {
    name: "M&A Info Request",
    description: "Request missing deal information from a broker or M&A firm",
    category: "ma",
    audience: "opp",
  },
  ma_repreneur_interest_feedback: {
    name: "M&A Repreneur Interest",
    description: "Share qualified repreneur interest and ask for feedback",
    category: "ma",
    audience: "opp",
  },
  ma_process_follow_up: {
    name: "M&A Process Follow-up",
    description: "Clarify process stage, timing, and next step",
    category: "ma",
    audience: "opp",
  },
}

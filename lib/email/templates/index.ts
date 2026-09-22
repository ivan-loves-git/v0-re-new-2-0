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

export type EmailTemplateAudience = "rep" | "opp" | "staff"
export type EmailTemplateCategory = "intake" | "offer" | "status" | "ma"

export const TEMPLATE_AUDIENCE_LABELS: Record<EmailTemplateAudience, string> = {
  rep: "Rep",
  opp: "Opp",
  staff: "Staff",
}

export const MA_TEMPLATE_DEFAULT_BODIES: Partial<Record<EmailTemplateKey, string>> = {
  ma_opportunity_validity_check: `Bonjour {firstName},

Nous nous permettons de vous contacter au sujet de {opportunityTitle}.

Pouvez-vous nous confirmer si l'opportunité est toujours active, et si vous êtes encore ouverts à étudier de nouveaux profils de repreneurs ?

Merci beaucoup,

L'équipe Re-New`,
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
  ma_nda_info_memo_request: `Bonjour {firstName},

Nous avons qualifie l'interet de {repreneurName} pour {opportunityTitle}.

Pouvez-vous nous indiquer le bon processus NDA pour avancer, ou nous transmettre votre lien/document de signature ?

Une fois le NDA signe, pourriez-vous egalement nous partager l'info memo ou les elements de presentation disponibles ?

Contexte fiche de cadrage :
{repreneurProfile}

Pour clarifier le cadre : Re-New ne remplace pas votre NDA par un NDA generique. Nous suivons le document et le processus requis par votre cabinet.

Merci beaucoup,

L'equipe Re-New`,
  ma_process_follow_up: `Bonjour {firstName},

Nous revenons vers vous au sujet de {opportunityTitle}.

Pouvez-vous nous confirmer si l'opportunité est toujours active, et si vous restez ouverts à étudier de nouveaux profils de repreneurs ?

Si le dossier n'est plus d'actualité, n'hésitez pas à nous le signaler simplement en répondant à cet email.

Merci beaucoup,

L'équipe Re-New`,
}

export const INTEREST_TEMPLATE_DEFAULT_BODIES: Partial<Record<EmailTemplateKey, string>> = {
  interest_outcome_validated: `Bonjour {firstName},

Re-New a validé votre intérêt pour {opportunityTitle}. Notre équipe vous contactera pour la suite.

L’équipe Re-New`,
  interest_outcome_rejected: `Bonjour {firstName},

Après examen, Re-New ne poursuivra pas cette opportunité avec vous pour le moment. Cela ne change pas votre accès aux autres opportunités.

L’équipe Re-New`,
  proposed_opportunity_response_staff: `Bonjour,

{repreneurName} a répondu {responseLabel} à l’opportunité {opportunityTitle}. Consultez WAVE pour la suite.

L’équipe Re-New`,
}

// Template metadata for UI display
export const TEMPLATE_METADATA: Record<
  EmailTemplateKey,
  {
    name: string
    description: string
    category: EmailTemplateCategory
    audience: EmailTemplateAudience
    manualSend?: boolean
    copyEditable?: boolean
  }
> = {
  opportunity_recommendation_assignment: {
    name: "Opportunity assignment",
    description: "Versioned title-and-teaser email for a new staff recommendation. No portal access. Sent only from the recommendation, not the generic sender.",
    category: "status",
    audience: "rep",
    manualSend: false,
  },
  interest_outcome_validated: {
    name: "Interest validated",
    description: "Neutral notice after staff validates this exact interest. Inactive by default; no internal notes or source details.",
    category: "status",
    audience: "rep",
    manualSend: false,
    copyEditable: true,
  },
  interest_outcome_rejected: {
    name: "Interest not selected",
    description: "Neutral notice after staff rejects this exact interest, without rejecting the account or other deals. Inactive by default.",
    category: "status",
    audience: "rep",
    manualSend: false,
    copyEditable: true,
  },
  proposed_opportunity_response_staff: {
    name: "Proposed opportunity response",
    description: "One configured-staff alert for a new response to a staff proposal, not unassigned interest. Inactive by default.",
    category: "status",
    audience: "staff",
    manualSend: false,
    copyEditable: true,
  },
  welcome: {
    name: "Registration confirmation",
    description: "Confirms completed registration in the current intake form; the legacy first-contact variant remains separate",
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
    description: "Sent once to eligible leads after 5 Paris weekdays from a recorded Outlook invitation, if no interview is booked",
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
  ma_nda_info_memo_request: {
    name: "Request NDA and info memo",
    description: "Ask for the intermediary's NDA process and info memo after a pursuit is validated",
    category: "ma",
    audience: "opp",
  },
  ma_process_follow_up: {
    name: "Process follow-up",
    description: "Clarify seller process stage, timing, and next step",
    category: "ma",
    audience: "opp",
  },
}

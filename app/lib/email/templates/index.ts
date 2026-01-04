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

import type { EmailTemplateKey } from "@/lib/types/email"

// Template metadata for UI display
export const TEMPLATE_METADATA: Record<
  EmailTemplateKey,
  {
    name: string
    description: string
    category: "intake" | "offer" | "status"
  }
> = {
  welcome: {
    name: "Bienvenue",
    description: "Envoye apres la capture du premier contact",
    category: "intake",
  },
  form_step_complete: {
    name: "Etape completee",
    description: "Envoye apres chaque etape du formulaire",
    category: "intake",
  },
  abandoned_reminder: {
    name: "Rappel formulaire",
    description: "Envoye 48h apres un abandon de formulaire",
    category: "intake",
  },
  thank_you: {
    name: "Merci",
    description: "Envoye a la fin du formulaire complet",
    category: "intake",
  },
  high_score_alert: {
    name: "Score eleve",
    description: "Envoye quand le score depasse 70/100",
    category: "intake",
  },
  offer_received: {
    name: "Offre recue",
    description: "Envoye quand une offre est assignee",
    category: "offer",
  },
  milestone_completed: {
    name: "Jalon complete",
    description: "Envoye quand un jalon est complete",
    category: "offer",
  },
  offer_accepted: {
    name: "Offre acceptee",
    description: "Confirmation d acceptation d offre",
    category: "offer",
  },
  offer_activated: {
    name: "Offre activee",
    description: "Envoye quand l accompagnement demarre",
    category: "offer",
  },
  rejection: {
    name: "Refus",
    description: "Envoye lors du rejet d un candidat",
    category: "status",
  },
}

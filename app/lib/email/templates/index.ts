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
    name: "Welcome",
    description: "Sent after first contact is captured",
    category: "intake",
  },
  form_step_complete: {
    name: "Step Complete",
    description: "Sent after each form step is completed",
    category: "intake",
  },
  abandoned_reminder: {
    name: "Form Reminder",
    description: "Sent 48h after form abandonment",
    category: "intake",
  },
  thank_you: {
    name: "Thank You",
    description: "Sent when full form is completed",
    category: "intake",
  },
  high_score_alert: {
    name: "High Score",
    description: "Sent when score exceeds 70/100",
    category: "intake",
  },
  offer_received: {
    name: "Offer Received",
    description: "Sent when an offer is assigned",
    category: "offer",
  },
  milestone_completed: {
    name: "Milestone Complete",
    description: "Sent when a milestone is completed",
    category: "offer",
  },
  offer_accepted: {
    name: "Offer Accepted",
    description: "Confirmation of offer acceptance",
    category: "offer",
  },
  offer_activated: {
    name: "Offer Activated",
    description: "Sent when engagement starts",
    category: "offer",
  },
  rejection: {
    name: "Rejection",
    description: "Sent when a candidate is rejected",
    category: "status",
  },
}

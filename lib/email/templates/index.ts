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

import type { EmailTemplateKey } from "@/lib/types/email"

export type EmailTemplateAudience = "rep" | "opp"

export const TEMPLATE_AUDIENCE_LABELS: Record<EmailTemplateAudience, string> = {
  rep: "Rep",
  opp: "Opp",
}

// Template metadata for UI display
export const TEMPLATE_METADATA: Record<
  EmailTemplateKey,
  {
    name: string
    description: string
    category: "intake" | "offer" | "status"
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
}

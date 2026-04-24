// Email automation types

export type EmailStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "failed"

export type EmailTemplateKey =
  | "welcome"
  | "form_step_complete"
  | "abandoned_reminder"
  | "thank_you"
  | "high_score_alert"
  | "offer_received"
  | "milestone_completed"
  | "offer_accepted"
  | "offer_activated"
  | "rejection"
  | "interview_reminder"

export interface EmailTemplate {
  id: string
  template_key: EmailTemplateKey
  subject: string
  description?: string
  is_active: boolean
  is_enabled?: boolean // Alias for is_active, used by UI
  requires_consent: boolean
  subject_override?: string | null
  preview_text?: string | null
  created_at: string
  updated_at: string
}

export interface EmailLog {
  id: string
  repreneur_id: string
  template_key: EmailTemplateKey
  resend_id?: string
  to_email: string
  subject: string
  status: EmailStatus
  sent_at?: string
  delivered_at?: string
  opened_at?: string
  clicked_at?: string
  error_message?: string
  metadata: Record<string, unknown>
  created_at: string
  // Joined fields
  repreneur?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
}

export interface EmailLog_Insert {
  repreneur_id: string
  template_key: EmailTemplateKey
  to_email: string
  subject: string
  resend_id?: string
  status?: EmailStatus
  metadata?: Record<string, unknown>
}

export interface IntakeAbandonmentTracking {
  id: string
  repreneur_id: string
  last_step_completed: number
  last_activity_at: string
  reminder_sent_at?: string
  reminder_count: number
  is_completed: boolean
  created_at: string
}

export interface EmailDailyCount {
  date: string
  count: number
  created_at: string
}

// Props for email templates
export interface EmailTemplateProps {
  repreneur: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  metadata?: Record<string, unknown>
  previewText?: string
}

// Specific template props
export interface WelcomeEmailProps extends EmailTemplateProps {}

export interface FormStepCompleteEmailProps extends EmailTemplateProps {
  metadata: {
    stepCompleted: number
  }
}

export interface AbandonedReminderEmailProps extends EmailTemplateProps {
  metadata: {
    /** Last completed step (1-6) */
    lastStep: number
    /** Total steps in form */
    totalSteps: number
    /** Days since last activity */
    daysAgo: number
    /** Step names for context */
    stepNames?: string[]
  }
}

export interface ThankYouEmailProps extends EmailTemplateProps {
  metadata: {
    /** @deprecated Use whoScore + whenScore for v2 */
    tier1Score?: number
    /** WHO score (0-100) - profile quality */
    whoScore?: number
    /** WHEN score (0-100) - project maturity */
    whenScore?: number
    /** Recommended action */
    recommendation?: string
  }
}

export interface HighScoreAlertEmailProps extends EmailTemplateProps {
  metadata: {
    /** @deprecated Use whoScore + whenScore for v2 */
    tier1Score?: number
    /** WHO score (0-100) - profile quality */
    whoScore: number
    /** WHEN score (0-100) - project maturity */
    whenScore: number
    /** Recommended action: deal_flow | priority_interview | interview | starter_pack */
    recommendation: string
    /** Warning flags if any */
    flags?: string[]
  }
}

export interface OfferReceivedEmailProps extends EmailTemplateProps {
  metadata: {
    offerName: string
    offerPrice: number
  }
}

export interface InterviewReminderEmailProps extends EmailTemplateProps {
  metadata: {
    /**
     * Interview date. Normally `YYYY-MM-DD` because `activities.event_date` is a
     * DATE column (no time). Full ISO-8601 timestamps also accepted — the email
     * template formats with time only when one is present.
     */
    interviewAt: string
    /** Optional notes logged with the interview activity (may contain a Calendly link). */
    notes?: string
  }
}

export interface MilestoneCompletedEmailProps extends EmailTemplateProps {
  metadata: {
    milestoneTitle: string
    offerName: string
  }
}

export interface OfferAcceptedEmailProps extends EmailTemplateProps {
  metadata: {
    offerName: string
  }
}

export interface OfferActivatedEmailProps extends EmailTemplateProps {
  metadata: {
    offerName: string
    startDate: string
  }
}

export interface RejectionEmailProps extends EmailTemplateProps {}

// Email send result
export interface EmailSendResult {
  success: boolean
  emailLogId?: string
  resendId?: string
  error?: string
}

// Analytics types
export interface EmailAnalytics {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  openRate: number
  clickRate: number
  bounceRate: number
}

export interface EmailAnalyticsByTemplate {
  templateKey: EmailTemplateKey
  subject: string
  totalSent: number
  openRate: number
  clickRate: number
}

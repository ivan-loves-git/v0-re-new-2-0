export const feedbackCategories = ["improvement", "difficulty", "other"] as const
export const feedbackContexts = ["portal_deals", "portal_profile", "portal_other"] as const
export const feedbackStatuses = ["new", "routed", "closed"] as const

export type FeedbackCategory = (typeof feedbackCategories)[number]
export type FeedbackContext = (typeof feedbackContexts)[number]
export type FeedbackStatus = (typeof feedbackStatuses)[number]

export type ValidFeedbackSubmission = {
  category: FeedbackCategory
  message: string
  context: FeedbackContext | null
}

export type FeedbackValidation =
  | { ok: true; value: ValidFeedbackSubmission }
  | { ok: false; message: string }

function hasOnlyExpectedKeys(value: Record<string, unknown>) {
  return Object.keys(value).every((key) => ["category", "message", "context"].includes(key))
}

/** Never accept identity, URL, document or hidden page fields from the browser. */
export function validateFeedbackSubmission(input: unknown): FeedbackValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "Enter your feedback before sending it." }
  }
  const value = input as Record<string, unknown>
  if (!hasOnlyExpectedKeys(value)) {
    return { ok: false, message: "This feedback form contains an unsupported field. Reload and try again." }
  }
  if (!feedbackCategories.includes(value.category as FeedbackCategory)) {
    return { ok: false, message: "Choose a feedback category." }
  }
  if (typeof value.message !== "string") {
    return { ok: false, message: "Write a feedback message." }
  }
  const message = value.message.trim()
  const length = Array.from(message).length
  if (length < 20 || length > 1000) {
    return { ok: false, message: "Write between 20 and 1,000 characters." }
  }
  const context = value.context === undefined || value.context === null || value.context === ""
    ? null : value.context
  if (context !== null && !feedbackContexts.includes(context as FeedbackContext)) {
    return { ok: false, message: "Choose one of the available page areas." }
  }
  return {
    ok: true,
    value: {
      category: value.category as FeedbackCategory,
      message,
      context: context as FeedbackContext | null,
    },
  }
}

import type { Language } from "./translations"
import { uiCopy, type UiCopyKey } from "./ui-copy"

// Server actions and upload endpoints may fail with provider prose. Only these
// reviewed public outcomes may reach a repreneur; unknown messages use fallback.
const knownOutcomes = new Set<string>([
  "Choose at least one reason before marking this opportunity as not a fit.",
  "Add a written rationale before marking this opportunity as not a fit.",
  "This opportunity is no longer available for your response.",
  "This opportunity response can no longer be changed.",
  "The response window for this recommendation has expired. Re-New can renew it if appropriate.",
  "We could not save your response right now. Please try again.",
  "No repreneur profile is linked to this login.",
  "This opportunity could not be identified.",
  "Your interest is recorded, but the email alert did not go through yet. Retry to notify Re-New.",
  "Thank you. Re-New has received your interest and will follow up with you directly.",
  "This opportunity is no longer available to express interest. Refresh the page to see its current status.",
  "We could not record your interest right now. Please try again.",
  "Re-New has already validated this pursuit. Contact the team to use the normal Drop process.",
  "This exact interest or selected workspace has changed. Refresh the page before taking action.",
  "This account cannot withdraw that repreneur's interest.",
  "The withdrawal could not be confirmed right now. Please try again.",
  "Interest withdrawal is temporarily paused. Contact Re-New for help.",
  "Your interest was withdrawn before Re-New validation. This opportunity remains available if eligible.",
  "Your viewed status could not be saved. Please try again.",
  "Your review status could not be saved. Please try again.",
  "Your review changed in another session. Refresh before trying again.",
  "This opportunity is no longer available.",
  "Choose a valid review action.",
  "Your signed NDA has been received for staff validation.",
  "Choose a non-empty file.",
  "File size must not exceed 20 MiB.",
  "Choose a supported document type.",
  "The file type does not match its extension.",
  "The private file upload failed. Please try again.",
  "Upload authorization failed.",
  "The uploaded file could not be validated.",
] satisfies UiCopyKey[])

export function publicDealOutcome(message: unknown, language: Language, fallback: UiCopyKey) {
  return typeof message === "string" && knownOutcomes.has(message)
    ? uiCopy(language, message as UiCopyKey)
    : uiCopy(language, fallback)
}

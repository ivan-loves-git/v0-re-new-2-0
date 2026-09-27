import type { Language } from "./translations"
import { uiCopy, type UiCopyKey } from "./ui-copy"

const known = new Set<string>([
  "Due date must use a valid YYYY-MM-DD date.",
  "External metrics must be zero or greater.",
  "Headcount must be a whole number.",
  "External URL must start with http:// or https://.",
  "Could not create External Pursuit.",
  "Could not update External Pursuit.",
  "Could not move External Pursuit.",
  "Could not save contact.",
  "External Pursuit created.",
  "External Pursuit updated.",
  "External Pursuit stage updated.",
  "Contact saved.",
  "Set or clear the next action and responsible party together.",
  "A next action requires one responsible party.",
  "Could not update follow-up.",
  "Follow-up updated.",
  "Attachment added.",
  "Could not add attachment.",
  "Could not remove attachment.",
  "Attachment removed.",
  "Current status confirmed.",
  "Confirmation result is unknown. Retry the same confirmation.",
  "External Pursuit confirmation is invalid.",
  "External Pursuit access denied.",
  "Set a responsible party for a next action, or clear both fields.",
  "The save result is unclear. Fields are locked until you retry this exact save.",
  "Could not request deletion.",
  "Deletion requested.",
  "Choose a non-empty file.",
  "File size must not exceed 20 MiB.",
  "Choose a supported document type.",
  "The file type does not match its extension.",
  "The private file upload failed. Please try again.",
  "Upload authorization failed.",
  "The uploaded file could not be validated.",
] satisfies UiCopyKey[])

export function publicPursuitOutcome(message: unknown, language: Language, fallback: UiCopyKey) {
  return typeof message === "string" && known.has(message)
    ? uiCopy(language, message as UiCopyKey)
    : uiCopy(language, fallback)
}

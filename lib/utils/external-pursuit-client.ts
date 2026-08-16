import type { ExternalPursuitContactInput } from "@/lib/types/external-pursuit"

export interface ExternalPursuitContactDraft extends ExternalPursuitContactInput {
  /** Stable for this editor session; never derived from the contact array index. */
  clientId: string
}

const CONTACT_FIELDS: ReadonlyArray<keyof ExternalPursuitContactInput> = [
  "name",
  "organisation",
  "roleTitle",
  "email",
  "phone",
]

export function hasContactValue(contact: ExternalPursuitContactInput) {
  return CONTACT_FIELDS.some((field) => Boolean(contact[field]?.trim()))
}

export function isCompleteContact(contact: ExternalPursuitContactInput) {
  return !hasContactValue(contact) || Boolean(contact.name?.trim() || contact.organisation?.trim())
}

export function contactIdempotencyKey(submissionKey: string, clientId: string) {
  return `${submissionKey}:contact:${clientId}`
}

export function retryKeyFor(
  keys: Map<string, string>,
  operation: string,
  createKey: () => string,
) {
  const existing = keys.get(operation)
  if (existing) return existing
  const created = createKey()
  keys.set(operation, created)
  return created
}

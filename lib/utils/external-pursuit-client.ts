import type { ExternalPursuitContactInput, ExternalPursuitInput } from "@/lib/types/external-pursuit"

export interface ExternalPursuitContactDraft extends ExternalPursuitContactInput {
  /** Stable for this editor session; never derived from the contact array index. */
  clientId: string
}

export interface ExternalPursuitSubmissionSnapshot {
  idempotencyKey: string
  pursuitId: string | null
  input: Readonly<ExternalPursuitInput>
  contacts: ReadonlyArray<Readonly<ExternalPursuitContactDraft>>
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

export function captureExternalPursuitSubmission(input: {
  idempotencyKey: string
  pursuitId: string | null
  pursuit: ExternalPursuitInput
  contacts: ExternalPursuitContactDraft[]
}): ExternalPursuitSubmissionSnapshot {
  const pursuit = Object.freeze({ ...input.pursuit })
  const contacts = Object.freeze(input.contacts.map((contact) => Object.freeze({ ...contact })))
  return Object.freeze({
    idempotencyKey: input.idempotencyKey,
    pursuitId: input.pursuitId,
    input: pursuit,
    contacts,
  })
}

/** Keeps one immutable payload until the caller explicitly completes recovery. */
export function beginOrRetryExternalPursuitSubmission(
  current: ExternalPursuitSubmissionSnapshot | null,
  capture: () => ExternalPursuitSubmissionSnapshot,
) {
  return current ?? capture()
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

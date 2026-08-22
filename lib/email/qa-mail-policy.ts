type MailEnvelope = {
  from: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
}

type QaMailPolicy = {
  mode: "off" | "allowlist"
  recipients: string[]
  senders: string[]
}

const QA_SENDER = "onboarding@resend.dev"

function addresses(value: string | string[] | undefined): string[] {
  return value === undefined ? [] : (Array.isArray(value) ? value : [value])
}

function normalizeAddress(value: string): string {
  const bracketed = value.match(/<([^<>]+)>/)?.[1] ?? value
  return bracketed.trim().toLowerCase()
}

export function qaMailPolicyFromEnv(env: Record<string, string | undefined> = process.env): QaMailPolicy {
  if (env.QA_MAIL_MODE !== "allowlist") return { mode: "off", recipients: [], senders: [] }
  const configuredSenders = addresses(env.QA_EMAIL_FROM).flatMap((value) => value.split(",")).map(normalizeAddress).filter(Boolean)
  return {
    mode: "allowlist",
    recipients: addresses(env.QA_EMAIL_RECIPIENT).flatMap((value) => value.split(",")).map(normalizeAddress).filter(Boolean),
    senders: configuredSenders.length === 1 && configuredSenders[0] === QA_SENDER ? configuredSenders : [],
  }
}

export function assertQaMailEnvelope(envelope: MailEnvelope, policy: QaMailPolicy = qaMailPolicyFromEnv()) {
  const sender = normalizeAddress(envelope.from)
  const recipients = [...addresses(envelope.to), ...addresses(envelope.cc), ...addresses(envelope.bcc)].map(normalizeAddress)
  if (policy.mode === "off") return { recipients, sender }
  if (policy.senders.length !== 1 || !policy.senders.includes(sender)) throw new Error("QA mail policy failed: sender")
  const designatedRunRecipient = (recipient: string) =>
    policy.recipients.includes("delivered@resend.dev") && /^delivered\+test-[a-z0-9-]+@resend\.dev$/.test(recipient)
  if (policy.recipients.length === 0 || recipients.length === 0 || recipients.some((recipient) => !policy.recipients.includes(recipient) && !designatedRunRecipient(recipient))) {
    throw new Error("QA mail policy failed: recipient")
  }
  return { recipients, sender }
}

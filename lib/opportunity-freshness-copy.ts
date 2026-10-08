import { MA_TEMPLATE_DEFAULT_BODIES } from "@/lib/email/templates"

export const FRESHNESS_COPY_CONTRACT = "recognizable-v1"
export const FRESHNESS_DEFAULT_SUBJECT =
  "Statut du process pour {opportunityTitle}"
export const FRESHNESS_DEFAULT_BODY = `Bonjour {firstName},

{opportunityIntroduction}

{processQuestion}

Merci pour votre retour,
L’équipe Re-New`

export interface GroupedFreshnessMember {
  opportunityId: string
  reference: string
  title: string
  firmName: string
  revenueMeur?: number | null
}

export function renderGroupedFreshnessCopy(input: {
  subject: string
  body: string
  contactName: string
  members: GroupedFreshnessMember[]
}) {
  if (!input.members.length)
    throw new Error("A freshness draft needs at least one exact opportunity.")
  const members = [...input.members].sort(
    (a, b) =>
      a.reference.localeCompare(b.reference) ||
      a.opportunityId.localeCompare(b.opportunityId),
  )
  const labels = members.map((member) => {
    const title = member.title.trim()
    const revenue = member.revenueMeur
    return (
      title +
      (typeof revenue === "number" && Number.isFinite(revenue)
        ? ` (CA : ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 20, useGrouping: false }).format(revenue)} M€)`
        : "")
    )
  })
  const plural = members.length > 1
  const list = labels.map((label) => `- ${label}`).join("\n")
  const variables: Record<string, string> = {
    firstName: input.contactName.trim().split(/\s+/)[0] || "Madame, Monsieur",
    firmName:
      [
        ...new Set(members.map((member) => member.firmName).filter(Boolean)),
      ].join("; ") || "votre cabinet",
    opportunityTitle: plural ? "les opportunités suivantes" : labels[0],
    opportunityList: list,
    opportunityIntroduction: plural
      ? `Nous nous permettons de vous contacter au sujet des opportunités suivantes :\n${list}`
      : "Nous nous permettons de vous contacter au sujet de l’opportunité en objet.",
    processQuestion: plural
      ? "Les process sont-ils toujours ouverts ? Étudiez-vous encore de nouveaux profils de repreneurs pour ces opportunités ?"
      : "Le process est-il toujours ouvert ? Étudiez-vous encore de nouveaux profils de repreneurs ?",
  }
  const substitute = (value: string) =>
    value.replace(
      /\{(firstName|firmName|opportunityTitle|opportunityList|opportunityIntroduction|processQuestion)\}/g,
      (_, key: string) => variables[key],
    )
  // Recognize the previously shipped default without rewriting the stored
  // catalogue or custom words. Existing drafts are updated only explicitly.
  const defaultBody =
    input.body.trim() ===
      MA_TEMPLATE_DEFAULT_BODIES.ma_opportunity_validity_check?.trim() ||
    input.body.trim() === FRESHNESS_DEFAULT_BODY.trim()

  const bodyTemplate = defaultBody ? FRESHNESS_DEFAULT_BODY : input.body
  const subject =
    plural && input.subject.trim() === FRESHNESS_DEFAULT_SUBJECT
      ? "Statut des process pour les opportunités suivantes"
      : substitute(input.subject).trim()
  let body = substitute(bodyTemplate).trim()
  if (
    plural &&
    !bodyTemplate.includes("{opportunityIntroduction}") &&
    !bodyTemplate.includes("{opportunityList}")
  ) {
    body += `\n\nOpportunités concernées :\n${list}`
  } else if (
    !plural &&
    !`${subject}\n${body}`.includes(members[0].title.trim())
  ) {
    body += `\n\n${labels[0]}`
  }
  return { subject, body }
}

/** Local review guidance; the atomic database send gate remains authoritative. */
export function freshnessReviewCopyProblem(input: {
  subject: string
  body: string
  members: Array<{ frozen_member: Record<string, string | null> }>
}) {
  if (!input.members.length) return "Exact opportunity evidence is missing."
  const words = `${input.subject}\n${input.body}`.toLocaleLowerCase()
  let expectedRevenues = 0
  for (const { frozen_member: member } of input.members) {
    if (member.copy_contract !== FRESHNESS_COPY_CONTRACT)
      return "Refresh group evidence before updating and reviewing this draft."
    const title = (member.title ?? "").trim().toLocaleLowerCase()
    const reference = (member.reference ?? "").trim().toLocaleLowerCase()
    if (!title || title === reference)
      return "Correct the recognizable project title in WAVE, then refresh this group."
    if (reference && words.includes(reference))
      return "Remove the internal opportunity reference from the subject and message."
    if (!words.includes(title))
      return "Include every recognizable project title in the subject or message."
    if (member.revenue_meur != null) {
      expectedRevenues += 1
      const revenue = Number(member.revenue_meur)
      const label = `${title} (ca : ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 20, useGrouping: false }).format(revenue)} m€)`
      if (!Number.isFinite(revenue) || !words.includes(label))
        return "Use the recorded revenue beside each project title, then review the message."
    }
  }
  if ((words.match(/\bca\s*:/g) ?? []).length !== expectedRevenues) return "Use only recorded revenue; omit CA when it is missing."
  return null
}

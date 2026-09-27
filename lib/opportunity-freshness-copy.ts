export interface GroupedFreshnessMember {
  opportunityId: string
  reference: string
  title: string
  firmName: string
}

export function renderGroupedFreshnessCopy(input: {
  subject: string
  body: string
  contactName: string
  members: GroupedFreshnessMember[]
}) {
  if (!input.members.length) throw new Error("A freshness draft needs at least one exact opportunity.")
  const members = [...input.members].sort((a, b) => a.reference.localeCompare(b.reference) || a.opportunityId.localeCompare(b.opportunityId))
  const labels = members.map((member) => `${member.reference} — ${member.title}`)
  const opportunityTitle = labels.join("; ")
  const firmName = [...new Set(members.map((member) => member.firmName).filter(Boolean))].join("; ") || "votre cabinet"
  const variables: Record<string, string> = {
    firstName: input.contactName.trim().split(/\s+/)[0] || "Bonjour",
    firmName,
    opportunityTitle,
  }
  const substitute = (value: string) => value.replace(/\{(firstName|firmName|opportunityTitle)\}/g, (_, key: string) => variables[key])
  const subject = substitute(input.subject).trim()
  const body = substitute(input.body).trim()
  return {
    subject,
    body: input.body.includes("{opportunityTitle}") ? body : `${body}\n\nOpportunités concernées :\n${labels.map((label) => `- ${label}`).join("\n")}`,
  }
}

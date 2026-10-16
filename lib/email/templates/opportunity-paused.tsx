import { Text } from "@react-email/components"
import { BaseLayout, heading } from "./base-layout"
import { renderMarkdownBody } from "./markdown-body"

export function OpportunityPausedEmail({ subject, body, variables, reason }: {
  subject: string
  body: string
  variables: Record<string, string>
  reason: string
}) {
  return <BaseLayout previewText={subject} footerText="Vous recevez ce message au sujet d’une opportunité que vous suivez avec Re-New.">
    <Text style={heading}>{subject}</Text>
    {renderMarkdownBody(body, variables)}
    <Text><strong>Motif de la pause :</strong> {reason}</Text>
    <Text>Ce dossier reste dans votre historique. Les actions et l’accès aux documents confidentiels sont suspendus pendant cette pause.</Text>
    <Text>L’équipe Re-New</Text>
  </BaseLayout>
}

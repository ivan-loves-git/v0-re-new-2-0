import { Text } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph } from "./base-layout"
import type { RejectionEmailProps } from "@/lib/types/email"

/** Sent manually when a candidate is not retained. */
export function RejectionEmail({ repreneur }: RejectionEmailProps) {
  const { firstName } = repreneur
  return (
    <BaseLayout previewText="Suite à la revue de votre dossier repreneur">
      <Text style={heading}>Suite à la revue de votre dossier repreneur</Text>
      <Text style={paragraph}>Bonjour {firstName},</Text>
      <Text style={paragraph}>Après examen attentif de votre profil, nous ne sommes malheureusement pas en mesure de poursuivre votre accompagnement à ce stade.</Text>
      <Text style={paragraph}>Cette décision ne reflète en rien la qualité de votre projet. Elle peut être liée à plusieurs facteurs : le timing de votre projet, l&apos;adéquation avec nos offres actuelles, ou les critères spécifiques de notre programme.</Text>
      <Text style={paragraph}>Nous vous encourageons à poursuivre votre parcours entrepreneurial. Votre profil reste dans notre base de données et nous n&apos;hésiterons pas à vous recontacter si une opportunité plus adaptée à votre situation se présente.</Text>
      <Text style={paragraph}>Nous vous souhaitons beaucoup de succès dans vos démarches.</Text>
      <Text style={paragraph}>Bien cordialement,<br />L&apos;équipe Re-New</Text>
    </BaseLayout>
  )
}

export default RejectionEmail

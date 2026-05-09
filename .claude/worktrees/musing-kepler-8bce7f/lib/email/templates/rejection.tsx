import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import type { RejectionEmailProps } from "@/lib/types/email"

/**
 * Rejection Email - French
 * Sent manually when a candidate is not retained
 */
export function RejectionEmail({ repreneur }: RejectionEmailProps) {
  const { firstName } = repreneur

  return (
    <BaseLayout previewText={`${firstName}, suite à la revue de votre dossier repreneur`}>
      <Text style={heading}>Suite &agrave; la revue de votre dossier repreneur</Text>

      <Text style={paragraph}>
        Cher(e) {firstName},
      </Text>

      <Text style={paragraph}>
        Apr&egrave;s examen attentif de votre profil, nous ne sommes malheureusement
        pas en mesure de poursuivre votre accompagnement &agrave; ce stade.
      </Text>

      <Text style={paragraph}>
        Cette d&eacute;cision ne refl&egrave;te en rien la qualit&eacute; de votre
        projet. Elle peut &ecirc;tre li&eacute;e &agrave; plusieurs facteurs :
      </Text>

      <Text style={paragraph}>
        &bull; Le timing de votre projet
        <br />
        &bull; L&apos;ad&eacute;quation avec nos offres actuelles
        <br />
        &bull; Les crit&egrave;res sp&eacute;cifiques de notre programme
      </Text>

      <Text style={paragraph}>
        Nous vous encourageons &agrave; poursuivre votre parcours entrepreneurial.
        Votre profil reste dans notre base de donn&eacute;es et nous n&apos;h&eacute;siterons
        pas &agrave; vous recontacter si une opportunit&eacute; plus adapt&eacute;e
        &agrave; votre situation se pr&eacute;sente.
      </Text>

      <Text style={paragraph}>
        En attendant, n&apos;h&eacute;sitez pas &agrave; explorer d&apos;autres
        ressources pour faire avancer votre projet :
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.team/fr" style={button}>
          Ressources et conseils
        </Link>
      </Section>

      <Text style={paragraph}>
        Nous vous souhaitons beaucoup de succ&egrave;s dans vos d&eacute;marches.
      </Text>

      <Text style={paragraph}>
        Bien cordialement,
        <br />
        L&apos;&eacute;quipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default RejectionEmail

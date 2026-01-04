import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import type { RejectionEmailProps } from "@/lib/types/email"

export function RejectionEmail({ repreneur }: RejectionEmailProps) {
  const { firstName } = repreneur

  return (
    <BaseLayout previewText={`${firstName}, mise a jour concernant votre candidature Re-New`}>
      <Text style={heading}>Mise a jour de votre dossier</Text>

      <Text style={paragraph}>
        Bonjour {firstName},
      </Text>

      <Text style={paragraph}>
        Apres examen attentif de votre profil, nous avons le regret de vous
        informer que nous ne sommes pas en mesure de poursuivre votre
        accompagnement pour le moment.
      </Text>

      <Text style={paragraph}>
        Cette decision ne remet pas en cause la qualite de votre projet. Elle
        peut etre liee a plusieurs facteurs:
      </Text>

      <Text style={paragraph}>
        • Le timing de votre projet
        <br />
        • L&apos;adequation avec nos offres actuelles
        <br />• Des criteres specifiques a notre programme
      </Text>

      <Text style={paragraph}>
        Nous vous encourageons a continuer votre parcours entrepreneurial.
        Votre profil reste dans notre base de donnees et nous n&apos;hesiterons
        pas a vous recontacter si une opportunite correspondant mieux a votre
        situation se presente.
      </Text>

      <Text style={paragraph}>
        En attendant, n&apos;hesitez pas a explorer d&apos;autres ressources
        pour avancer dans votre projet:
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/resources" style={button}>
          Ressources et conseils
        </Link>
      </Section>

      <Text style={paragraph}>
        Nous vous souhaitons plein succes dans vos projets.
      </Text>

      <Text style={paragraph}>
        Cordialement,
        <br />
        L&apos;equipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default RejectionEmail

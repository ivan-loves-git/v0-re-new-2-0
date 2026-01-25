import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import type { WelcomeEmailProps } from "@/lib/types/email"

/**
 * Welcome Email - French
 * Sent after successful intake form submission
 */
export function WelcomeEmail({ repreneur }: WelcomeEmailProps) {
  const { firstName } = repreneur

  return (
    <BaseLayout previewText={`Bienvenue ${firstName} ! Votre parcours Re-New commence.`}>
      <Text style={heading}>Bienvenue {firstName} !</Text>

      <Text style={paragraph}>
        Nous sommes ravis de vous accueillir dans la communauté Re-New.
      </Text>

      <Text style={paragraph}>
        Vous venez de franchir la première étape vers votre projet de reprise
        d&apos;entreprise. Notre équipe est là pour vous accompagner à chaque
        étape de ce parcours passionnant.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.team" style={button}>
          Découvrir Re-New
        </Link>
      </Section>

      <Text style={heading} as="h2">Prochaines étapes</Text>

      <Text style={paragraph}>
        Un membre de notre équipe vous contactera sous 48 à 72h pour un premier
        échange. En attendant, n&apos;hésitez pas à explorer notre site et nos
        ressources.
      </Text>

      <Text style={paragraph}>
        Si vous avez des questions, n&apos;hésitez pas à nous contacter à{" "}
        <Link href="mailto:contact@re-new.team">contact@re-new.team</Link>.
      </Text>

      <Text style={paragraph}>
        À très bientôt,
        <br />
        L&apos;équipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default WelcomeEmail

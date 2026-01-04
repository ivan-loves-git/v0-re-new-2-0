import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight, highlightText } from "./base-layout"
import type { ThankYouEmailProps } from "@/lib/types/email"

export function ThankYouEmail({ repreneur, metadata }: ThankYouEmailProps) {
  const { firstName } = repreneur
  const tier1Score = metadata?.tier1Score || 0

  return (
    <BaseLayout previewText={`Merci ${firstName}! Votre profil Re-New est complet.`}>
      <Text style={heading}>Felicitations {firstName}!</Text>

      <Text style={paragraph}>
        Votre inscription sur Re-New est maintenant complete. Merci pour votre
        confiance!
      </Text>

      <Section style={highlight}>
        <Text style={{ textAlign: "center", color: "#6b7280", margin: "0 0 8px 0" }}>
          Votre score de maturite
        </Text>
        <Text style={highlightText}>{tier1Score}/100</Text>
      </Section>

      <Text style={paragraph}>
        Notre equipe va maintenant analyser votre profil. Nous vous contacterons
        tres prochainement pour discuter de votre projet et vous presenter les
        opportunites qui correspondent a vos criteres.
      </Text>

      <Text style={paragraph}>Prochaines etapes:</Text>

      <Text style={paragraph}>
        1. Analyse de votre profil par notre equipe
        <br />
        2. Prise de contact pour un premier echange
        <br />
        3. Presentation d&apos;opportunites personnalisees
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com" style={button}>
          Decouvrir Re-New
        </Link>
      </Section>

      <Text style={paragraph}>
        A tres bientot,
        <br />
        L&apos;equipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default ThankYouEmail

import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight, highlightText } from "./base-layout"
import type { HighScoreAlertEmailProps } from "@/lib/types/email"

export function HighScoreAlertEmail({ repreneur, metadata }: HighScoreAlertEmailProps) {
  const { firstName } = repreneur
  const tier1Score = metadata?.tier1Score || 0

  return (
    <BaseLayout previewText={`${firstName}, votre profil se demarque!`}>
      <Text style={heading}>Excellente nouvelle {firstName}!</Text>

      <Text style={paragraph}>
        Votre profil a obtenu un score de maturite exceptionnellement eleve!
      </Text>

      <Section style={highlight}>
        <Text style={{ textAlign: "center", color: "#6b7280", margin: "0 0 8px 0" }}>
          Votre score
        </Text>
        <Text style={highlightText}>{tier1Score}/100</Text>
        <Text style={{ textAlign: "center", color: "#16a34a", margin: "8px 0 0 0", fontWeight: "bold" }}>
          ⭐ Profil Premium
        </Text>
      </Section>

      <Text style={paragraph}>
        Ce score exceptionnel indique que vous etes particulierement bien
        prepare pour votre projet de reprise d&apos;entreprise. Notre equipe va
        vous contacter en priorite pour vous presenter des opportunites
        exclusives.
      </Text>

      <Text style={paragraph}>Ce que cela signifie pour vous:</Text>

      <Text style={paragraph}>
        ✓ Acces prioritaire aux nouvelles opportunites
        <br />
        ✓ Accompagnement personnalise
        <br />✓ Mise en relation avec notre reseau premium
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com" style={button}>
          Voir mon profil
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

export default HighScoreAlertEmail

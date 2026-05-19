import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight, highlightText } from "./base-layout"
import type { HighScoreAlertEmailProps } from "@/lib/types/email"

/**
 * High Score Alert Email - French
 * Sent to repreneurs who achieve high dual scores (Deal Flow or Priority Interview)
 */
export function HighScoreAlertEmail({ repreneur, metadata }: HighScoreAlertEmailProps) {
  const { firstName } = repreneur
  const whoScore = metadata?.whoScore || 0
  const whenScore = metadata?.whenScore || 0
  const recommendation = metadata?.recommendation || "deal_flow"
  const flags = metadata?.flags || []

  // French labels for recommendations
  const recommendationLabels: Record<string, { title: string; description: string }> = {
    deal_flow: {
      title: "Deal Flow",
      description: "Accès prioritaire aux opportunités de reprise",
    },
    priority_interview: {
      title: "Entretien prioritaire",
      description: "Planification rapide d'un premier échange",
    },
    interview: {
      title: "Entretien",
      description: "Échange prévu pour approfondir votre projet",
    },
  }

  const recLabel = recommendationLabels[recommendation] || recommendationLabels.deal_flow

  return (
    <BaseLayout previewText={`${firstName}, votre profil se distingue !`}>
      <Text style={heading}>Excellente nouvelle {firstName} !</Text>

      <Text style={paragraph}>
        Votre profil a obtenu des scores exceptionnels sur notre grille
        d&apos;évaluation. Vous faites partie des candidats les plus qualifiés !
      </Text>

      <Section style={highlight}>
        <Text style={{ textAlign: "center", color: "#6b7280", margin: "0 0 8px 0" }}>
          Vos scores
        </Text>
        <div style={{ display: "flex", justifyContent: "center", gap: "32px", marginBottom: "12px" }}>
          <div style={{ textAlign: "center" }}>
            <Text style={{ ...highlightText, fontSize: "32px" }}>{whoScore}</Text>
            <Text style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>WHO (Profil)</Text>
          </div>
          <div style={{ textAlign: "center" }}>
            <Text style={{ ...highlightText, fontSize: "32px" }}>{whenScore}</Text>
            <Text style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>WHEN (Projet)</Text>
          </div>
        </div>
        <Text style={{ textAlign: "center", color: "#16a34a", margin: "8px 0 0 0", fontWeight: "bold" }}>
          {recLabel.title}
        </Text>
        <Text style={{ textAlign: "center", color: "#6b7280", fontSize: "14px", margin: "4px 0 0 0" }}>
          {recLabel.description}
        </Text>
      </Section>

      {flags.length > 0 && (
        <Text style={{ ...paragraph, fontSize: "12px", color: "#9ca3af" }}>
          Note : Certains éléments de votre dossier nécessitent une clarification.
          Nous en discuterons lors de notre échange.
        </Text>
      )}

      <Text style={paragraph}>
        Ce score exceptionnel indique que vous êtes particulièrement bien
        préparé(e) pour votre projet de reprise d&apos;entreprise.
      </Text>

      <Text style={heading}>Ce que cela signifie pour vous</Text>

      <Text style={paragraph}>
        • Accès prioritaire aux nouvelles opportunités
        <br />
        • Accompagnement personnalisé
        <br />
        • Connexion à notre réseau premium
      </Text>

      <Text style={paragraph}>
        Un membre de notre équipe vous contactera très rapidement pour planifier
        un premier échange et vous présenter des opportunités exclusives.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.team" style={button}>
          En savoir plus sur Re-New
        </Link>
      </Section>

      <Text style={paragraph}>
        À très bientôt,
        <br />
        L&apos;équipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default HighScoreAlertEmail

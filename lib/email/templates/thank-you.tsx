import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight, highlightText } from "./base-layout"
import type { ThankYouEmailProps } from "@/lib/types/email"

/**
 * Thank You Email - French
 * Sent after form completion with score summary
 */
export function ThankYouEmail({ repreneur, metadata }: ThankYouEmailProps) {
  const { firstName } = repreneur
  // Support both v1 (tier1Score) and v2 (whoScore + whenScore)
  const whoScore = metadata?.whoScore
  const whenScore = metadata?.whenScore
  const hasV2Scores = whoScore !== undefined && whenScore !== undefined
  const legacyScore = metadata?.tier1Score

  return (
    <BaseLayout previewText={`Merci ${firstName} ! Votre candidature Re-New est enregistrée.`}>
      <Text style={heading}>Merci {firstName} !</Text>

      <Text style={paragraph}>
        Votre inscription Re-New est maintenant complète. Merci pour votre confiance !
      </Text>

      {hasV2Scores ? (
        <Section style={highlight}>
          <Text style={{ textAlign: "center", color: "#6b7280", margin: "0 0 8px 0" }}>
            Vos scores de qualification
          </Text>
          <div style={{ display: "flex", justifyContent: "center", gap: "24px" }}>
            <div style={{ textAlign: "center" }}>
              <Text style={{ ...highlightText, fontSize: "28px" }}>{whoScore}</Text>
              <Text style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>WHO (Profil)</Text>
            </div>
            <div style={{ textAlign: "center" }}>
              <Text style={{ ...highlightText, fontSize: "28px" }}>{whenScore}</Text>
              <Text style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>WHEN (Projet)</Text>
            </div>
          </div>
        </Section>
      ) : legacyScore ? (
        <Section style={highlight}>
          <Text style={{ textAlign: "center", color: "#6b7280", margin: "0 0 8px 0" }}>
            Votre score de qualification
          </Text>
          <Text style={highlightText}>{legacyScore}/100</Text>
        </Section>
      ) : null}

      <Text style={paragraph}>
        Notre équipe va maintenant examiner votre dossier. Nous vous contacterons
        très prochainement pour discuter de votre projet et vous présenter les
        opportunités correspondant à vos critères.
      </Text>

      <Text style={heading}>Prochaines étapes</Text>

      <Text style={paragraph}>
        1. Analyse de votre dossier par notre équipe
        <br />
        2. Premier contact pour un échange téléphonique
        <br />
        3. Présentation d&apos;opportunités personnalisées
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.team" style={button}>
          Découvrir Re-New
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

export default ThankYouEmail

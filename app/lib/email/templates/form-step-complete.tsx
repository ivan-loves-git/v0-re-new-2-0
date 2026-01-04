import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight, highlightText } from "./base-layout"
import type { FormStepCompleteEmailProps } from "@/lib/types/email"

export function FormStepCompleteEmail({ repreneur, metadata }: FormStepCompleteEmailProps) {
  const { firstName } = repreneur
  const stepCompleted = metadata?.stepCompleted || 1

  return (
    <BaseLayout previewText={`${firstName}, votre profil Re-New prend forme!`}>
      <Text style={heading}>Bravo {firstName}!</Text>

      <Text style={paragraph}>
        Vous avez complete l&apos;etape {stepCompleted} de votre inscription.
        Votre profil commence a prendre forme!
      </Text>

      <Section style={highlight}>
        <Text style={highlightText}>{stepCompleted}/5</Text>
        <Text style={{ textAlign: "center", color: "#2563eb", margin: 0 }}>
          etapes completees
        </Text>
      </Section>

      <Text style={paragraph}>
        Continuez pour debloquer l&apos;acces complet a notre plateforme et
        recevoir des recommandations personnalisees.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/intake" style={button}>
          Continuer mon inscription
        </Link>
      </Section>

      <Text style={paragraph}>
        A bientot,
        <br />
        L&apos;equipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default FormStepCompleteEmail

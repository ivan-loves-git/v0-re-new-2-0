import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight } from "./base-layout"
import type { MilestoneCompletedEmailProps } from "@/lib/types/email"

export function MilestoneCompletedEmail({ repreneur, metadata }: MilestoneCompletedEmailProps) {
  const { firstName } = repreneur
  const milestoneTitle = metadata?.milestoneTitle || "Etape"
  const offerName = metadata?.offerName || "votre accompagnement"

  return (
    <BaseLayout previewText={`${firstName}, une etape importante franchie!`}>
      <Text style={heading}>Bravo {firstName}!</Text>

      <Text style={paragraph}>
        Vous avez franchi une etape importante dans {offerName}.
      </Text>

      <Section style={highlight}>
        <Text style={{ textAlign: "center", color: "#16a34a", fontSize: "24px", margin: "0 0 8px 0" }}>
          ✓
        </Text>
        <Text style={{ fontSize: "18px", fontWeight: "bold", color: "#1f2937", margin: 0, textAlign: "center" }}>
          {milestoneTitle}
        </Text>
        <Text style={{ textAlign: "center", color: "#16a34a", margin: "8px 0 0 0" }}>
          Complete!
        </Text>
      </Section>

      <Text style={paragraph}>
        Chaque etape franchie vous rapproche de votre objectif. Continuez sur
        cette lancee!
      </Text>

      <Text style={paragraph}>
        Consultez votre tableau de bord pour voir votre progression et les
        prochaines etapes.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/dashboard" style={button}>
          Voir ma progression
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

export default MilestoneCompletedEmail

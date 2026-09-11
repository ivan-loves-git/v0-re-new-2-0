import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseLayout, button, heading, paragraph } from "./base-layout"

interface OpportunityMemoAvailableEmailProps {
  firstName: string
  opportunityTitle: string
  opportunityUrl: string
}

export function OpportunityMemoAvailableEmail({
  firstName,
  opportunityTitle,
  opportunityUrl,
}: OpportunityMemoAvailableEmailProps) {
  return (
    <BaseLayout
      previewText={`Le mémo d'information de ${opportunityTitle} est disponible`}
      footerText="Vous recevez cet email dans le cadre de votre parcours de reprise avec Re-New."
    >
      <Text style={heading}>Le mémo d&apos;information est disponible</Text>
      <Text style={paragraph}>Bonjour {firstName},</Text>
      <Text style={paragraph}>
        Le mémo pour {opportunityTitle} est désormais disponible sur votre espace Re-New Wave.
      </Text>
      <Text style={paragraph}>
        Prenez le temps de le consulter. Nous vous proposons de revenir vers nous sous 5 jours ouvrés maximum avec vos retours et questions potentielles.
      </Text>
      <Section style={action}>
        <Link href={opportunityUrl} style={button}>Consulter le mémo</Link>
      </Section>
      <Text style={paragraph}>
        Nous restons à votre disposition pour en discuter et vous accompagner sur les prochaines étapes.
      </Text>
      <Text style={paragraph}>
        Merci,
        <br />
        L&apos;équipe Re-New
      </Text>
    </BaseLayout>
  )
}

const action: React.CSSProperties = {
  margin: "24px 0",
  textAlign: "center",
}

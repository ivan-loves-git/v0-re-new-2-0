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
      previewText={`L'info memo de ${opportunityTitle} est disponible`}
      footerText="Vous recevez cet email dans le cadre de votre parcours de reprise avec Re-New."
    >
      <Text style={heading}>Votre info memo est disponible</Text>
      <Text style={paragraph}>Bonjour {firstName},</Text>
      <Text style={paragraph}>
        L&apos;info memo de l&apos;opportunité « {opportunityTitle} » est maintenant disponible dans votre espace Re-New.
      </Text>
      <Text style={paragraph}>
        Vous pouvez le consulter depuis la page de cette opportunité. Ce document reste confidentiel et ne doit pas être partagé.
      </Text>
      <Section style={action}>
        <Link href={opportunityUrl} style={button}>Consulter l&apos;info memo</Link>
      </Section>
      <Text style={paragraph}>
        Bien à vous,
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

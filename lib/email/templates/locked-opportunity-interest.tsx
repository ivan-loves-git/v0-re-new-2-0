import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import {
  BaseLayout,
  button,
  heading,
  highlight,
  paragraph,
} from "./base-layout"

interface LockedOpportunityInterestEmailProps {
  repreneurName: string
  repreneurEmail: string
  opportunityReference: string
  opportunityTitle: string
  expressedAt: string
  opportunityUrl: string
  repreneurUrl: string
  hasOtherActivePursuit: boolean
}

export function getOpportunityInterestEmailCopy(hasOtherActivePursuit: boolean) {
  return {
    heading: "Nouvel intérêt repreneur",
    introduction: "Un repreneur vient de manifester son intérêt pour cette opportunité sur la plateforme.",
    followUp: hasOtherActivePursuit
      ? "Merci de qualifier cet intérêt et de valider ou rejeter la poursuite depuis la fiche opportunité. Une poursuite déjà active reste inchangée."
      : "Merci de qualifier cet intérêt et de valider ou rejeter la poursuite depuis la fiche opportunité.",
  }
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value))
}

export function LockedOpportunityInterestEmail({
  repreneurName,
  repreneurEmail,
  opportunityReference,
  opportunityTitle,
  expressedAt,
  opportunityUrl,
  repreneurUrl,
  hasOtherActivePursuit,
}: LockedOpportunityInterestEmailProps) {
  const copy = getOpportunityInterestEmailCopy(hasOtherActivePursuit)
  return (
    <BaseLayout
      previewText={`${repreneurName} a manifesté son intérêt pour ${opportunityReference}`}
      footerText="Notification interne Re-New depuis WAVE."
    >
      <Text style={heading}>{copy.heading}</Text>
      <Text style={paragraph}>{copy.introduction}</Text>

      <Section style={highlight}>
        <Text style={detailLabel}>Repreneur</Text>
        <Text style={detailValue}>{repreneurName}</Text>
        <Text style={detailMuted}>{repreneurEmail}</Text>

        <Text style={detailLabel}>Opportunité</Text>
        <Text style={detailValue}>{opportunityTitle}</Text>
        <Text style={detailMuted}>{opportunityReference}</Text>

        <Text style={detailLabel}>Intérêt exprimé le</Text>
        <Text style={detailValue}>{formatDateTime(expressedAt)}</Text>
      </Section>

      <Text style={paragraph}>{copy.followUp}</Text>

      <Section style={actions}>
        <Link href={opportunityUrl} style={button}>Voir la fiche</Link>
        <Link href={repreneurUrl} style={secondaryButton}>Voir le repreneur</Link>
      </Section>
    </BaseLayout>
  )
}

const detailLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.04em",
  margin: "16px 0 4px",
  textTransform: "uppercase",
}

const detailValue: React.CSSProperties = {
  color: "#1e3a5f",
  fontSize: "15px",
  fontWeight: "600",
  margin: 0,
}

const detailMuted: React.CSSProperties = {
  color: "#64748b",
  fontSize: "13px",
  margin: "2px 0 0",
}

const actions: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  marginTop: "24px",
}

const secondaryButton: React.CSSProperties = {
  ...button,
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  color: "#1e3a5f",
}

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
}: LockedOpportunityInterestEmailProps) {
  return (
    <BaseLayout
      previewText={`${repreneurName} expressed interest in ${opportunityReference}`}
      footerText="Internal Re-New notification from WAVE."
    >
      <Text style={heading}>Interest on a positioned opportunity</Text>
      <Text style={paragraph}>
        A repreneur expressed interest in an opportunity that already has an active pursuit.
      </Text>

      <Section style={highlight}>
        <Text style={detailLabel}>Repreneur</Text>
        <Text style={detailValue}>{repreneurName}</Text>
        <Text style={detailMuted}>{repreneurEmail}</Text>

        <Text style={detailLabel}>Opportunity</Text>
        <Text style={detailValue}>{opportunityTitle}</Text>
        <Text style={detailMuted}>{opportunityReference}</Text>

        <Text style={detailLabel}>Expressed at</Text>
        <Text style={detailValue}>{formatDateTime(expressedAt)}</Text>
      </Section>

      <Text style={paragraph}>
        Re-New&apos;s one-candidate-at-a-time principle remains unchanged. This signal does not create a queue, rank the repreneur, or reassign the opportunity. Please follow up directly and courteously.
      </Text>

      <Section style={actions}>
        <Link href={opportunityUrl} style={button}>Open opportunity</Link>
        <Link href={repreneurUrl} style={secondaryButton}>Open repreneur</Link>
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

import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight, highlightText } from "./base-layout"
import type { HighScoreAlertEmailProps } from "@/lib/types/email"

export function HighScoreAlertEmail({ repreneur, metadata }: HighScoreAlertEmailProps) {
  const { firstName } = repreneur
  const tier1Score = metadata?.tier1Score || 0

  return (
    <BaseLayout previewText={`${firstName}, your profile stands out!`}>
      <Text style={heading}>Excellent news {firstName}!</Text>

      <Text style={paragraph}>
        Your profile has achieved an exceptionally high readiness score!
      </Text>

      <Section style={highlight}>
        <Text style={{ textAlign: "center", color: "#6b7280", margin: "0 0 8px 0" }}>
          Your Score
        </Text>
        <Text style={highlightText}>{tier1Score}/100</Text>
        <Text style={{ textAlign: "center", color: "#16a34a", margin: "8px 0 0 0", fontWeight: "bold" }}>
          Premium Profile
        </Text>
      </Section>

      <Text style={paragraph}>
        This exceptional score indicates that you are particularly well
        prepared for your business acquisition project. Our team will
        contact you as a priority to present exclusive opportunities.
      </Text>

      <Text style={paragraph}>What this means for you:</Text>

      <Text style={paragraph}>
        Priority access to new opportunities
        <br />
        Personalized support
        <br />Connection to our premium network
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com" style={button}>
          View My Profile
        </Link>
      </Section>

      <Text style={paragraph}>
        See you very soon,
        <br />
        The Re-New Team
      </Text>
    </BaseLayout>
  )
}

export default HighScoreAlertEmail

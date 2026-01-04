import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight, highlightText } from "./base-layout"
import type { ThankYouEmailProps } from "@/lib/types/email"

export function ThankYouEmail({ repreneur, metadata }: ThankYouEmailProps) {
  const { firstName } = repreneur
  const tier1Score = metadata?.tier1Score || 0

  return (
    <BaseLayout previewText={`Thank you ${firstName}! Your Re-New profile is complete.`}>
      <Text style={heading}>Congratulations {firstName}!</Text>

      <Text style={paragraph}>
        Your Re-New registration is now complete. Thank you for your trust!
      </Text>

      <Section style={highlight}>
        <Text style={{ textAlign: "center", color: "#6b7280", margin: "0 0 8px 0" }}>
          Your Readiness Score
        </Text>
        <Text style={highlightText}>{tier1Score}/100</Text>
      </Section>

      <Text style={paragraph}>
        Our team will now review your profile. We will contact you very soon to
        discuss your project and present opportunities that match your criteria.
      </Text>

      <Text style={paragraph}>Next steps:</Text>

      <Text style={paragraph}>
        1. Profile review by our team
        <br />
        2. Initial contact for a first discussion
        <br />
        3. Presentation of personalized opportunities
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com" style={button}>
          Discover Re-New
        </Link>
      </Section>

      <Text style={paragraph}>
        See you soon,
        <br />
        The Re-New Team
      </Text>
    </BaseLayout>
  )
}

export default ThankYouEmail

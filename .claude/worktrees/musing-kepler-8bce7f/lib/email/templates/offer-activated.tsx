import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight } from "./base-layout"
import type { OfferActivatedEmailProps } from "@/lib/types/email"

export function OfferActivatedEmail({ repreneur, metadata }: OfferActivatedEmailProps) {
  const { firstName } = repreneur
  const offerName = metadata?.offerName || "your engagement"
  const startDate = metadata?.startDate || new Date().toLocaleDateString("en-US")

  return (
    <BaseLayout previewText={`${firstName}, your Re-New engagement begins!`}>
      <Text style={heading}>Let's go {firstName}!</Text>

      <Text style={paragraph}>
        Your engagement is now active. Your Re-New journey
        officially begins!
      </Text>

      <Section style={highlight}>
        <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1f2937", margin: 0, textAlign: "center" }}>
          {offerName}
        </Text>
        <Text style={{ textAlign: "center", color: "#2563eb", margin: "8px 0 0 0" }}>
          Active since {startDate}
        </Text>
      </Section>

      <Text style={paragraph}>
        You now have access to all the resources and services
        included in your engagement.
      </Text>

      <Text style={paragraph}>What you can do now:</Text>

      <Text style={paragraph}>
        View your personalized dashboard
        <br />
        Track your milestones and progress
        <br />
        Access exclusive resources
        <br />Contact your dedicated advisor
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/dashboard" style={button}>
          Access My Dashboard
        </Link>
      </Section>

      <Text style={paragraph}>
        Our team remains at your disposal to support you throughout
        this journey.
      </Text>

      <Text style={paragraph}>
        Welcome to Re-New!
        <br />
        The Re-New Team
      </Text>
    </BaseLayout>
  )
}

export default OfferActivatedEmail

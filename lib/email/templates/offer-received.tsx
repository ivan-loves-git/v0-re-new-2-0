import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight } from "./base-layout"
import type { OfferReceivedEmailProps } from "@/lib/types/email"

export function OfferReceivedEmail({ repreneur, metadata }: OfferReceivedEmailProps) {
  const { firstName } = repreneur
  const offerName = metadata?.offerName || "Offer"
  const offerPrice = metadata?.offerPrice || 0

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price)
  }

  return (
    <BaseLayout previewText={`${firstName}, you have received an offer from Re-New!`}>
      <Text style={heading}>New Offer for You!</Text>

      <Text style={paragraph}>
        Dear {firstName},
      </Text>

      <Text style={paragraph}>
        Following the analysis of your profile, we are pleased to
        offer you a personalized support package.
      </Text>

      <Section style={highlight}>
        <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1f2937", margin: "0 0 8px 0" }}>
          {offerName}
        </Text>
        <Text style={{ fontSize: "28px", fontWeight: "bold", color: "#2563eb", margin: 0 }}>
          {formatPrice(offerPrice)}
        </Text>
      </Section>

      <Text style={paragraph}>
        This offer has been selected to meet your specific needs
        and effectively support you in your acquisition project.
      </Text>

      <Text style={paragraph}>
        Log in to your dashboard to discover the details of this offer
        and make your decision.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/dashboard" style={button}>
          View Offer
        </Link>
      </Section>

      <Text style={paragraph}>
        Do not hesitate to contact us if you have any questions.
      </Text>

      <Text style={paragraph}>
        See you soon,
        <br />
        The Re-New Team
      </Text>
    </BaseLayout>
  )
}

export default OfferReceivedEmail

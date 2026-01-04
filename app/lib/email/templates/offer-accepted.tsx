import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight } from "./base-layout"
import type { OfferAcceptedEmailProps } from "@/lib/types/email"

export function OfferAcceptedEmail({ repreneur, metadata }: OfferAcceptedEmailProps) {
  const { firstName } = repreneur
  const offerName = metadata?.offerName || "your offer"

  return (
    <BaseLayout previewText={`${firstName}, your offer has been accepted!`}>
      <Text style={heading}>Acceptance Confirmation</Text>

      <Text style={paragraph}>
        Dear {firstName},
      </Text>

      <Text style={paragraph}>
        We confirm that you have accepted the following offer:
      </Text>

      <Section style={highlight}>
        <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1f2937", margin: 0, textAlign: "center" }}>
          {offerName}
        </Text>
        <Text style={{ textAlign: "center", color: "#16a34a", margin: "8px 0 0 0", fontWeight: "bold" }}>
          Accepted
        </Text>
      </Section>

      <Text style={paragraph}>Next steps:</Text>

      <Text style={paragraph}>
        1. Our team will prepare your file
        <br />
        2. You will receive an activation confirmation email
        <br />
        3. Your support can then begin
      </Text>

      <Text style={paragraph}>
        We will contact you very soon for the administrative
        formalities and the start of your engagement.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/dashboard" style={button}>
          Access My Dashboard
        </Link>
      </Section>

      <Text style={paragraph}>
        Thank you for your trust!
        <br />
        The Re-New Team
      </Text>
    </BaseLayout>
  )
}

export default OfferAcceptedEmail

import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import type { RejectionEmailProps } from "@/lib/types/email"

export function RejectionEmail({ repreneur }: RejectionEmailProps) {
  const { firstName } = repreneur

  return (
    <BaseLayout previewText={`${firstName}, update regarding your Re-New application`}>
      <Text style={heading}>Update on Your Application</Text>

      <Text style={paragraph}>
        Dear {firstName},
      </Text>

      <Text style={paragraph}>
        After careful review of your profile, we regret to inform you that
        we are not able to continue your support at this time.
      </Text>

      <Text style={paragraph}>
        This decision does not reflect the quality of your project. It may
        be related to several factors:
      </Text>

      <Text style={paragraph}>
        • The timing of your project
        <br />
        • Alignment with our current offerings
        <br />• Specific criteria of our program
      </Text>

      <Text style={paragraph}>
        We encourage you to continue your entrepreneurial journey. Your
        profile remains in our database, and we will not hesitate to
        contact you if an opportunity better suited to your situation
        arises.
      </Text>

      <Text style={paragraph}>
        In the meantime, feel free to explore other resources to advance
        your project:
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/resources" style={button}>
          Resources and Tips
        </Link>
      </Section>

      <Text style={paragraph}>
        We wish you great success in your endeavors.
      </Text>

      <Text style={paragraph}>
        Best regards,
        <br />
        The Re-New Team
      </Text>
    </BaseLayout>
  )
}

export default RejectionEmail

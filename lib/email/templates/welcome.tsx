import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import type { WelcomeEmailProps } from "@/lib/types/email"

export function WelcomeEmail({ repreneur }: WelcomeEmailProps) {
  const { firstName } = repreneur

  return (
    <BaseLayout previewText={`Welcome ${firstName}! Your Re-New journey begins.`}>
      <Text style={heading}>Welcome {firstName}!</Text>

      <Text style={paragraph}>
        We are delighted to welcome you to the Re-New community.
      </Text>

      <Text style={paragraph}>
        You have just taken the first step towards your business acquisition
        project. Our team is here to support you at every stage of this
        exciting journey.
      </Text>

      <Text style={paragraph}>
        Your next step: complete your profile so we can better understand
        your project and aspirations.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/intake" style={button}>
          Complete My Profile
        </Link>
      </Section>

      <Text style={paragraph}>
        If you have any questions, please do not hesitate to contact us.
      </Text>

      <Text style={paragraph}>
        See you soon,
        <br />
        The Re-New Team
      </Text>
    </BaseLayout>
  )
}

export default WelcomeEmail

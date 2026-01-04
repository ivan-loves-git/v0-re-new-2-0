import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight, highlightText } from "./base-layout"
import type { FormStepCompleteEmailProps } from "@/lib/types/email"

export function FormStepCompleteEmail({ repreneur, metadata }: FormStepCompleteEmailProps) {
  const { firstName } = repreneur
  const stepCompleted = metadata?.stepCompleted || 1

  return (
    <BaseLayout previewText={`${firstName}, your Re-New profile is taking shape!`}>
      <Text style={heading}>Well done {firstName}!</Text>

      <Text style={paragraph}>
        You have completed step {stepCompleted} of your registration.
        Your profile is starting to take shape!
      </Text>

      <Section style={highlight}>
        <Text style={highlightText}>{stepCompleted}/5</Text>
        <Text style={{ textAlign: "center", color: "#2563eb", margin: 0 }}>
          steps completed
        </Text>
      </Section>

      <Text style={paragraph}>
        Continue to unlock full access to our platform and
        receive personalized recommendations.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/intake" style={button}>
          Continue My Registration
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

export default FormStepCompleteEmail

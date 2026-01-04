import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import type { AbandonedReminderEmailProps } from "@/lib/types/email"

export function AbandonedReminderEmail({ repreneur, metadata }: AbandonedReminderEmailProps) {
  const { firstName } = repreneur
  const lastStep = metadata?.lastStep || 1

  return (
    <BaseLayout previewText={`${firstName}, your Re-New profile is waiting`}>
      <Text style={heading}>{firstName}, how are you doing?</Text>

      <Text style={paragraph}>
        We noticed that you have not completed your registration on Re-New.
        You were at step {lastStep} of 5.
      </Text>

      <Text style={paragraph}>
        Do not leave your business acquisition project on hold!
        Complete your profile in just a few minutes to:
      </Text>

      <Text style={paragraph}>
        ✓ Receive personalized opportunities
        <br />
        ✓ Access our network of experts
        <br />✓ Benefit from our support
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/intake" style={button}>
          Resume My Registration
        </Link>
      </Section>

      <Text style={paragraph}>
        If you have any questions or encounter difficulties, simply reply
        to this email.
      </Text>

      <Text style={paragraph}>
        See you soon,
        <br />
        The Re-New Team
      </Text>
    </BaseLayout>
  )
}

export default AbandonedReminderEmail

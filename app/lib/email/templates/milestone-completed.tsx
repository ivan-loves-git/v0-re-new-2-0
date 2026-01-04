import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight } from "./base-layout"
import type { MilestoneCompletedEmailProps } from "@/lib/types/email"

export function MilestoneCompletedEmail({ repreneur, metadata }: MilestoneCompletedEmailProps) {
  const { firstName } = repreneur
  const milestoneTitle = metadata?.milestoneTitle || "Milestone"
  const offerName = metadata?.offerName || "your engagement"

  return (
    <BaseLayout previewText={`${firstName}, an important milestone reached!`}>
      <Text style={heading}>Congratulations {firstName}!</Text>

      <Text style={paragraph}>
        You have reached an important milestone in {offerName}.
      </Text>

      <Section style={highlight}>
        <Text style={{ textAlign: "center", color: "#16a34a", fontSize: "24px", margin: "0 0 8px 0" }}>

        </Text>
        <Text style={{ fontSize: "18px", fontWeight: "bold", color: "#1f2937", margin: 0, textAlign: "center" }}>
          {milestoneTitle}
        </Text>
        <Text style={{ textAlign: "center", color: "#16a34a", margin: "8px 0 0 0" }}>
          Completed!
        </Text>
      </Section>

      <Text style={paragraph}>
        Each milestone you reach brings you closer to your goal. Keep up
        the momentum!
      </Text>

      <Text style={paragraph}>
        Check your dashboard to see your progress and the
        next steps.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/dashboard" style={button}>
          View My Progress
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

export default MilestoneCompletedEmail

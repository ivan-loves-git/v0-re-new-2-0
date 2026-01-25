import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import type { AbandonedReminderEmailProps } from "@/lib/types/email"

/**
 * Abandoned Reminder Email - French
 * Sent to repreneurs who started but didn't complete the intake form
 */
export function AbandonedReminderEmail({ repreneur, metadata }: AbandonedReminderEmailProps) {
  const { firstName } = repreneur
  const lastStep = metadata?.lastStep || 1
  const totalSteps = metadata?.totalSteps || 6

  return (
    <BaseLayout previewText={`${firstName}, finalisez votre inscription Re-New`}>
      <Text style={heading}>{firstName}, votre projet vous attend</Text>

      <Text style={paragraph}>
        Nous avons remarqué que vous n&apos;avez pas terminé votre inscription
        sur Re-New. Vous étiez à l&apos;étape {lastStep} sur {totalSteps}.
      </Text>

      <Text style={paragraph}>
        Ne laissez pas votre projet de reprise d&apos;entreprise en suspens !
        Finalisez votre profil en quelques minutes pour :
      </Text>

      <Text style={paragraph}>
        • Recevoir des opportunités personnalisées
        <br />
        • Accéder à notre réseau d&apos;experts
        <br />
        • Bénéficier de notre accompagnement
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://app.re-new.team/intake-v2" style={button}>
          Reprendre mon inscription
        </Link>
      </Section>

      <Text style={paragraph}>
        Si vous avez des questions ou rencontrez des difficultés, répondez
        simplement à cet email.
      </Text>

      <Text style={paragraph}>
        À bientôt,
        <br />
        L&apos;équipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default AbandonedReminderEmail

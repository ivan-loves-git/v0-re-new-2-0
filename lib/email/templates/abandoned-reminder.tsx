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
    <BaseLayout previewText={`${firstName}, finalisez votre profil repreneur`}>
      <Text style={heading}>Finalisez votre profil repreneur</Text>

      <Text style={paragraph}>
        {firstName}, votre profil repreneur vous attend
      </Text>

      <Text style={paragraph}>
        Vous &ecirc;tes &agrave; l&apos;&eacute;tape {lastStep} sur {totalSteps}.
        Finalisez votre profil en quelques minutes pour :
      </Text>

      <Text style={paragraph}>
        &bull; &Eacute;valuer la solidit&eacute; de votre projet
        <br />
        &bull; Rejoindre un &eacute;cosyst&egrave;me de repreneurs
        <br />
        &bull; Recevoir des opportunit&eacute;s personnalis&eacute;es
        <br />
        &bull; B&eacute;n&eacute;ficier d&apos;un accompagnement personnalis&eacute;
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://app.re-new.team/welcome" style={button}>
          Reprendre mon inscription
        </Link>
      </Section>

      <Text style={paragraph}>
        Si vous avez des questions, contactez-nous &agrave;{" "}
        <Link href="mailto:contact@re-new.team">contact@re-new.team</Link>.
      </Text>

      <Text style={paragraph}>
        &Agrave; bient&ocirc;t,
        <br />
        L&apos;&eacute;quipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default AbandonedReminderEmail

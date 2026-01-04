import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import type { AbandonedReminderEmailProps } from "@/lib/types/email"

export function AbandonedReminderEmail({ repreneur, metadata }: AbandonedReminderEmailProps) {
  const { firstName } = repreneur
  const lastStep = metadata?.lastStep || 1

  return (
    <BaseLayout previewText={`${firstName}, votre profil Re-New vous attend`}>
      <Text style={heading}>{firstName}, ou en etes-vous?</Text>

      <Text style={paragraph}>
        Nous avons remarque que vous n&apos;avez pas termine votre inscription
        sur Re-New. Vous etiez a l&apos;etape {lastStep} sur 5.
      </Text>

      <Text style={paragraph}>
        Ne laissez pas votre projet de reprise d&apos;entreprise en suspens!
        Completez votre profil en quelques minutes pour:
      </Text>

      <Text style={paragraph}>
        ✓ Recevoir des opportunites personnalisees
        <br />
        ✓ Acceder a notre reseau d&apos;experts
        <br />✓ Beneficier de notre accompagnement
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/intake" style={button}>
          Reprendre mon inscription
        </Link>
      </Section>

      <Text style={paragraph}>
        Si vous avez des questions ou rencontrez des difficultes, repondez
        simplement a cet email.
      </Text>

      <Text style={paragraph}>
        A bientot,
        <br />
        L&apos;equipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default AbandonedReminderEmail

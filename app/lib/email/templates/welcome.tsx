import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import type { WelcomeEmailProps } from "@/lib/types/email"

export function WelcomeEmail({ repreneur }: WelcomeEmailProps) {
  const { firstName } = repreneur

  return (
    <BaseLayout previewText={`Bienvenue ${firstName}! Votre aventure Re-New commence.`}>
      <Text style={heading}>Bienvenue {firstName}!</Text>

      <Text style={paragraph}>
        Nous sommes ravis de vous accueillir dans la communaute Re-New.
      </Text>

      <Text style={paragraph}>
        Vous venez de faire le premier pas vers votre projet de reprise
        d&apos;entreprise. Notre equipe est la pour vous accompagner a chaque
        etape de ce parcours passionnant.
      </Text>

      <Text style={paragraph}>
        Votre prochaine etape: completez votre profil pour nous permettre de
        mieux comprendre votre projet et vos aspirations.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/intake" style={button}>
          Completer mon profil
        </Link>
      </Section>

      <Text style={paragraph}>
        Si vous avez des questions, n&apos;hesitez pas a nous contacter.
      </Text>

      <Text style={paragraph}>
        A tres bientot,
        <br />
        L&apos;equipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default WelcomeEmail

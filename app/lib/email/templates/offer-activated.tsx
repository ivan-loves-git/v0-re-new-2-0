import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight } from "./base-layout"
import type { OfferActivatedEmailProps } from "@/lib/types/email"

export function OfferActivatedEmail({ repreneur, metadata }: OfferActivatedEmailProps) {
  const { firstName } = repreneur
  const offerName = metadata?.offerName || "votre accompagnement"
  const startDate = metadata?.startDate || new Date().toLocaleDateString("fr-FR")

  return (
    <BaseLayout previewText={`${firstName}, votre accompagnement Re-New demarre!`}>
      <Text style={heading}>C&apos;est parti {firstName}!</Text>

      <Text style={paragraph}>
        Votre accompagnement est maintenant actif. Votre aventure Re-New
        commence officiellement!
      </Text>

      <Section style={highlight}>
        <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1f2937", margin: 0, textAlign: "center" }}>
          {offerName}
        </Text>
        <Text style={{ textAlign: "center", color: "#2563eb", margin: "8px 0 0 0" }}>
          Active depuis le {startDate}
        </Text>
      </Section>

      <Text style={paragraph}>
        Vous avez maintenant acces a l&apos;ensemble des ressources et services
        inclus dans votre accompagnement.
      </Text>

      <Text style={paragraph}>Ce que vous pouvez faire maintenant:</Text>

      <Text style={paragraph}>
        ✓ Consulter votre tableau de bord personnalise
        <br />
        ✓ Suivre vos etapes et jalons
        <br />
        ✓ Acceder aux ressources exclusives
        <br />✓ Contacter votre conseiller dedie
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/dashboard" style={button}>
          Acceder a mon espace
        </Link>
      </Section>

      <Text style={paragraph}>
        Notre equipe reste a votre disposition pour vous accompagner tout au
        long de ce parcours.
      </Text>

      <Text style={paragraph}>
        Bienvenue chez Re-New!
        <br />
        L&apos;equipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default OfferActivatedEmail

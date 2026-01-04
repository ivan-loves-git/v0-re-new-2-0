import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight } from "./base-layout"
import type { OfferReceivedEmailProps } from "@/lib/types/email"

export function OfferReceivedEmail({ repreneur, metadata }: OfferReceivedEmailProps) {
  const { firstName } = repreneur
  const offerName = metadata?.offerName || "Offre"
  const offerPrice = metadata?.offerPrice || 0

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price)
  }

  return (
    <BaseLayout previewText={`${firstName}, vous avez recu une offre de Re-New!`}>
      <Text style={heading}>Nouvelle offre pour vous!</Text>

      <Text style={paragraph}>
        Bonjour {firstName},
      </Text>

      <Text style={paragraph}>
        Suite a l&apos;analyse de votre profil, nous avons le plaisir de vous
        proposer une offre d&apos;accompagnement personnalisee.
      </Text>

      <Section style={highlight}>
        <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1f2937", margin: "0 0 8px 0" }}>
          {offerName}
        </Text>
        <Text style={{ fontSize: "28px", fontWeight: "bold", color: "#2563eb", margin: 0 }}>
          {formatPrice(offerPrice)}
        </Text>
      </Section>

      <Text style={paragraph}>
        Cette offre a ete selectionnee pour repondre a vos besoins specifiques
        et vous accompagner efficacement dans votre projet de reprise.
      </Text>

      <Text style={paragraph}>
        Connectez-vous a votre espace pour decouvrir les details de cette offre
        et prendre votre decision.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/dashboard" style={button}>
          Voir l&apos;offre
        </Link>
      </Section>

      <Text style={paragraph}>
        N&apos;hesitez pas a nous contacter si vous avez des questions.
      </Text>

      <Text style={paragraph}>
        A bientot,
        <br />
        L&apos;equipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default OfferReceivedEmail

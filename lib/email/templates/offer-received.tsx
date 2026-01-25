import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight } from "./base-layout"
import type { OfferReceivedEmailProps } from "@/lib/types/email"

/**
 * Offer Received Email - French
 * Sent when a repreneur receives a new offer/package
 */
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
    <BaseLayout previewText={`${firstName}, vous avez reçu une offre de Re-New !`}>
      <Text style={heading}>Une offre vous attend !</Text>

      <Text style={paragraph}>
        Cher(e) {firstName},
      </Text>

      <Text style={paragraph}>
        Suite à l&apos;analyse de votre profil, nous avons le plaisir de vous
        proposer un accompagnement personnalisé.
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
        Cette offre a été sélectionnée pour répondre à vos besoins spécifiques
        et vous accompagner efficacement dans votre projet de reprise.
      </Text>

      <Text style={paragraph}>
        Connectez-vous à votre espace pour découvrir le détail de cette offre
        et prendre votre décision.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://app.re-new.team" style={button}>
          Voir l&apos;offre
        </Link>
      </Section>

      <Text style={paragraph}>
        N&apos;hésitez pas à nous contacter si vous avez des questions à{" "}
        <Link href="mailto:contact@re-new.team">contact@re-new.team</Link>.
      </Text>

      <Text style={paragraph}>
        À bientôt,
        <br />
        L&apos;équipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default OfferReceivedEmail

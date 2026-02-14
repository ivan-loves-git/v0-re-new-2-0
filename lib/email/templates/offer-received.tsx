import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, highlight } from "./base-layout"
import type { OfferReceivedEmailProps } from "@/lib/types/email"

/**
 * Offer Received Email - French
 * Sent when a repreneur receives a new offer/package
 * Currently deactivated - will be activated later
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
    <BaseLayout previewText={`${firstName}, une offre Re-New adaptée à votre projet`}>
      <Text style={heading}>L&apos;offre de Re-New adapt&eacute;e &agrave; votre projet</Text>

      <Text style={paragraph}>
        Cher(e) {firstName},
      </Text>

      <Text style={paragraph}>
        Une offre vous attend ! Suite &agrave; l&apos;analyse de votre profil,
        nous avons le plaisir de vous proposer un accompagnement personnalis&eacute;.
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
        Cette offre a &eacute;t&eacute; s&eacute;lectionn&eacute;e pour r&eacute;pondre
        &agrave; vos besoins sp&eacute;cifiques et vous accompagner efficacement
        dans votre projet de reprise.
      </Text>

      <Text style={paragraph}>
        N&apos;h&eacute;sitez pas &agrave; nous contacter si vous avez des questions &agrave;{" "}
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

export default OfferReceivedEmail

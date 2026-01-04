import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button, highlight } from "./base-layout"
import type { OfferAcceptedEmailProps } from "@/lib/types/email"

export function OfferAcceptedEmail({ repreneur, metadata }: OfferAcceptedEmailProps) {
  const { firstName } = repreneur
  const offerName = metadata?.offerName || "votre offre"

  return (
    <BaseLayout previewText={`${firstName}, votre offre a ete acceptee!`}>
      <Text style={heading}>Confirmation d&apos;acceptation</Text>

      <Text style={paragraph}>
        Bonjour {firstName},
      </Text>

      <Text style={paragraph}>
        Nous confirmons que vous avez accepte l&apos;offre suivante:
      </Text>

      <Section style={highlight}>
        <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1f2937", margin: 0, textAlign: "center" }}>
          {offerName}
        </Text>
        <Text style={{ textAlign: "center", color: "#16a34a", margin: "8px 0 0 0", fontWeight: "bold" }}>
          ✓ Acceptee
        </Text>
      </Section>

      <Text style={paragraph}>Prochaines etapes:</Text>

      <Text style={paragraph}>
        1. Notre equipe va preparer votre dossier
        <br />
        2. Vous recevrez un email de confirmation d&apos;activation
        <br />
        3. Votre accompagnement pourra alors commencer
      </Text>

      <Text style={paragraph}>
        Nous vous contacterons tres prochainement pour les formalites
        administratives et le demarrage de votre accompagnement.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.com/dashboard" style={button}>
          Acceder a mon espace
        </Link>
      </Section>

      <Text style={paragraph}>
        Merci pour votre confiance!
        <br />
        L&apos;equipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default OfferAcceptedEmail

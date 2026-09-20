import { Text } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph } from "./base-layout"
import type { ThankYouEmailProps } from "@/lib/types/email"
import { renderMarkdownBody } from "./markdown-body"

/** Sent after form completion. Qualification scoring is never disclosed here. */
export function ThankYouEmail({ repreneur, bodyOverride }: ThankYouEmailProps) {
  const { firstName } = repreneur
  return (
    <BaseLayout previewText="Votre inscription Re-New est confirmée">
      <Text style={heading}>Merci {firstName} !</Text>
      {bodyOverride ? renderMarkdownBody(bodyOverride, { firstName }) : <>
      <Text style={paragraph}>Votre inscription Re-New est maintenant complète.</Text>
      <Text style={paragraph}>Notre équipe va maintenant examiner votre dossier. Nous vous contacterons très prochainement pour fixer un rendez-vous afin d&apos;approfondir notre compréhension de votre projet de reprise.</Text>
      <Text style={paragraph}>À très bientôt,<br />L&apos;équipe Re-New</Text>
      </>}
    </BaseLayout>
  )
}

export default ThankYouEmail

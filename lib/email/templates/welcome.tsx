import { Text, Link, Section } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import { renderMarkdownBody } from "./markdown-body"
import type { WelcomeEmailProps } from "@/lib/types/email"

/**
 * Welcome Email - French
 * Sent after successful intake form submission.
 *
 * Body is editable from the Templates UI: when `bodyOverride` is passed
 * (admin-edited copy from email_templates.body_markdown), it replaces
 * the hardcoded paragraphs below. The branded layout, heading and CTA
 * stay constant so the email looks consistent regardless of edits.
 */
export function WelcomeEmail({ repreneur, bodyOverride }: WelcomeEmailProps) {
  const { firstName } = repreneur

  return (
    <BaseLayout previewText={`Bienvenue ${firstName} ! Votre parcours Re-New commence.`}>
      <Text style={heading}>Bienvenue chez Re-New</Text>

      {bodyOverride ? (
        renderMarkdownBody(bodyOverride, { firstName })
      ) : (
        <>
          <Text style={paragraph}>Bienvenue {firstName},</Text>

          <Text style={paragraph}>
            Nous sommes ravis de vous accueillir dans la communaut&eacute; Re-New.
            Vous venez de franchir une &eacute;tape importante dans la structuration
            de votre projet de reprise d&apos;entreprise.
          </Text>

          <Text style={paragraph}>
            Notre &eacute;quipe est l&agrave; pour vous accompagner &agrave; chaque
            &eacute;tape de ce parcours.
          </Text>
        </>
      )}

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href="https://re-new.team/fr" style={button}>
          D&eacute;couvrir Re-New
        </Link>
      </Section>

      {!bodyOverride && (
        <>
          <Text style={heading}>Prochaines &eacute;tapes</Text>

          <Text style={paragraph}>
            Un membre de notre &eacute;quipe vous contactera sous 24 &agrave; 48h
            pour un premier &eacute;change. En attendant, n&apos;h&eacute;sitez pas
            &agrave; explorer notre site et nos ressources.
          </Text>

          <Text style={paragraph}>
            Si vous avez des questions, contactez-nous &agrave;{" "}
            <Link href="mailto:contact@re-new.team">contact@re-new.team</Link>.
          </Text>

          <Text style={paragraph}>
            &Agrave; tr&egrave;s bient&ocirc;t,
            <br />
            L&apos;&eacute;quipe Re-New
          </Text>
        </>
      )}
    </BaseLayout>
  )
}

export default WelcomeEmail

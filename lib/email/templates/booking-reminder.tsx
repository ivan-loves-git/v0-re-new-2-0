import { Text, Link } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph, button } from "./base-layout"
import { renderMarkdownBody } from "./markdown-body"
import type { EmailTemplateProps } from "@/lib/types/email"

const CALENDLY_URL = "https://calendly.com/bertrand-re-new/30min"

/**
 * Booking Reminder Email — French
 *
 * Sent once when a repreneur applied >5 days ago and has NOT booked an
 * interview yet. Copy provided by Bertrand 2026-04-26 and now editable
 * from the Templates UI: when `bodyOverride` is passed, it replaces the
 * hardcoded paragraphs. The heading and branded layout stay constant.
 */
export function BookingReminderEmail({ repreneur, bodyOverride }: EmailTemplateProps) {
  const { firstName } = repreneur

  return (
    <BaseLayout previewText="Réservez votre entretien avec Re-New">
      <Text style={heading}>Réservez votre entretien avec Re-New</Text>

      {bodyOverride ? (
        renderMarkdownBody(bodyOverride, { firstName })
      ) : (
        <>
          <Text style={paragraph}>Bonjour {firstName},</Text>

          <Text style={paragraph}>Nous n&apos;avons pas encore de créneau d&apos;entretien réservé de votre part.</Text>
          <Text style={paragraph}>Pourriez-vous prendre quelques minutes pour choisir un horaire qui vous convient ?</Text>

          <Text style={paragraph}>
            <Link href={CALENDLY_URL} style={button}>Réserver mon entretien</Link>
          </Text>

          <Text style={paragraph}>
            À très vite,
            <br />
            L&apos;équipe Re-New
          </Text>
        </>
      )}
    </BaseLayout>
  )
}

export default BookingReminderEmail

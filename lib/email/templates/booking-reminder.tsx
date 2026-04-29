import { Text, Link } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph } from "./base-layout"
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
    <BaseLayout previewText={`Bonjour ${firstName}, planifions un premier échange`}>
      <Text style={heading}>Planifions un premier échange</Text>

      {bodyOverride ? (
        renderMarkdownBody(bodyOverride, { firstName })
      ) : (
        <>
          <Text style={paragraph}>Bonjour {firstName},</Text>

          <Text style={paragraph}>
            Je vous remercie à nouveau pour le partage de votre profil et de votre projet de reprise.
          </Text>

          <Text style={paragraph}>
            J&apos;ai bien pris connaissance de vos premiers éléments et vous propose de planifier un
            premier échange de 30 minutes, au moment qui vous conviendra le mieux, via le lien
            ci-dessous :
          </Text>

          <Text style={paragraph}>
            <Link href={CALENDLY_URL}>{CALENDLY_URL}</Link>
          </Text>

          <Text style={paragraph}>
            Ce sera l&apos;occasion de mieux comprendre votre recherche, votre trajectoire et la manière
            dont nous pourrions vous accompagner.
          </Text>

          <Text style={paragraph}>
            Au plaisir d&apos;échanger prochainement,
            <br />
            Bertrand Galas
          </Text>
        </>
      )}
    </BaseLayout>
  )
}

export default BookingReminderEmail

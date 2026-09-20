import { Text } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading, paragraph } from "./base-layout"
import type { InterviewReminderEmailProps } from "@/lib/types/email"

/**
 * Interview Reminder Email - French
 *
 * Sent ~24h before an interview scheduled in the activity stream.
 * Placeholder copy - Bertrand can edit this file directly.
 */
export function InterviewReminderEmail({ repreneur, metadata }: InterviewReminderEmailProps) {
  const { firstName } = repreneur
  const interviewAt = metadata?.interviewAt
  if (!interviewAt) throw new Error("An interview reminder requires its scheduled date.")

  // `interviewAt` can be either a date-only string (YYYY-MM-DD, from activities.event_date)
  // or a full ISO timestamp. Only include the time component if it looks precise.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(interviewAt)
  const parsed = new Date(isDateOnly ? interviewAt + "T12:00:00" : interviewAt)
  const when = parsed.toLocaleString(
    "fr-FR",
    isDateOnly
      ? { weekday: "long", day: "numeric", month: "long" }
      : { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }
  )

  return (
    <BaseLayout previewText={`Rappel : votre entretien Re-New ${when}`}>
      <Text style={heading}>Rappel — votre entretien avec Re-New</Text>

      <Text style={paragraph}>Bonjour {firstName},</Text>

      <Text style={paragraph}>
        Petit rappel : votre rendez-vous avec notre équipe est prévu demain.
      </Text>

      <Text style={paragraph}>
        N&apos;hésitez pas à nous contacter si vous souhaitez modifier l&apos;horaire.
      </Text>

      <Text style={paragraph}>
        À très bientôt,
        <br />
        L&apos;&eacute;quipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default InterviewReminderEmail

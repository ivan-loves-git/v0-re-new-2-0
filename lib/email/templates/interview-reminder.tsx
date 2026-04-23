import { Text, Link } from "@react-email/components"
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
  const { interviewAt, notes } = metadata

  const when = new Date(interviewAt).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <BaseLayout previewText={`Rappel : votre entretien Re-New ${when}`}>
      <Text style={heading}>Rappel d&apos;entretien</Text>

      <Text style={paragraph}>Bonjour {firstName},</Text>

      <Text style={paragraph}>
        Petit rappel : nous avons un entretien pr&eacute;vu ensemble <strong>{when}</strong>.
      </Text>

      {notes && (
        <Text style={paragraph}>
          Pour rejoindre l&apos;entretien, utilisez le lien qui vous a &eacute;t&eacute; transmis
          lors de la r&eacute;servation&nbsp;:
          <br />
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: "#4b5563" }}>
            {notes}
          </span>
        </Text>
      )}

      <Text style={paragraph}>
        Si vous ne pouvez plus &ecirc;tre pr&eacute;sent, merci de nous pr&eacute;venir au plus
        vite en r&eacute;pondant &agrave; cet email ou &agrave;{" "}
        <Link href="mailto:contact@re-new.team">contact@re-new.team</Link>.
      </Text>

      <Text style={paragraph}>
        &Agrave; tr&egrave;s vite,
        <br />
        L&apos;&eacute;quipe Re-New
      </Text>
    </BaseLayout>
  )
}

export default InterviewReminderEmail

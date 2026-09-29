import * as React from "react"
import { Text } from "@react-email/components"
import { BaseLayout, heading } from "./base-layout"
import { renderMarkdownBody } from "./markdown-body"

/** Only public recommendation fields and an operational staff name enter this
 * renderer. Internal scoring, source identity and notes are not accepted. */
export function RecommendationCycleNotificationEmail({
  subject, body, variables, staff,
}: {
  subject: string
  body: string
  variables: Record<string, string>
  staff: boolean
}) {
  return (
    <BaseLayout
      previewText={subject}
      footerText={staff
        ? "Notification opérationnelle destinée à l'équipe Re-New."
        : "Vous recevez ce rappel au sujet d’une recommandation Re-New."}
    >
      <Text style={heading}>{subject}</Text>
      {renderMarkdownBody(body, variables)}
    </BaseLayout>
  )
}

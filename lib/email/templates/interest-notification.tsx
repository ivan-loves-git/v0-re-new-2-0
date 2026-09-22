import * as React from "react"
import { Text } from "@react-email/components"
import { BaseLayout, heading } from "./base-layout"
import { renderMarkdownBody } from "./markdown-body"

/** Only public or operational variables are accepted. Internal decision notes
 * and opportunity source fields never enter this component. */
export function InterestNotificationEmail({
  subject,
  body,
  variables,
  staff,
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
        : "Vous recevez ce message au sujet de votre intérêt pour une opportunité Re-New."}
    >
      <Text style={heading}>{subject}</Text>
      {renderMarkdownBody(body, variables)}
    </BaseLayout>
  )
}

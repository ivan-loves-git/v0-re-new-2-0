import * as React from "react"
import { Text } from "@react-email/components"
import { BaseLayout, heading } from "./base-layout"
import { renderMarkdownBody } from "./markdown-body"

/** The variables are deliberately limited to public opportunity and greeting
 * fields. No memo content, source, staff notes, or receipt detail is passed. */
export function MemoFeedbackReminderEmail({
  subject, body, variables,
}: {
  subject: string
  body: string
  variables: Record<string, string>
}) {
  return (
    <BaseLayout previewText={subject} footerText="Vous recevez ce message à la suite de votre accès au mémorandum d’une opportunité Re-New.">
      <Text style={heading}>{subject}</Text>
      {renderMarkdownBody(body, variables)}
    </BaseLayout>
  )
}

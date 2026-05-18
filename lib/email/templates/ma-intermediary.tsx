import { Text } from "@react-email/components"
import * as React from "react"
import { BaseLayout, heading } from "./base-layout"
import { renderMarkdownBody } from "./markdown-body"

interface MaIntermediaryEmailProps {
  subject: string
  body: string
  variables?: Record<string, string>
}

export function MaIntermediaryEmail({
  subject,
  body,
  variables = {},
}: MaIntermediaryEmailProps) {
  return (
    <BaseLayout
      previewText={subject}
      footerText="Vous recevez cet email car vous echangez avec Re-New autour d'une opportunite de reprise."
    >
      <Text style={heading}>{subject}</Text>
      {renderMarkdownBody(body, variables)}
    </BaseLayout>
  )
}

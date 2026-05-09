import { Text } from "@react-email/components"
import * as React from "react"
import { paragraph } from "./base-layout"

/**
 * Render a markdown-ish body for editable templates.
 * Splits on double newlines into paragraphs and substitutes simple
 * {variable} placeholders. Keeps the same paragraph styling as
 * the rest of the email layout so DB-edited copy looks identical
 * to the hardcoded React templates.
 */
export function renderMarkdownBody(
  body: string,
  variables: Record<string, string> = {},
): React.ReactNode {
  const substituted = body.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  })

  const blocks = substituted.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)

  return blocks.map((block, i) => (
    <Text key={i} style={paragraph}>
      {block.split("\n").map((line, j) => (
        <React.Fragment key={j}>
          {j > 0 && <br />}
          {line}
        </React.Fragment>
      ))}
    </Text>
  ))
}

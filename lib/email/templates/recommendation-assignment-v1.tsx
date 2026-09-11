import * as React from "react"

// Immutable copy version for a logical delivery: retries must not change the
// provider payload. No portal link, expiry promise, internal fields or HTML.
export const RECOMMENDATION_ASSIGNMENT_SUBJECT_V1 = "Une opportunité sélectionnée pour vous"

export function RecommendationAssignmentEmailV1({ firstName, publicTitle, teaser }: {
  firstName: string; publicTitle: string; teaser: string | null
}) {
  return (
    <html lang="fr"><body>
      <p>Bonjour {firstName},</p>
      <p>L’équipe Re-New a sélectionné cette opportunité pour vous :</p>
      <h1>{publicTitle}</h1>
      {teaser ? <p style={{ whiteSpace: "pre-line" }}>{teaser}</p> : null}
      <p>Si cette opportunité vous intéresse, contactez votre interlocuteur habituel chez Re-New pour en discuter.</p>
      <p>L’équipe Re-New</p>
    </body></html>
  )
}

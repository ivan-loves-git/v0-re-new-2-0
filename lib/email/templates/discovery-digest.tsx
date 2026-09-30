import * as React from "react"

export type DiscoveryDigestItem = { publicTitle: string; teaserSummary: string }

/** Only the frozen, separately approved public title and teaser enter this email. */
export function DiscoveryDigestEmail({ firstName, items }: {
  firstName: string
  items: readonly DiscoveryDigestItem[]
}) {
  return (
    <html lang="fr"><body style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.55, color: "#172025" }}>
      <main style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <p>Bonjour{firstName.trim() ? ` ${firstName.trim()}` : ""},</p>
        <p>Voici les nouvelles opportunités publiques présentées par Re-New ces trois derniers jours.</p>
        {items.map((item, index) => (
          <section key={index} style={{ borderTop: "1px solid #d8e0df", padding: "18px 0" }}>
            <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>{item.publicTitle}</h2>
            <p style={{ whiteSpace: "pre-line", margin: 0 }}>{item.teaserSummary}</p>
          </section>
        ))}
        <p><a href="https://app.re-new.team/portal/deals">Voir les opportunités dans Re-New</a></p>
        <p>Vous pouvez arrêter ce récapitulatif depuis <a href="https://app.re-new.team/portal/profile">votre profil</a>. Votre accès et les autres communications ne changent pas.</p>
        <p>L’équipe Re-New</p>
      </main>
    </body></html>
  )
}

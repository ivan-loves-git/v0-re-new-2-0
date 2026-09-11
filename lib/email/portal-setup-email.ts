function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
}

export function renderPortalAccessSetupEmail(
  name: string | null | undefined,
  url: string,
  validity: "1 heure" | "7 jours",
) {
  const displayName = escapeHtml(name?.trim() || "")
  const safeUrl = escapeHtml(url)

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.5;">
      <h2 style="color: #111827; margin-bottom: 16px;">Votre accès à votre espace Re-New</h2>
      <p>Bonjour${displayName ? ` ${displayName}` : ""},</p>
      <p>Votre espace personnel Re-New est prêt.</p>
      <p>Vous pouvez dès à présent créer votre mot de passe et accéder à votre espace pour suivre votre projet de reprise, consulter les opportunités qui vous correspondent, et échanger avec notre équipe.</p>
      <p style="margin: 28px 0;">
        <a href="${safeUrl}" style="background: #111827; color: white; padding: 12px 22px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600;">
          Créer mon mot de passe
        </a>
      </p>
      <p style="color: #4b5563; font-size: 14px;">Ce lien est valable pendant ${validity}.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">Re-New Platform</p>
    </div>
  `
}

import "server-only"

import { FROM_EMAIL, FROM_NAME } from "@/lib/email/resend-client"
import { env } from "@/lib/env"

export function fixedIntermediaryHandoffCopy(type: "e4" | "e7", blankPresent: boolean) {
  const body = type === "e4"
    ? `Bonjour {firstName},\n\nUn des repreneurs que nous accompagnons est intéressé par ${blankPresent ? "votre opportunité" : "une de vos opportunités"} : {opportunityTitle}.${blankPresent ? "\n\nLe NDA de votre cabinet étant déjà en notre possession, nous attendons votre validation avant de le faire signer au repreneur." : "\n\nPourriez-vous, s'il vous plaît, nous transmettre un NDA à signer afin de recevoir l'IM ?"}\n\nBien à vous,\n\nL'équipe Re-New`
    : "Bonjour {firstName},\n\nVous trouverez ci-joint le NDA signé par le repreneur et par nous pour l'opportunité : {opportunityTitle}.\n\nPourriez-vous, s'il vous plaît, nous transmettre l'IM et les éléments de présentation disponibles sur le dossier ?\n\nBien à vous,\n\nL'équipe Re-New"
  const subject = type === "e7"
    ? "NDA signé - Demande de mémo d'information - {opportunityTitle}"
    : blankPresent ? "Confirmation d'intérêt repreneur - {opportunityTitle}" : "Processus NDA - {opportunityTitle}"
  return { subject, body }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}

export function buildPursuitNdaReadyRequest(matchId: string, context: { repreneur: { email: string | null; first_name: string | null }; opportunity: { public_title: string | null } }) {
  const email = context.repreneur.email?.trim()
  if (!email) throw new Error("Add an email to this repreneur before sending the NDA-ready notice.")
  const url = `${(env.NEXT_PUBLIC_APP_URL ?? "https://app.re-new.team").replace(/\/$/, "")}/portal/deals/${matchId}`
  const title = context.opportunity.public_title?.trim() || "Opportunité de reprise"
  const text = `Bonjour${context.repreneur.first_name ? ` ${context.repreneur.first_name}` : ""},\n\nLe NDA de l'opportunité : ${title} est désormais disponible sur votre espace Re-New Wave.\n\nNous enverrons la demande du mémo dès que le NDA aura été signé et uploadé dans la plateforme.\n\nSi vous avez la moindre question sur le contenu du document, n'hésitez pas à revenir vers nous avant signature.\n\nAccéder à mon espace : ${url}\n\nMerci,\n\nL'équipe Re-New`
  return { from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [email], subject: `Votre NDA est prêt à signer - ${title}`, html: `<p>${escapeHtml(text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`, text }
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, BookOpenText, Clock3, ListChecks } from "lucide-react"
import { useUiLanguage } from "@/components/i18n/ui-text"
import { displayLocale } from "@/lib/i18n/ui-language"
import { isRecommendationResponseOpen } from "@/lib/opportunity-recommendation-window"
import type { PortalNextActionsProjection } from "@/lib/portal-next-actions"

const copy = {
  en: {
    heading: "Your next steps",
    description: "Only current actions and resources recorded for your pursuits appear here.",
    unavailable: "Current actions are unavailable. Open a pursuit to check its latest state.",
    actions: "Your actions",
    waiting: "Waiting for Re-New",
    resources: "Available resources",
    noActions: "No current action is recorded.",
    noWaiting: "Nothing is currently waiting for Re-New here.",
    noResources: "No resource is currently available here.",
    respond: "Review this recommendation",
    sign: "Sign and upload your NDA",
    external: "Saved next step",
    interest: "Interest sent for validation",
    nda: "Signed NDA awaiting validation",
    staff: "Saved next step for Re-New",
    template: "Blank NDA template",
    memorandum: "Information memorandum",
    openPursuit: "Open pursuit",
    openDossier: "Open External Pursuits",
    openResource: "Open resource",
    responseCloses: "Response window closes",
    recordedDue: "Recorded due date",
  },
  fr: {
    heading: "Vos prochaines étapes",
    description: "Seules les actions et ressources actuelles enregistrées pour vos poursuites figurent ici.",
    unavailable: "Les actions actuelles sont indisponibles. Ouvrez une poursuite pour vérifier son état récent.",
    actions: "Vos actions",
    waiting: "En attente de Re-New",
    resources: "Ressources disponibles",
    noActions: "Aucune action actuelle n’est enregistrée.",
    noWaiting: "Aucune étape n’est actuellement en attente de Re-New ici.",
    noResources: "Aucune ressource n’est actuellement disponible ici.",
    respond: "Examiner cette recommandation",
    sign: "Signer et déposer votre NDA",
    external: "Prochaine étape enregistrée",
    interest: "Intérêt envoyé pour validation",
    nda: "NDA signé en attente de validation",
    staff: "Prochaine étape enregistrée pour Re-New",
    template: "Modèle de NDA vierge",
    memorandum: "Mémorandum d’information",
    openPursuit: "Ouvrir la poursuite",
    openDossier: "Ouvrir les poursuites externes",
    openResource: "Ouvrir la ressource",
    responseCloses: "Fin de la période de réponse",
    recordedDue: "Date enregistrée",
  },
} as const

function formatResponseDeadline(value: string, language: "en" | "fr") {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(displayLocale(language), {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris",
  }).format(date)
}

function formatCivilDate(value: string, language: "en" | "fr") {
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(displayLocale(language), {
    dateStyle: "medium", timeZone: "UTC",
  }).format(date)
}

export function PortalNextActionsPanel({ projection }: { projection: PortalNextActionsProjection }) {
  const language = useUiLanguage()
  const c = copy[language]
  const [now, setNow] = useState(projection.asOf)

  useEffect(() => {
    const nextExpiry = Math.min(...projection.yourActions
      .filter((item) => item.kind === "respond" && item.responseExpiresAt
        && Date.parse(item.responseExpiresAt) > Date.parse(now))
      .map((item) => Date.parse(item.responseExpiresAt!)))
    if (!Number.isFinite(nextExpiry)) return
    const timer = window.setTimeout(() => setNow(new Date().toISOString()),
      Math.max(1, nextExpiry - Date.now() + 25))
    return () => window.clearTimeout(timer)
  }, [projection.yourActions, now])

  const activeActions = projection.yourActions.filter((item) => item.kind !== "respond"
    || isRecommendationResponseOpen(item.responseExpiresAt, now))

  return <section aria-labelledby="portal-next-actions-heading" className="space-y-4">
    <div className="space-y-1">
      <h2 id="portal-next-actions-heading" className="text-lg font-semibold tracking-tight">{c.heading}</h2>
      <p className="text-sm text-muted-foreground">{c.description}</p>
    </div>
    {projection.state === "unavailable" ? (
      <p role="status" className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{c.unavailable}</p>
    ) : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section aria-labelledby="portal-next-actions-yours" className="min-w-0 rounded-lg border bg-card p-4">
          <h3 id="portal-next-actions-yours" className="flex items-center gap-2 font-semibold"><ListChecks className="size-4" aria-hidden="true" />{c.actions}</h3>
          {activeActions.length ? <ul className="mt-3 divide-y">
            {activeActions.map((item, index) => <li key={`${item.href}:${item.kind}:${index}`} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">{item.kind === "respond" ? c.respond : item.kind === "sign_nda" ? c.sign : c.external}</p>
              <p className="break-words text-sm">{item.explicitText ?? item.title}</p>
              {item.explicitText ? <p className="break-words text-xs text-muted-foreground">{item.title}</p> : null}
              {item.responseExpiresAt && formatResponseDeadline(item.responseExpiresAt, language)
                ? <p className="text-xs text-muted-foreground">{c.responseCloses}: {formatResponseDeadline(item.responseExpiresAt, language)}</p> : null}
              {item.dueAt && formatCivilDate(item.dueAt, language)
                ? <p className="text-xs text-muted-foreground">{c.recordedDue}: {formatCivilDate(item.dueAt, language)}</p> : null}
              <Link href={item.href} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {item.kind === "external_owner" ? c.openDossier : c.openPursuit}<ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>)}
          </ul> : <p className="mt-3 text-sm text-muted-foreground">{c.noActions}</p>}
        </section>
        <section aria-labelledby="portal-next-actions-waiting" className="min-w-0 rounded-lg border bg-card p-4">
          <h3 id="portal-next-actions-waiting" className="flex items-center gap-2 font-semibold"><Clock3 className="size-4" aria-hidden="true" />{c.waiting}</h3>
          {projection.waiting.length ? <ul className="mt-3 divide-y">
            {projection.waiting.map((item, index) => <li key={`${item.href}:${item.kind}:${index}`} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">{item.kind === "interest_validation" ? c.interest : item.kind === "nda_validation" ? c.nda : c.staff}</p>
              <p className="break-words text-sm">{item.explicitText ?? item.title}</p>
              {item.explicitText ? <p className="break-words text-xs text-muted-foreground">{item.title}</p> : null}
              <Link href={item.href} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {item.kind === "external_staff" ? c.openDossier : c.openPursuit}<ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>)}
          </ul> : <p className="mt-3 text-sm text-muted-foreground">{c.noWaiting}</p>}
        </section>
        <section aria-labelledby="portal-next-actions-resources" className="min-w-0 rounded-lg border bg-card p-4 md:col-span-2 xl:col-span-1">
          <h3 id="portal-next-actions-resources" className="flex items-center gap-2 font-semibold"><BookOpenText className="size-4" aria-hidden="true" />{c.resources}</h3>
          {projection.resources.length ? <ul className="mt-3 divide-y">
            {projection.resources.map((item, index) => <li key={`${item.href}:${item.kind}:${index}`} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">{item.kind === "nda_template" ? c.template : c.memorandum}</p>
              <p className="break-words text-sm">{item.title}</p>
              <Link href={item.href} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {c.openResource}<ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>)}
          </ul> : <p className="mt-3 text-sm text-muted-foreground">{c.noResources}</p>}
        </section>
      </div>
    )}
  </section>
}

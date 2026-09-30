"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { optOutOfMyDiscoveryDigest } from "@/lib/actions/discovery-digest"
import { useUiLanguage } from "@/components/i18n/ui-text"

export function DiscoveryDigestOptOut({ optedOut }: { optedOut: boolean }) {
  const language = useUiLanguage()
  const fr = language === "fr"
  const [saved, setSaved] = useState(optedOut)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <Card aria-labelledby="discovery-digest-title">
      <CardHeader>
        <CardTitle id="discovery-digest-title">{fr ? "Récapitulatif des nouvelles opportunités" : "New opportunity digest"}</CardTitle>
        <CardDescription>{fr
          ? "Si Re-New active cet email, il résumera uniquement les nouvelles opportunités publiques. Vous pouvez l’arrêter ici à tout moment."
          : "If Re-New activates this email, it will summarize only new public opportunities. You can stop it here at any time."}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        {saved ? <p role="status" className="text-sm">{fr
          ? "Ce récapitulatif est arrêté pour votre profil. Votre consentement général et vos autres emails ne changent pas."
          : "This digest is stopped for your profile. Your general consent and other emails are unchanged."}</p>
          : <Button type="button" variant="outline" disabled={pending} onClick={() => {
              setError(null)
              startTransition(async () => {
                try { await optOutOfMyDiscoveryDigest(); setSaved(true) }
                catch { setError(fr ? "Préférence non enregistrée. Réessayez." : "Preference was not saved. Please try again.") }
              })
            }}>{pending ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Arrêter ce récapitulatif" : "Stop this digest")}</Button>}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}

"use client"

import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { MessageSquareText } from "lucide-react"
import { submitRepreneurFeedback } from "@/lib/actions/repreneur-feedback"
import { useUiLanguage } from "@/components/i18n/ui-text"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  type FeedbackCategory,
  type FeedbackContext,
} from "@/lib/repreneur-feedback/validation"

const copy = {
  en: {
    title: "Share feedback",
    intro: "Tell Re-New what would make this space clearer or easier to use.",
    notice: "This form collects non-urgent product feedback. It is not a support chat or a promise of a reply.",
    category: "What is this about?",
    improvement: "An improvement idea",
    difficulty: "Something is difficult",
    other: "Something else",
    message: "Your feedback",
    placeholder: "Describe what happened or what would help, without adding confidential deal or document details.",
    context: "Area of the portal (optional)",
    noContext: "No area selected",
    deals: "Deals",
    profile: "Profile",
    elsewhere: "Elsewhere in the portal",
    length: "20–1,000 characters",
    send: "Send feedback",
    sending: "Saving feedback…",
    saved: "Thank you. Your feedback has been saved for the Re-New team to review.",
    back: "Back to deals",
  },
  fr: {
    title: "Partager un avis",
    intro: "Dites à Re-New ce qui rendrait cet espace plus clair ou plus simple à utiliser.",
    notice: "Ce formulaire recueille des avis non urgents sur le produit. Ce n’est pas une assistance en direct et il ne promet pas de réponse.",
    category: "De quoi s’agit-il ?",
    improvement: "Une idée d’amélioration",
    difficulty: "Une difficulté",
    other: "Autre chose",
    message: "Votre avis",
    placeholder: "Décrivez ce qui s’est passé ou ce qui vous aiderait, sans ajouter de détails confidentiels sur un dossier ou un document.",
    context: "Partie de l’espace (facultatif)",
    noContext: "Aucune partie sélectionnée",
    deals: "Opportunités",
    profile: "Profil",
    elsewhere: "Ailleurs dans l’espace",
    length: "20 à 1 000 caractères",
    send: "Envoyer l’avis",
    sending: "Enregistrement…",
    saved: "Merci. Votre avis a été enregistré pour l’équipe Re-New.",
    back: "Retour aux opportunités",
  },
} as const

const categories = ["improvement", "difficulty", "other"] as const

export function RepreneurFeedbackForm() {
  const language = useUiLanguage()
  const c = copy[language]
  const [category, setCategory] = useState<FeedbackCategory>("improvement")
  const [message, setMessage] = useState("")
  const [context, setContext] = useState<FeedbackContext | "">("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const inFlight = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const length = Array.from(message.trim()).length

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    setError("")
    if (length < 20 || length > 1000) {
      setError("Write between 20 and 1,000 characters.")
      return
    }
    inFlight.current = true
    setPending(true)
    try {
      const result = await submitRepreneurFeedback({ category, message, context: context || null })
      if (result.ok) {
        setSaved(true)
        setMessage("")
        setContext("")
        queueMicrotask(() => resultRef.current?.focus())
      } else {
        setError(result.message)
      }
    } catch {
      setError("Your feedback could not be saved. Please try again.")
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <div className="inline-flex size-10 items-center justify-center rounded-lg border bg-card text-foreground"><MessageSquareText className="size-5" aria-hidden="true" /></div>
        <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
        <p className="text-sm text-muted-foreground">{c.intro}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{c.notice}</CardTitle></CardHeader>
        <CardContent>
          {saved ? (
            <div ref={resultRef} tabIndex={-1} role="status" className="space-y-4 outline-none">
              <p>{c.saved}</p>
              <Button asChild variant="outline"><Link href="/portal/deals">{c.back}</Link></Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{c.category}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {categories.map((value) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm has-[:checked]:border-foreground has-[:checked]:bg-muted">
                      <input type="radio" name="feedback-category" value={value} checked={category === value} onChange={() => setCategory(value)} className="accent-foreground" />
                      {c[value]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="feedback-message">{c.message}</Label>
                <Textarea id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={c.placeholder} rows={7} maxLength={1100} aria-describedby="feedback-length feedback-privacy" aria-invalid={Boolean(error)} required />
                <div id="feedback-length" className="flex justify-between text-xs text-muted-foreground"><span>{c.length}</span><span>{length}/1000</span></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-context">{c.context}</Label>
                <select id="feedback-context" value={context} onChange={(event) => setContext(event.target.value as FeedbackContext | "")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">{c.noContext}</option>
                  <option value="portal_deals">{c.deals}</option>
                  <option value="portal_profile">{c.profile}</option>
                  <option value="portal_other">{c.elsewhere}</option>
                </select>
              </div>
              <p id="feedback-privacy" className="text-xs text-muted-foreground">{c.placeholder}</p>
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={pending}>{pending ? c.sending : c.send}</Button>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="rounded-md border bg-muted/30 p-3 text-sm">For urgent access or live-pursuit support, contact the usual Re-New team directly.</p>
    </div>
  )
}

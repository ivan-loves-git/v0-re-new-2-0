"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { approveMemoWithExternalNotice } from "@/lib/actions/external-memo-approval"
import type { ExternalMemoContext } from "@/lib/external-memo-approval"
import { recordExternalPursuitHandoff } from "@/lib/actions/external-pursuit-handoffs"
import type { ExternalHandoffChannel, ExternalHandoffContext } from "@/lib/external-pursuit-handoff"
import type { Language } from "@/lib/i18n/translations"
import { toast } from "sonner"

const copy = {
  en: { open: "Record as done outside WAVE", title: "Record a completed external exchange", description: "The required documents and current approvals are checked again. This records the exchange already completed and sends no email.", date: "Actual exchange date", time: "Known time (optional, Paris time)", precision: "Leave time empty when only the date is known.", channel: "Channel", reference: "Meaningful reference", referenceHint: "Describe the exchange or enter its communication reference. A communication link does not replace a required file.", email: "Email", phone: "Phone", meeting: "Meeting", other: "Other", save: "Record completed exchange", saving: "Recording…", cancel: "Cancel", success: "External exchange recorded. No email was sent.", failure: "The current documents, approvals or delivery state could not be verified. Refresh the pursuit before recording.", phase: "Handoff", language: "Dialog language" },
  fr: { open: "Enregistrer comme réalisé hors WAVE", title: "Enregistrer un échange externe terminé", description: "Les documents requis et les validations actuelles sont vérifiés à nouveau. Cet échange déjà terminé est enregistré sans envoyer d’e-mail.", date: "Date réelle de l’échange", time: "Heure connue (facultative, heure de Paris)", precision: "Laissez l’heure vide si seule la date est connue.", channel: "Canal", reference: "Référence explicite", referenceHint: "Décrivez l’échange ou indiquez sa référence. Un lien de communication ne remplace pas un fichier requis.", email: "E-mail", phone: "Téléphone", meeting: "Réunion", other: "Autre", save: "Enregistrer l’échange terminé", saving: "Enregistrement…", cancel: "Annuler", success: "Échange externe enregistré. Aucun e-mail envoyé.", failure: "Les documents, validations ou l’état de l’envoi n’ont pas pu être vérifiés. Actualisez la poursuite avant d’enregistrer.", phase: "Étape", language: "Langue du dialogue" },
} as const

const memoCopy = {
  en: { open: "Approve memo with external notice", title: "Approve memo access and record the external notice", description: "This approves this exact stored memo in WAVE and records its notice already completed outside WAVE. Current signed copies, approvals and expiry are checked again. No email is prepared or sent.", save: "Approve access and record external notice", success: "Memo access approved and external notice recorded. No email was sent." },
  fr: { open: "Approuver le mémo avec avis externe", title: "Approuver l’accès au mémo et enregistrer l’avis externe", description: "Cette opération approuve ce mémo conservé dans WAVE et enregistre son avis déjà communiqué hors WAVE. Les copies signées, validations et échéance actuelles sont vérifiées à nouveau. Aucun e-mail n’est préparé ni envoyé.", save: "Approuver l’accès et enregistrer l’avis externe", success: "Accès au mémo approuvé et avis externe enregistré. Aucun e-mail envoyé." },
} as const

export function ExternalPursuitHandoffDialog({ matchId, context, selectionToken, language, onLanguageChange, initiallyOpen = false, onClose }: { matchId: string; context: ExternalHandoffContext | ExternalMemoContext; initiallyOpen?: boolean; onClose?: () => void; selectionToken?: string; language: Language; onLanguageChange: (language: Language) => void }) {
  const memoApproval = "memo" in context
  const t = memoApproval ? { ...copy[language], ...memoCopy[language] } : copy[language]
  const router = useRouter()
  const [open, setOpen] = useState(initiallyOpen)
  const [pending, startTransition] = useTransition()
  const [operationKey, setOperationKey] = useState(() => initiallyOpen ? crypto.randomUUID() : "")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [channel, setChannel] = useState<ExternalHandoffChannel>("email")
  const [reference, setReference] = useState("")
  const [error, setError] = useState(false)
  const close = () => { setOpen(false); onClose?.() }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  return <Dialog open={open} onOpenChange={(value) => {
    if (pending) return
    if (value) { setOpen(true); setOperationKey(crypto.randomUUID()); setError(false) }
    else close()
  }}>
    {!initiallyOpen ? <DialogTrigger asChild><Button variant="outline" data-wave-action="confirm" data-wave-workflow="portal_pursuit">{t.open}</Button></DialogTrigger> : null}
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>{t.title}</DialogTitle><DialogDescription>{t.description}</DialogDescription></DialogHeader>
      <div role="group" aria-label={t.language} className="flex gap-2"><Button type="button" variant={language === "fr" ? "secondary" : "ghost"} size="sm" aria-pressed={language === "fr"} onClick={() => onLanguageChange("fr")}>Français</Button><Button type="button" variant={language === "en" ? "secondary" : "ghost"} size="sm" aria-pressed={language === "en"} onClick={() => onLanguageChange("en")}>English</Button></div>
      <p className="text-sm text-muted-foreground">{t.phase} {memoApproval ? "E8" : context.handoff_type.toUpperCase()}</p>
      {!memoApproval && context.handoff_type === "e4" && context.ldc ? <div className="min-w-0 space-y-1 rounded-md border p-3 text-sm" data-external-ldc-version>
        <p className="font-medium">{language === "fr" ? "Fiche de cadrage · PDF" : "Fiche de cadrage · PDF"}</p>
        <p className="break-words">{context.ldc.file_name}</p>
        <p className="text-muted-foreground">{language === "fr" ? "Version du" : "Version from"} {new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(context.ldc.source_updated_at))}</p>
        <p>{language === "fr" ? "Cette attestation conserve exactement cette version de votre Lettre de cadrage." : "This attestation retains exactly this version of the Lettre de cadrage."}</p>
      </div> : null}
      <form onSubmit={(event) => {
        event.preventDefault()
        setError(false)
        startTransition(async () => {
          try {
            const evidence = { matchId, operationKey, exchangeDate: date, exchangeTime: time || null, channel, reference, selectionToken }
            const result = "memo" in context ? await approveMemoWithExternalNotice({ ...evidence, context }) : await recordExternalPursuitHandoff({ ...evidence, context })
            if (!result.success) { setError(true); return }
            toast.success(t.success)
            close()
            router.refresh()
          } catch { setError(true) }
        })
      }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="external-handoff-date">{t.date}</Label><Input id="external-handoff-date" type="date" required max={today} value={date} onChange={(event) => setDate(event.target.value)} disabled={pending} /></div><div className="space-y-2"><Label htmlFor="external-handoff-time">{t.time}</Label><Input id="external-handoff-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} aria-describedby="external-time-precision" disabled={pending} /></div></div>
        <p id="external-time-precision" className="text-xs text-muted-foreground">{t.precision}</p>
        <div className="space-y-2"><Label htmlFor="external-handoff-channel">{t.channel}</Label><select id="external-handoff-channel" className="border-input flex h-9 w-full rounded-md border bg-card px-3 text-sm" value={channel} onChange={(event) => setChannel(event.target.value as ExternalHandoffChannel)} disabled={pending}>{(["email", "phone", "meeting", "other"] as const).map((value) => <option value={value} key={value}>{t[value]}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="external-handoff-reference">{t.reference}</Label><Input id="external-handoff-reference" required minLength={5} maxLength={500} value={reference} onChange={(event) => setReference(event.target.value)} aria-describedby="external-reference-hint" disabled={pending} /><p id="external-reference-hint" className="text-xs text-muted-foreground">{t.referenceHint}</p></div>
        {error ? <p role="alert" className="text-sm text-destructive">{t.failure}</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={close}>{t.cancel}</Button><Button type="submit" className={memoApproval ? "h-auto min-h-9 whitespace-normal" : undefined} disabled={pending || !date || reference.trim().length < 5} data-wave-action="confirm" data-wave-workflow="portal_pursuit">{pending ? t.saving : t.save}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MailCheck } from "lucide-react"
import { toast } from "sonner"
import { recordBookingRequestSent, type BookingRequestEvent } from "@/lib/actions/booking-request-reminders"
import { bookingReminderDueOn } from "@/lib/booking-request-reminder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function nowForInput() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export function OutlookBookingRequestControl({ repreneurId, latest }: { repreneurId: string; latest: BookingRequestEvent | null }) {
  const router = useRouter()
  const key = useRef<string | null>(null)
  const [sentAt, setSentAt] = useState(nowForInput)
  const [saving, setSaving] = useState(false)
  const dueOn = latest ? bookingReminderDueOn(latest.sent_at) : null
  async function record() {
    setSaving(true)
    try {
      key.current ??= crypto.randomUUID()
      await recordBookingRequestSent({ repreneurId, sentAt: new Date(sentAt).toISOString(), idempotencyKey: key.current })
      key.current = null
      toast.success("Invitation Outlook enregistrée")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer l'invitation Outlook.")
    } finally { setSaving(false) }
  }
  return <div className="rounded-md border bg-muted/30 p-3 space-y-2">
    <p className="text-sm font-medium">Invitation Outlook envoyée</p>
    <p className="text-xs text-muted-foreground">Enregistre uniquement l&apos;envoi manuel confirmé. Aucun email Outlook n&apos;est envoyé depuis WAVE.</p>
    <div className="flex flex-wrap gap-2">
      <Input aria-label="Date et heure d'envoi Outlook" className="max-w-64" type="datetime-local" value={sentAt} max={nowForInput()} onChange={(event) => { key.current = null; setSentAt(event.target.value) }} />
      <Button size="sm" onClick={record} disabled={saving || !sentAt}><MailCheck className="size-4" data-icon="inline-start" />{saving ? "Enregistrement…" : "Enregistrer l'invitation"}</Button>
    </div>
    {latest && <p className="text-xs text-muted-foreground">Dernier envoi enregistré : {new Date(latest.sent_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}. Rappel éligible à partir du {dueOn}, heure de Paris (5 jours ouvrés, hors week-ends), uniquement si les autres conditions d&apos;envoi sont remplies.</p>}
  </div>
}

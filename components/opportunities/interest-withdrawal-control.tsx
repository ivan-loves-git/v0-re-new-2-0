"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { InterestWithdrawalResult } from "@/lib/actions/interest-withdrawal"
import { useUiLanguage } from "@/components/i18n/ui-text"
import { publicDealOutcome } from "@/lib/i18n/deal-outcomes"
import { uiCopy } from "@/lib/i18n/ui-copy"
import type { Language } from "@/lib/i18n/translations"

export function InterestWithdrawalControl({ staff, onConfirm }: {
  staff?: boolean
  onConfirm: (reason: string) => Promise<InterestWithdrawalResult>
}) {
  const customerLanguage = useUiLanguage()
  const language: Language = staff ? "en" : customerLanguage
  const copy = (key: Parameters<typeof uiCopy>[1]) => uiCopy(language, key)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState(staff
    ? "Re-New staff is withdrawing this interest on the repreneur's behalf."
    : uiCopy(customerLanguage, "I expressed interest by mistake."))
  const [message, setMessage] = useState("")

  return <div className="space-y-2" data-wave-workflow={staff ? "staff_portal_assistance" : "portal_deals"}>
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" disabled={pending}>{copy("Withdraw interest")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent lang={language}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy("Withdraw this interest?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy("This stops the current request before Re-New validates it. It does not erase the record or recall an email already sent. A later interest needs a fresh request and staff validation.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={staff ? "staff-withdraw-reason" : "withdraw-reason"}>{copy("Reason recorded for Re-New")}</Label>
          <Textarea id={staff ? "staff-withdraw-reason" : "withdraw-reason"} maxLength={500}
            value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{copy("Keep interest")}</AlertDialogCancel>
          <AlertDialogAction disabled={pending || !reason.trim()} onClick={(event) => {
            event.preventDefault()
            startTransition(async () => {
              try {
                const result = await onConfirm(reason)
                setMessage(result.message)
                if (result.ok) { setOpen(false); router.refresh() }
              } catch {
                setMessage("The withdrawal could not be confirmed. Please refresh and try again.")
              }
            })
          }}>{copy("Confirm withdrawal")}</AlertDialogAction>
        </AlertDialogFooter>
        {message ? <p role="status" className="text-sm">{staff ? message : publicDealOutcome(message, language, "The withdrawal could not be confirmed. Please refresh and try again.")}</p> : null}
      </AlertDialogContent>
    </AlertDialog>
    {message && !open ? <p role="status" className="text-sm text-muted-foreground">{staff ? message : publicDealOutcome(message, language, "The withdrawal could not be confirmed. Please refresh and try again.")}</p> : null}
  </div>
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { InterestWithdrawalResult } from "@/lib/actions/interest-withdrawal"

export function InterestWithdrawalControl({ staff, onConfirm }: {
  staff?: boolean
  onConfirm: (reason: string) => Promise<InterestWithdrawalResult>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState(staff
    ? "The repreneur asked Re-New to withdraw this interest."
    : "I expressed interest by mistake.")
  const [message, setMessage] = useState("")

  return <div className="space-y-2" data-wave-workflow={staff ? "staff_portal_assistance" : "portal_deals"}>
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" disabled={pending}>Withdraw interest</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw this interest?</AlertDialogTitle>
          <AlertDialogDescription>
            This stops the current request before Re-New validates it. It does not erase the record or recall an email already sent. A later interest needs a fresh request and staff validation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={staff ? "staff-withdraw-reason" : "withdraw-reason"}>Reason recorded for Re-New</Label>
          <Textarea id={staff ? "staff-withdraw-reason" : "withdraw-reason"} maxLength={500}
            value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep interest</AlertDialogCancel>
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
          }}>Confirm withdrawal</AlertDialogAction>
        </AlertDialogFooter>
        {message ? <p role="status" className="text-sm">{message}</p> : null}
      </AlertDialogContent>
    </AlertDialog>
    {message && !open ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
  </div>
}

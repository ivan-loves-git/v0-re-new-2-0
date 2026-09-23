"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadPrivateDocument } from "@/lib/private-upload"

export function StaffReceivedNdaUpload({ matchId, repreneurId, repreneurName }: {
  matchId: string
  repreneurId: string
  repreneurName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)
  return <form className="space-y-3 rounded-md border p-4" onSubmit={(event) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const file = data.get("file")
    if (!(file instanceof File) || !confirmed) return
    startTransition(async () => {
      try {
        await uploadPrivateDocument(file, {
          kind: "staff_received_signed_nda", resourceId: matchId, relatedId: repreneurId,
          metadata: {
            title: String(data.get("title") ?? "Signed NDA received by staff"),
            source_kind: String(data.get("source_kind") ?? ""),
            source_reference: String(data.get("source_reference") ?? ""),
          },
        })
        toast.success("Received NDA recorded as staff evidence; staff validation is still required.")
        form.reset()
        setConfirmed(false)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The received NDA could not be recorded.")
      }
    })
  }}>
    <p className="font-medium">Record a signed NDA already received from {repreneurName}</p>
    <p className="text-xs text-muted-foreground">Use only for a copy already signed and received through another channel. This upload does not sign for the repreneur, validate the NDA, advance Gate 2 or grant confidential access.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="staff-nda-title">Document title</Label><Input id="staff-nda-title" name="title" defaultValue="Signed NDA received by Re-New" required /></div>
      <div className="space-y-2"><Label htmlFor="staff-nda-file">Signed PDF</Label><Input id="staff-nda-file" name="file" type="file" accept="application/pdf,.pdf" required /></div>
      <div className="space-y-2"><Label htmlFor="staff-nda-source">Received through</Label><select id="staff-nda-source" name="source_kind" className="h-9 w-full rounded-md border bg-background px-3 text-sm" required><option value="email">Email</option><option value="in_person">In person</option><option value="other">Other</option></select></div>
      <div className="space-y-2"><Label htmlFor="staff-nda-reference">Source reference</Label><Input id="staff-nda-reference" name="source_reference" placeholder="Message, handover or meeting reference" maxLength={500} required /></div>
    </div>
    <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />I am Re-New staff recording a copy already signed by {repreneurName}; I did not sign on their behalf.</label>
    <Button type="submit" disabled={!confirmed || pending}>{pending ? "Recording…" : "Record received PDF"}</Button>
  </form>
}

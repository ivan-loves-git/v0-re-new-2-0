"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadPrivateDocument } from "@/lib/private-upload"

export function StaffLdcAssistance({ repreneurId, repreneurName }: { repreneurId: string; repreneurName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)
  return <form className="space-y-3 rounded-md border p-3" onSubmit={(event) => {
    event.preventDefault()
    const form = event.currentTarget
    const file = new FormData(form).get("ldc")
    if (!(file instanceof File) || !confirmed) return
    startTransition(async () => {
      try {
        await uploadPrivateDocument(file, {
          kind: "repreneur_document", resourceId: repreneurId,
          metadata: { document_type: "ldc" },
        })
        toast.success(`Lettre de cadrage uploaded by staff for ${repreneurName}.`)
        form.reset()
        setConfirmed(false)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The Lettre de cadrage could not be uploaded.")
      }
    })
  }}>
    <p className="text-sm font-medium">Upload Lettre de cadrage for {repreneurName}</p>
    <p className="text-xs text-muted-foreground">This records a staff upload. It does not certify the repreneur's declaration or validate the document.</p>
    <Label htmlFor="staff-ldc-file">PDF or Word document, maximum 20 MiB</Label>
    <Input id="staff-ldc-file" name="ldc" type="file" accept="application/pdf,.pdf,.doc,.docx" required />
    <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />I am acting as Re-New staff on behalf of {repreneurName}.</label>
    <Button type="submit" disabled={!confirmed || pending}>{pending ? "Uploading…" : "Upload as staff"}</Button>
  </form>
}

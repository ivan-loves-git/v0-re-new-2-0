"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { submitPortalPursuitSignedNda } from "@/lib/actions/portal-pursuit-nda"
import { toast } from "sonner"

export function RepreneurNdaSignatureUpload({ matchId }: { matchId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  return <form action={(formData) => startTransition(async () => {
    const result = await submitPortalPursuitSignedNda(formData)
    setMessage({ tone: result.success ? "success" : "error", text: result.message })
    if (result.success) {
      toast.success(result.message)
      router.refresh()
    } else {
      toast.error(result.message)
    }
  })} className="flex flex-col gap-3 rounded-md border p-4">
    <input type="hidden" name="match_id" value={matchId} />
    <div><h3 className="font-medium">Upload your signed NDA</h3><p className="mt-1 text-sm text-muted-foreground">Upload the exact Gate 1 template as a PDF. Re-New will validate it before Gate 2.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="signed-nda-title">Document title</Label><Input id="signed-nda-title" name="title" defaultValue="NDA signed by repreneur" required /></div><div className="space-y-2"><Label htmlFor="signed-nda-file">Signed PDF</Label><Input id="signed-nda-file" name="file" type="file" accept="application/pdf,.pdf" required /></div></div>
    <p className="text-xs text-muted-foreground">PDF only, maximum 4 MB. A replacement creates a new retained version.</p>
    {message ? <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-400"}>{message.text}</p> : null}
    <Button type="submit" className="w-fit" disabled={pending}><Upload data-icon="inline-start" />{pending ? "Uploading..." : "Upload signed copy"}</Button>
  </form>
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadPrivateDocument } from "@/lib/private-upload"
import { toast } from "sonner"
import { useUiCopy, useUiLanguage } from "@/components/i18n/ui-text"
import { publicDealOutcome } from "@/lib/i18n/deal-outcomes"

export function RepreneurNdaSignatureUpload({ matchId }: { matchId: string }) {
  const language = useUiLanguage()
  const copy = useUiCopy()
  // Seed once: an interface switch must never rewrite a title the user may edit.
  const [defaultTitle] = useState(() => copy("NDA signed by repreneur"))
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  return <form onSubmit={(event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const file = formData.get("file")
    if (!(file instanceof File)) return
    startTransition(async () => {
      try {
        await uploadPrivateDocument(file, {
          kind: "portal_signed_nda",
          resourceId: matchId,
          metadata: { title: String(formData.get("title") ?? defaultTitle) },
        })
        setMessage({ tone: "success", text: "Your signed NDA has been received for staff validation." })
        toast.success(copy("Your signed NDA has been received for staff validation."))
        router.refresh()
      } catch (error) {
        const text = error instanceof Error ? error.message : null
        setMessage({ tone: "error", text: text ?? "The signed NDA could not be uploaded." })
        toast.error(publicDealOutcome(text, language, "The signed NDA could not be uploaded."))
      }
    })
  }} className="flex flex-col gap-3 rounded-md border p-4" data-wave-action="upload" data-wave-workflow="portal_pursuit">
    <input type="hidden" name="match_id" value={matchId} />
    <div><h3 className="font-medium">{copy("Upload your signed NDA")}</h3><p className="mt-1 text-sm text-muted-foreground">{copy("Upload the exact Gate 1 template as a PDF. Re-New will validate it before Gate 2.")}</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="signed-nda-title">{copy("Document title")}</Label><Input id="signed-nda-title" name="title" defaultValue={defaultTitle} required /></div><div className="space-y-2"><Label htmlFor="signed-nda-file">{copy("Signed PDF")}</Label><Input id="signed-nda-file" name="file" type="file" accept="application/pdf,.pdf" required /></div></div>
    <p className="text-xs text-muted-foreground">{copy("PDF only, maximum 20 MiB. A replacement creates a new retained version.")}</p>
    {message ? <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-400"}>{publicDealOutcome(message.text, language, message.tone === "error" ? "The signed NDA could not be uploaded." : "Your signed NDA has been received for staff validation.")}</p> : null}
    <Button type="submit" className="w-fit" disabled={pending}><Upload data-icon="inline-start" />{copy(pending ? "Uploading..." : "Upload signed copy")}</Button>
  </form>
}

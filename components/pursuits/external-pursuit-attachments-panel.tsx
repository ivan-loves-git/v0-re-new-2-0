"use client"

import { useId, useRef, useState, useTransition } from "react"
import { Download, Paperclip, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  deleteExternalPursuitAttachment,
  uploadExternalPursuitAttachment,
} from "@/lib/actions/external-pursuit-attachments"
import { EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES, type ExternalPursuitAttachment } from "@/lib/external-pursuit-attachments"
import { toast } from "sonner"

function readableBytes(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

const uploadDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })

export function ExternalPursuitAttachmentsPanel({
  pursuitId,
  attachments: initialAttachments,
}: {
  pursuitId: string
  attachments: ExternalPursuitAttachment[]
}) {
  const generatedId = useId()
  const fileInputId = `external-pursuit-attachment-${pursuitId}-${generatedId}`
  const [attachments, setAttachments] = useState(initialAttachments)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function upload(formData: FormData) {
    startTransition(async () => {
      const result = await uploadExternalPursuitAttachment(pursuitId, formData)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      // Parent board integration refreshes the server projection. Clearing the
      // local chooser prevents an accidental duplicate submission meanwhile.
      if (fileRef.current) fileRef.current.value = ""
      window.location.reload()
    })
  }

  function remove(attachmentId: string) {
    startTransition(async () => {
      const result = await deleteExternalPursuitAttachment(pursuitId, attachmentId)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
      toast.success(result.message)
    })
  }

  return <section className="rounded-md border p-4" aria-labelledby="external-pursuit-attachments-title">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 id="external-pursuit-attachments-title" className="font-medium">Private attachments</h3>
        <p className="mt-1 text-sm text-muted-foreground">Visible to the dossier owner and Re-New staff. Files are not opportunity documents or part of any Gate.</p>
      </div>
      <Paperclip className="size-4 text-muted-foreground" aria-hidden="true" />
    </div>
    <ul className="mt-4 divide-y rounded-md border" aria-label="Attachments">
      {attachments.length ? attachments.map((attachment) => <li key={attachment.id} className="flex items-center gap-3 p-3">
        <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{attachment.original_filename}</p><p className="text-xs text-muted-foreground">{attachment.content_type} · {readableBytes(attachment.byte_size)} · Uploaded by {attachment.uploader_label.toLowerCase()} on {uploadDate.format(new Date(attachment.created_at))}</p></div>
        <Button asChild variant="ghost" size="icon" aria-label={`Download ${attachment.original_filename}`}><a href={`/api/external-pursuits/${pursuitId}/attachments/${attachment.id}`}><Download className="size-4" /></a></Button>
        <Button variant="ghost" size="icon" aria-label={`Remove ${attachment.original_filename}`} disabled={pending} onClick={() => remove(attachment.id)}><Trash2 className="size-4" /></Button>
      </li>) : <li className="p-3 text-sm text-muted-foreground">No private attachments yet.</li>}
    </ul>
    <form action={upload} className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-2"><Label htmlFor={fileInputId}>Choose a private attachment</Label><Input id={fileInputId} ref={fileRef} name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/jpeg,image/png,image/webp,image/gif" disabled={pending} /></div>
      <Button type="submit" disabled={pending}><Upload data-icon="inline-start" />{pending ? "Adding…" : "Add attachment"}</Button>
    </form>
    <p className="mt-2 text-xs text-muted-foreground">PDF, Office files, CSV and images only; maximum {EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES / 1024 / 1024} MiB. Executables, archives, HTML and SVG are not accepted.</p>
  </section>
}

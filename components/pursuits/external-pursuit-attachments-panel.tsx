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
import type { ExternalPursuitOperationLockHandler } from "@/lib/external-pursuit-operation-lock"
import { toast } from "sonner"

function readableBytes(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

const uploadDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })

export interface ExternalPursuitAttachmentsPanelProps {
  pursuitId: string
  attachments: ExternalPursuitAttachment[]
  readOnly?: boolean
  onOperationLockChange?: ExternalPursuitOperationLockHandler
  onAttachmentRemoved?: (pursuitId: string, attachmentId: string) => void
}

export function ExternalPursuitAttachmentsPanel({
  pursuitId,
  attachments: initialAttachments,
  readOnly = false,
  onOperationLockChange,
  onAttachmentRemoved,
}: ExternalPursuitAttachmentsPanelProps) {
  const generatedId = useId()
  const fileInputId = `external-pursuit-attachment-${pursuitId}-${generatedId}`
  const titleId = `external-pursuit-attachments-title-${pursuitId}-${generatedId}`
  const operationLockToken = `external-pursuit-attachments:${pursuitId}:${generatedId}`
  const [attachments, setAttachments] = useState(initialAttachments)
  const [pending, startTransition] = useTransition()
  const [recovery, setRecovery] = useState<"upload" | { attachmentId: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadAttempt = useRef<{ formData: FormData; idempotencyKey: string } | null>(null)
  const deleteAttempt = useRef<{ attachmentId: string; idempotencyKey: string } | null>(null)
  const operationLockHeld = useRef(false)
  const controlsLocked = pending || recovery !== null

  function holdOperationLock() {
    if (operationLockHeld.current) return
    operationLockHeld.current = true
    onOperationLockChange?.({ token: operationLockToken, delta: 1 })
  }

  function releaseOperationLock() {
    if (!operationLockHeld.current) return
    operationLockHeld.current = false
    onOperationLockChange?.({ token: operationLockToken, delta: -1 })
  }

  function upload(formData: FormData) {
    if (recovery && recovery !== "upload") return
    const attempt = uploadAttempt.current ?? { formData, idempotencyKey: crypto.randomUUID() }
    uploadAttempt.current = attempt
    holdOperationLock()
    startTransition(async () => {
      let result
      try {
        result = await uploadExternalPursuitAttachment(pursuitId, attempt.formData, attempt.idempotencyKey)
      } catch {
        setRecovery("upload")
        toast.error("The upload result is unclear. Retry the exact same file.")
        return
      }
      if (!result.success) {
        if (result.retryExact) {
          setRecovery("upload")
          toast.error(result.message)
          return
        }
        uploadAttempt.current = null
        setRecovery(null)
        releaseOperationLock()
        toast.error(result.message)
        return
      }
      uploadAttempt.current = null
      setRecovery(null)
      releaseOperationLock()
      toast.success(result.message)
      // Parent board integration refreshes the server projection. Clearing the
      // local chooser prevents an accidental duplicate submission meanwhile.
      if (fileRef.current) fileRef.current.value = ""
      window.location.reload()
    })
  }

  function remove(attachmentId: string) {
    if (recovery && (recovery === "upload" || recovery.attachmentId !== attachmentId)) return
    const attempt = deleteAttempt.current?.attachmentId === attachmentId
      ? deleteAttempt.current
      : { attachmentId, idempotencyKey: crypto.randomUUID() }
    deleteAttempt.current = attempt
    holdOperationLock()
    startTransition(async () => {
      let result
      try {
        result = await deleteExternalPursuitAttachment(pursuitId, attempt.attachmentId, attempt.idempotencyKey)
      } catch {
        setRecovery({ attachmentId })
        toast.error("The removal result is unclear. Retry this exact removal.")
        return
      }
      if (!result.success) {
        if (result.retryExact) {
          setRecovery({ attachmentId })
          toast.error(result.message)
          return
        }
        deleteAttempt.current = null
        setRecovery(null)
        releaseOperationLock()
        toast.error(result.message)
        return
      }
      deleteAttempt.current = null
      setRecovery(null)
      releaseOperationLock()
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
      onAttachmentRemoved?.(pursuitId, attachmentId)
      toast.success(result.message)
    })
  }

  return <section className="rounded-md border p-4" aria-labelledby={titleId}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 id={titleId} className="font-medium">Private attachments</h3>
        <p className="mt-1 text-sm text-muted-foreground">Visible to the dossier owner and Re-New staff. Files are not opportunity documents or part of any Gate.</p>
      </div>
      <Paperclip className="size-4 text-muted-foreground" aria-hidden="true" />
    </div>
    {recovery ? <p role="alert" className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
      The last file action is not confirmed. This view is locked; retry the exact {recovery === "upload" ? "upload" : "removal"} below.
    </p> : null}
    <ul className="mt-4 divide-y rounded-md border" aria-label="Attachments">
      {attachments.length ? attachments.map((attachment) => <li key={attachment.id} className="flex items-center gap-3 p-3">
        <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{attachment.original_filename}</p><p className="text-xs text-muted-foreground">{attachment.content_type} · {readableBytes(attachment.byte_size)} · Uploaded by {attachment.uploader_label.toLowerCase()} on {uploadDate.format(new Date(attachment.created_at))}</p></div>
        <Button asChild variant="ghost" size="icon" aria-label={`Download ${attachment.original_filename}`}><a href={`/api/external-pursuits/${pursuitId}/attachments/${attachment.id}`}><Download className="size-4" /></a></Button>
        {!readOnly ? <Button variant="ghost" size="icon" aria-label={`${recovery && recovery !== "upload" && recovery.attachmentId === attachment.id ? "Retry removal of" : "Remove"} ${attachment.original_filename}`} disabled={pending || Boolean(recovery && (recovery === "upload" || recovery.attachmentId !== attachment.id))} onClick={() => remove(attachment.id)}><Trash2 className="size-4" /></Button> : null}
      </li>) : <li className="p-3 text-sm text-muted-foreground">No private attachments yet.</li>}
    </ul>
    {!readOnly ? <form action={upload} className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-2"><Label htmlFor={fileInputId}>Choose a private attachment</Label><Input id={fileInputId} ref={fileRef} name="file" type="file" required accept=".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/jpeg,image/png,image/webp,image/gif" disabled={controlsLocked} /></div>
      <Button type="submit" disabled={pending || Boolean(recovery && recovery !== "upload")}><Upload data-icon="inline-start" />{pending ? "Adding…" : recovery === "upload" ? "Retry exact upload" : "Add attachment"}</Button>
    </form> : <p className="mt-4 text-sm text-muted-foreground">Deletion is pending. Files are available for staff review but cannot be changed.</p>}
    <p className="mt-2 text-xs text-muted-foreground">PDF, DOCX, XLSX, CSV and images only; maximum {EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES / 1024 / 1024} MiB. Legacy Office files, executables, archives, HTML and SVG are not accepted.</p>
  </section>
}

"use client"

import { useId, useRef, useState, useTransition } from "react"
import { Download, Paperclip, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  deleteExternalPursuitAttachment,
} from "@/lib/actions/external-pursuit-attachments"
import { uploadPrivateDocument } from "@/lib/private-upload"
import { deleteSelectedExternalPursuitAttachment } from "@/lib/actions/staff-portal-external"
import { EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES, type ExternalPursuitAttachment } from "@/lib/external-pursuit-attachments"
import type { ExternalPursuitOperationLockHandler } from "@/lib/external-pursuit-operation-lock"
import { toast } from "sonner"
import { captureExternalPursuitCompleted } from "@/lib/telemetry/external-pursuit-client"
import { formatDisplayDate } from "@/lib/utils/display-date-time"
import { useUiLanguage } from "@/components/i18n/ui-text"
import { uiCopy, uiCopyWith, type UiCopyKey } from "@/lib/i18n/ui-copy"
import { displayLocale } from "@/lib/i18n/ui-language"
import { publicPursuitOutcome } from "@/lib/i18n/pursuit-outcomes"
import type { Language } from "@/lib/i18n/translations"

function readableBytes(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

export interface ExternalPursuitAttachmentsPanelProps {
  pursuitId: string
  role: "staff" | "repreneur"
  attachments: ExternalPursuitAttachment[]
  readOnly?: boolean
  onOperationLockChange?: ExternalPursuitOperationLockHandler
  onAttachmentRemoved?: (pursuitId: string, attachmentId: string) => void
  staffPortalSelection?: { ownerId: string; token: string }
}

export function ExternalPursuitAttachmentsPanel({
  pursuitId,
  role,
  attachments: initialAttachments,
  readOnly = false,
  onOperationLockChange,
  onAttachmentRemoved,
  staffPortalSelection,
}: ExternalPursuitAttachmentsPanelProps) {
  const customerLanguage = useUiLanguage()
  const language: Language = role === "staff" ? "en" : customerLanguage
  const copy = (key: UiCopyKey, values?: Record<string, string | number>) =>
    values ? uiCopyWith(language, key, values) : uiCopy(language, key)
  const outcome = (message: unknown, fallback: UiCopyKey) =>
    role === "staff" && typeof message === "string" ? message : publicPursuitOutcome(message, language, fallback)
  const generatedId = useId()
  const fileInputId = `external-pursuit-attachment-${pursuitId}-${generatedId}`
  const titleId = `external-pursuit-attachments-title-${pursuitId}-${generatedId}`
  const operationLockToken = `external-pursuit-attachments:${pursuitId}:${generatedId}`
  const [attachments, setAttachments] = useState(initialAttachments)
  const [pending, startTransition] = useTransition()
  const [recovery, setRecovery] = useState<{ attachmentId: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
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
    if (recovery) return
    const file = formData.get("file")
    if (!(file instanceof File)) return
    holdOperationLock()
    startTransition(async () => {
      try {
        await uploadPrivateDocument(file, {
          kind: "external_pursuit_attachment",
          resourceId: pursuitId,
          metadata: staffPortalSelection ? {
            selected_owner_id: staffPortalSelection.ownerId,
            staff_portal_selection_token: staffPortalSelection.token,
          } : {},
        })
        releaseOperationLock()
        captureExternalPursuitCompleted(role, "upload")
        toast.success(copy("Attachment added."))
        if (fileRef.current) fileRef.current.value = ""
        window.location.reload()
      } catch (error) {
        releaseOperationLock()
        toast.error(outcome(error instanceof Error ? error.message : null, "Could not add attachment."))
        return
      }
    })
  }

  function remove(attachmentId: string) {
    if (recovery && recovery.attachmentId !== attachmentId) return
    const attempt = deleteAttempt.current?.attachmentId === attachmentId
      ? deleteAttempt.current
      : { attachmentId, idempotencyKey: crypto.randomUUID() }
    deleteAttempt.current = attempt
    holdOperationLock()
    startTransition(async () => {
      let result
      try {
        result = staffPortalSelection
          ? await deleteSelectedExternalPursuitAttachment(staffPortalSelection.ownerId, staffPortalSelection.token,
              pursuitId, attempt.attachmentId, attempt.idempotencyKey)
          : await deleteExternalPursuitAttachment(pursuitId, attempt.attachmentId, attempt.idempotencyKey)
      } catch {
        setRecovery({ attachmentId })
        toast.error(copy("The removal result is unclear. Retry this exact removal."))
        return
      }
      if (!result.success) {
        if (result.retryExact) {
          setRecovery({ attachmentId })
          toast.error(outcome(result.message, "The removal result is unclear. Retry this exact removal."))
          return
        }
        deleteAttempt.current = null
        setRecovery(null)
        releaseOperationLock()
        toast.error(outcome(result.message, "Could not remove attachment."))
        return
      }
      deleteAttempt.current = null
      setRecovery(null)
      releaseOperationLock()
      captureExternalPursuitCompleted(role, "delete")
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
      onAttachmentRemoved?.(pursuitId, attachmentId)
      toast.success(outcome(result.message, "Attachment removed."))
    })
  }

  return <section className="rounded-md border p-4" aria-labelledby={titleId}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 id={titleId} className="font-medium">{copy("Private attachments")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{copy("Visible to the dossier owner and Re-New staff. Files are not opportunity documents or part of any Gate.")}</p>
      </div>
      <Paperclip className="size-4 text-muted-foreground" aria-hidden="true" />
    </div>
    {recovery ? <p role="alert" className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
      {copy("The last removal is not confirmed. This view is locked; retry the exact removal below.")}
    </p> : null}
    <ul className="mt-4 divide-y rounded-md border" aria-label={copy("Attachments")}>
      {attachments.length ? attachments.map((attachment) => <li key={attachment.id} className="flex items-center gap-3 p-3">
        <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{attachment.original_filename}</p><p className="text-xs text-muted-foreground">{attachment.content_type} · {readableBytes(attachment.byte_size)} · {copy("Uploaded by {uploader} on {date}", { uploader: copy(attachment.uploader_label), date: formatDisplayDate(attachment.created_at, displayLocale(language)) })}</p></div>
        <Button asChild variant="ghost" size="icon" aria-label={copy("Download {name}", { name: attachment.original_filename })}><a href={`/api/external-pursuits/${pursuitId}/attachments/${attachment.id}`}><Download className="size-4" /></a></Button>
        {!readOnly ? <Button variant="ghost" size="icon" aria-label={copy(recovery?.attachmentId === attachment.id ? "Retry removal of {name}" : "Remove {name}", { name: attachment.original_filename })} disabled={pending || Boolean(recovery && recovery.attachmentId !== attachment.id)} onClick={() => remove(attachment.id)}><Trash2 className="size-4" /></Button> : null}
      </li>) : <li className="p-3 text-sm text-muted-foreground">{copy("No private attachments yet.")}</li>}
    </ul>
    {!readOnly ? <form action={upload} className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-2"><Label htmlFor={fileInputId}>{copy("Choose a private attachment")}</Label><Input id={fileInputId} ref={fileRef} name="file" type="file" required accept=".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/jpeg,image/png,image/webp,image/gif" disabled={controlsLocked} /></div>
      <Button type="submit" disabled={pending || Boolean(recovery)}><Upload data-icon="inline-start" />{copy(pending ? "Adding…" : "Add attachment")}</Button>
    </form> : <p className="mt-4 text-sm text-muted-foreground">{copy("Files are available for review here; changes are not available in this view.")}</p>}
    <p className="mt-2 text-xs text-muted-foreground">{copy("PDF, DOCX, XLSX, CSV and images only; maximum {size} MiB. Legacy Office files, executables, archives, HTML and SVG are not accepted.", { size: EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES / 1024 / 1024 })}</p>
  </section>
}

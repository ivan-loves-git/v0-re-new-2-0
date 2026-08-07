"use client"

import { Download, MoreHorizontal, Replace, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { OpportunityDocumentPolicy } from "@/lib/opportunity-document-policy"

export type DocumentInteractionState = "available" | "locked" | "failed" | "pending"

interface DocumentRowActionsProps {
  policy: OpportunityDocumentPolicy
  state: DocumentInteractionState
  viewHref?: string
  onUpload?: () => void
  onReplace?: () => void
  onMarkStaffOnly?: () => void
  onMarkApproved?: () => void
  onRemove?: () => void
}

/**
 * Shared action vocabulary for private document rows. It deliberately keeps
 * storage semantics outside the component, so CV/LdC can adopt it later
 * without changing their existing routes or retention policy.
 */
export function DocumentRowActions({
  policy,
  state,
  viewHref,
  onUpload,
  onReplace,
  onMarkStaffOnly,
  onMarkApproved,
  onRemove,
}: DocumentRowActionsProps) {
  if (state === "failed") return <span className="text-xs text-destructive">Action failed</span>
  if (state === "pending") return <span className="text-xs text-muted-foreground">Saving…</span>

  const hasMutations = Boolean(
    (policy.canUpload && onUpload) ||
      (policy.canReplace && onReplace) ||
      (policy.canChangeVisibility && (onMarkStaffOnly || onMarkApproved)) ||
      (policy.canRemove && onRemove),
  )

  return (
    <div className="flex items-center justify-end gap-1">
      {policy.canView && viewHref && (
        <Button asChild variant="ghost" size="sm" className="h-8">
          <a href={viewHref} target="_blank" rel="noreferrer">
            <Download className="size-4" />
            {policy.canDownload ? "View or download" : "View"}
          </a>
        </Button>
      )}
      {state === "locked" && <span className="text-xs text-muted-foreground">Locked</span>}
      {hasMutations && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Document actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {policy.canUpload && onUpload && (
              <DropdownMenuItem onClick={onUpload}>
                <Upload className="size-4" />
                Upload
              </DropdownMenuItem>
            )}
            {policy.canReplace && onReplace && (
              <DropdownMenuItem onClick={onReplace}>
                <Replace className="size-4" />
                Replace
              </DropdownMenuItem>
            )}
            {policy.canChangeVisibility && onMarkStaffOnly && (
              <DropdownMenuItem onClick={onMarkStaffOnly}>Mark staff-only</DropdownMenuItem>
            )}
            {policy.canChangeVisibility && onMarkApproved && (
              <DropdownMenuItem onClick={onMarkApproved}>Mark approved</DropdownMenuItem>
            )}
            {policy.canRemove && onRemove && (
              <DropdownMenuItem onClick={onRemove}>
                <Trash2 className="size-4" />
                Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

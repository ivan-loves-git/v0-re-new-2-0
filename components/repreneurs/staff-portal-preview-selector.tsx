"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { StaffRepreneurCombobox } from "@/components/repreneurs/staff-repreneur-combobox"
import type { StaffPortalPreviewOption } from "@/lib/actions/repreneur-portal-preview"
import { createPortalPreviewSelectionHref } from "@/lib/portal-preview-routes"
import { selectStaffPortalWorkspace } from "@/lib/actions/staff-portal-workspace"

interface StaffPortalPreviewSelectorProps {
  options: StaffPortalPreviewOption[]
  selectedRepreneurId: string | null
  workspaceId: string | null
  selectionToken: string | null
}

export function StaffPortalPreviewSelector({
  options,
  selectedRepreneurId,
  workspaceId,
  selectionToken,
}: StaffPortalPreviewSelectorProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!selectedRepreneurId || workspaceId) return
    let cancelled = false
    startTransition(async () => {
      try {
        const selected = await selectStaffPortalWorkspace(selectedRepreneurId, null)
        if (cancelled) return
        const url = new URL(window.location.href)
        url.searchParams.set("workspaceId", selected.workspaceId)
        router.replace(`${url.pathname}${url.search}`)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not open the selected staff workspace.")
      }
    })
    return () => { cancelled = true }
  }, [selectedRepreneurId, workspaceId, router])

  function handleValueChange(repreneurId: string) {
    startTransition(async () => {
      try {
        const selected = await selectStaffPortalWorkspace(repreneurId, selectionToken)
        router.push(createPortalPreviewSelectionHref(repreneurId, selected.workspaceId))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not change the selected repreneur.")
      }
    })
  }

  return (
    <StaffRepreneurCombobox
      options={options}
      value={selectedRepreneurId}
      onValueChange={handleValueChange}
      placeholder={options.length === 0 ? "No repreneurs available" : "Select a repreneur"}
      disabled={options.length === 0 || pending || (Boolean(selectedRepreneurId) && !workspaceId)}
      className="min-w-0 md:w-[420px]"
    />
  )
}

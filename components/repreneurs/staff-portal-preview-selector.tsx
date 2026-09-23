"use client"

import { useRouter } from "next/navigation"
import { StaffRepreneurCombobox } from "@/components/repreneurs/staff-repreneur-combobox"
import type { StaffPortalPreviewOption } from "@/lib/actions/repreneur-portal-preview"
import { createPortalPreviewSelectionHref } from "@/lib/portal-preview-routes"

interface StaffPortalPreviewSelectorProps {
  options: StaffPortalPreviewOption[]
  selectedRepreneurId: string | null
}

export function StaffPortalPreviewSelector({
  options,
  selectedRepreneurId,
}: StaffPortalPreviewSelectorProps) {
  const router = useRouter()

  function handleValueChange(repreneurId: string) {
    router.push(createPortalPreviewSelectionHref(repreneurId))
  }

  return (
    <StaffRepreneurCombobox
      options={options}
      value={selectedRepreneurId}
      onValueChange={handleValueChange}
      placeholder={options.length === 0 ? "No repreneurs available" : "Select a repreneur"}
      disabled={options.length === 0}
      className="min-w-0 md:w-[420px]"
    />
  )
}

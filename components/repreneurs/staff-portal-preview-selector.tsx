"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { StaffRepreneurCombobox } from "@/components/repreneurs/staff-repreneur-combobox"
import type { StaffPortalPreviewOption } from "@/lib/actions/repreneur-portal-preview"

interface StaffPortalPreviewSelectorProps {
  options: StaffPortalPreviewOption[]
  selectedRepreneurId: string | null
}

export function StaffPortalPreviewSelector({
  options,
  selectedRepreneurId,
}: StaffPortalPreviewSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleValueChange(repreneurId: string) {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set("repreneurId", repreneurId)
    nextParams.delete("matchId")
    router.push(`/portal-preview?${nextParams.toString()}`)
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

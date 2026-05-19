"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { StaffPortalPreviewOption } from "@/lib/actions/repreneur-portal-preview"

interface StaffPortalPreviewSelectorProps {
  options: StaffPortalPreviewOption[]
  selectedRepreneurId: string | null
}

function optionLabel(option: StaffPortalPreviewOption) {
  const name = option.name || "Unnamed repreneur"
  return option.email ? `${name} - ${option.email}` : name
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
    <Select value={selectedRepreneurId ?? undefined} onValueChange={handleValueChange} disabled={options.length === 0}>
      <SelectTrigger className="w-full min-w-0 md:w-[420px]">
        <SelectValue placeholder="Select a repreneur" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {optionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

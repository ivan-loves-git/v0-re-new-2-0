"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  REPRENEUR_DEAL_SORT_OPTIONS,
  type RepreneurDealSort,
} from "@/lib/utils/repreneur-deal-flow"
import { useUiCopy } from "@/components/i18n/ui-text"

interface RepreneurDealSortSelectorProps {
  value: RepreneurDealSort
}

export function RepreneurDealSortSelector({ value }: RepreneurDealSortSelectorProps) {
  const u = useUiCopy()
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleValueChange(sort: RepreneurDealSort) {
    const params = new URLSearchParams(searchParams.toString())
    if (sort === "relevance") {
      params.delete("sort")
    } else {
      params.set("sort", sort)
    }

    const query = params.toString()
    router.replace(`/portal/deals${query ? `?${query}` : ""}`, { scroll: false })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{u("Sort by")}</span>
      <Select value={value} onValueChange={(nextValue) => handleValueChange(nextValue as RepreneurDealSort)}>
        <SelectTrigger aria-label={u("Sort deal flow")} size="sm" className="min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPRENEUR_DEAL_SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {u(option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

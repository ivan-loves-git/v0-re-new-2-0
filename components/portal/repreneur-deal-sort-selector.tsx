"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  REPRENEUR_DEAL_SORT_OPTIONS,
  type RepreneurDealSort,
} from "@/lib/utils/repreneur-deal-flow"
import { useUiCopy, useUiLanguage } from "@/components/i18n/ui-text"

interface RepreneurDealSortSelectorProps {
  value: RepreneurDealSort
}

export function RepreneurDealSortSelector({ value }: RepreneurDealSortSelectorProps) {
  const u = useUiCopy()
  const language = useUiLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const searchParams = useSearchParams()

  function handleValueChange(sort: RepreneurDealSort) {
    const params = new URLSearchParams(searchParams.toString())
    if (sort === "relevance") {
      params.delete("sort")
    } else {
      params.set("sort", sort)
    }

    const query = params.toString()
    startTransition(() => router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false }))
  }

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <span className="text-sm text-muted-foreground">{u("Sort by")}</span>
      {pending ? <span role="status" className="text-xs text-muted-foreground">{u("Loading…")}</span> : null}
      <Select value={value} onValueChange={(nextValue) => handleValueChange(nextValue as RepreneurDealSort)}>
        <SelectTrigger aria-label={u("Sort deal flow")} size="sm" className="min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent lang={language}>
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

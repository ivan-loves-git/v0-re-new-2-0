"use client"

import type { ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs } from "@/components/ui/tabs"

interface RepreneurDetailTabsProps {
  defaultValue: string
  validTabs: string[]
  children: ReactNode
}

const TAB_ALIASES: Record<string, string> = {
  questionnaire: "qualification",
}

export function RepreneurDetailTabs({ defaultValue, validTabs, children }: RepreneurDetailTabsProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab")
  const normalizedTab = currentTab ? TAB_ALIASES[currentTab] ?? currentTab : null
  const value = normalizedTab && validTabs.includes(normalizedTab) ? normalizedTab : defaultValue

  function handleValueChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextValue === "overview") {
      params.delete("tab")
    } else {
      params.set("tab", nextValue)
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <Tabs value={value} onValueChange={handleValueChange} className="space-y-4">
      {children}
    </Tabs>
  )
}

"use client"

import { Loader2 } from "lucide-react"
import { useUiCopy } from "@/components/i18n/ui-text"

export function PortalLoading() {
  const copy = useUiCopy()
  return <div role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
    <Loader2 className="size-4 animate-spin" aria-hidden="true" />{copy("Loading…")}
  </div>
}

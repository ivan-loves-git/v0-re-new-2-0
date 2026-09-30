"use client"

import Link, { useLinkStatus } from "next/link"
import { useState, type ComponentProps } from "react"
import { Loader2 } from "lucide-react"
import { useUiCopy } from "@/components/i18n/ui-text"

function NavigationFeedback() {
  const { pending } = useLinkStatus()
  const copy = useUiCopy()
  return pending ? <span role="status" className="inline-flex items-center gap-1 text-xs">
    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
    <span className="sr-only">{copy("Loading…")}</span>
  </span> : null
}

/** Prefetch only after navigation intent, with immediate feedback while it resolves. */
export function PortalNavigationLink({ children, onMouseEnter, onFocus, prefetch, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false)
  return <Link {...props} prefetch={prefetch === false ? false : intent ? null : false}
    onMouseEnter={(event) => { setIntent(true); onMouseEnter?.(event) }}
    onFocus={(event) => { setIntent(true); onFocus?.(event) }}>
    {children}<NavigationFeedback />
  </Link>
}

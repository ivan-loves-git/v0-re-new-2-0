"use client"

import type { ComponentProps, ReactNode } from "react"
import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import { useUiCopy } from "@/components/i18n/ui-text"

/** Customer profile composition; account preferences remain personal to the customer. */
export function PortalProfileContent({ accountPreferences, ...profile }: ComponentProps<typeof RepreneurProfileSummary> & { accountPreferences?: ReactNode }) {
  const copy = useUiCopy()
  return <div className="flex flex-col gap-6">
    <RepreneurProfileSummary {...profile} />
    {profile.repreneur && (profile.mode === "staff-preview"
      ? <p className="text-sm text-muted-foreground">{copy("Account preferences and feedback can only be submitted by the repreneur in their own portal.")}</p>
      : accountPreferences)}
  </div>
}

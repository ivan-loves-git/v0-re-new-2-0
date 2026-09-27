"use client"

import type { ReactNode } from "react"
import { LanguageProvider } from "@/lib/i18n/language-context"
import type { Language } from "@/lib/i18n/translations"
import { LanguageToggle } from "@/components/intake-v2/language-toggle"

/** Preview language is a staff-browser display choice, never an owner preference. */
export function PreviewLanguageScope({ initialLanguage, children }: {
  initialLanguage: Language
  children: ReactNode
}) {
  return <LanguageProvider scope="preview" initialLanguage={initialLanguage}>
    <div className="flex flex-col items-end gap-1">
      <p className="text-xs font-medium">Customer-content preview language</p>
      <LanguageToggle />
      <p className="text-xs text-muted-foreground">Preview only. This does not change the repreneur&apos;s account preference.</p>
    </div>
    {children}
  </LanguageProvider>
}

/** Attributed assistance remains English even inside a French customer preview. */
export function StaffEnglishBoundary({ children }: { children: ReactNode }) {
  return <LanguageProvider scope="preview" initialLanguage="en">{children}</LanguageProvider>
}

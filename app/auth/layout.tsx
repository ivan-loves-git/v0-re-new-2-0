import type { ReactNode } from "react"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { anonymousUiLanguage } from "@/lib/i18n/server-language"

// Initial text follows the browser cookie, so this segment renders per request.
export const instant = false

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return <LanguageProvider initialLanguage={await anonymousUiLanguage()}>{children}</LanguageProvider>
}

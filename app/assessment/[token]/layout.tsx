import { LanguageProvider } from '@/lib/i18n/language-context'
import { anonymousUiLanguage } from '@/lib/i18n/server-language'

export default async function AssessmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider initialLanguage={await anonymousUiLanguage()}>
      {children}
    </LanguageProvider>
  )
}

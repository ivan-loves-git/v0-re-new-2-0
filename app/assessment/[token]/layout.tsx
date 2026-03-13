import { LanguageProvider } from '@/lib/i18n/language-context'

export default function AssessmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider>
      {children}
    </LanguageProvider>
  )
}

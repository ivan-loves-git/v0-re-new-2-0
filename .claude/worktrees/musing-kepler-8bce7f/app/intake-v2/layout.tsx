import { LanguageProvider } from '@/lib/i18n/language-context'

export default function IntakeV2Layout({
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

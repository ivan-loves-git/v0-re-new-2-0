'use client'

import { IntakeFormV2 } from '@/components/intake-v2'
import { LanguageToggle } from '@/components/intake-v2/language-toggle'
import { useLanguage } from '@/lib/i18n/language-context'

/**
 * Client component for the welcome/intake form
 * Wrapped in LanguageProvider by the layout
 */
export default function WelcomeClient() {
  const { t } = useLanguage()

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      {/* Header with Language Toggle */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex justify-end mb-4">
          <LanguageToggle />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {t('formTitle')}
          </h1>
          <p className="text-muted-foreground">
            {t('step1Description')}
          </p>
        </div>
      </div>

      {/* Form */}
      <IntakeFormV2 />
    </main>
  )
}

'use client'

import { IntakeFormV2 } from '@/components/intake-v2'
import { LanguageToggle } from '@/components/intake-v2/language-toggle'
import { useLanguage } from '@/lib/i18n/language-context'
import { Waves } from 'lucide-react'

/**
 * Client component for the welcome/intake form
 * Wrapped in LanguageProvider by the layout
 */
export default function WelcomeClient() {
  const { t } = useLanguage()

  return (
    <main id="main-content" className="min-h-svh bg-background px-4 py-6 md:py-10">
      <div className="mx-auto mb-8 max-w-2xl border-b pb-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-lg bg-[#081020] text-[#7dd3c7]"><Waves className="size-[18px]" /></span><span className="text-xs font-semibold tracking-[0.12em]">WAVE</span></div>
          <LanguageToggle />
        </div>
        <div className="text-center">
          <h1 className="mb-2 text-[28px] font-semibold tracking-[-0.03em]">
            {t('formTitle')}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {t('step1Description')}
          </p>
        </div>
      </div>

      {/* Form */}
      <IntakeFormV2 />
    </main>
  )
}

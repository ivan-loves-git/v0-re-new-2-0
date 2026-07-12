'use client'

import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils'

/**
 * Language toggle with flag icons
 * Switches between French and English
 */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted p-1" role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => setLanguage('fr')}
        className={cn(
          'flex h-7 min-w-8 items-center justify-center rounded border border-transparent px-2 text-[11px] font-semibold transition-colors',
          language === 'fr'
            ? 'border-border bg-card text-foreground'
            : 'opacity-50 hover:opacity-75'
        )}
        title="Français"
        aria-label="Français"
        aria-pressed={language === 'fr'}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={cn(
          'flex h-7 min-w-8 items-center justify-center rounded border border-transparent px-2 text-[11px] font-semibold transition-colors',
          language === 'en'
            ? 'border-border bg-card text-foreground'
            : 'opacity-50 hover:opacity-75'
        )}
        title="English"
        aria-label="English"
        aria-pressed={language === 'en'}
      >
        EN
      </button>
    </div>
  )
}

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
    <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
      <button
        onClick={() => setLanguage('fr')}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full transition-all text-lg',
          language === 'fr'
            ? 'bg-white shadow-sm scale-110'
            : 'opacity-50 hover:opacity-75'
        )}
        title="Français"
        aria-label="Français"
      >
        🇫🇷
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full transition-all text-lg',
          language === 'en'
            ? 'bg-white shadow-sm scale-110'
            : 'opacity-50 hover:opacity-75'
        )}
        title="English"
        aria-label="English"
      >
        🇬🇧
      </button>
    </div>
  )
}

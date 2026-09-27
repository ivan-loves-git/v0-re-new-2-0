'use client'

import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils'

/**
 * Language toggle with flag icons
 * Switches between French and English
 */
export function LanguageToggle({ chromeLanguage }: { chromeLanguage?: 'fr' | 'en' } = {}) {
  const { language, setLanguage, saving, saveError } = useLanguage()
  const copyLanguage = chromeLanguage ?? language

  return (
    <div className="flex flex-col items-end gap-1">
    <div className="flex items-center gap-1 rounded-md border bg-muted p-1" role="group" aria-label={copyLanguage === 'fr' ? 'Langue de l’interface' : 'Interface language'}>
      <button
        type="button"
        onClick={() => void setLanguage('fr')}
        disabled={saving}
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
        onClick={() => void setLanguage('en')}
        disabled={saving}
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
    {saveError ? <p className="text-xs text-destructive" role="alert">{copyLanguage === 'fr' ? 'Impossible d’enregistrer la langue. Réessayez.' : 'Could not save your language. Please try again.'}</p> : null}
    </div>
  )
}

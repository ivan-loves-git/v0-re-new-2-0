'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { saveMyUiLanguage } from '@/lib/actions/repreneur-ui-language'
import { GlobalSkipLink } from '@/components/i18n/global-skip-link'
import { type Language, t, type TranslationKey } from './translations'
import {
  PREVIEW_LANGUAGE_COOKIE,
  UI_LANGUAGE_COOKIE,
  UI_LANGUAGE_STORAGE,
  parseUiLanguage,
} from './ui-language'

type LanguageScope = 'anonymous' | 'account' | 'preview'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<boolean>
  saving: boolean
  saveError: boolean
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextType | null>(null)

function writeCookie(key: string, language: Language) {
  document.cookie = `${key}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

function writeBrowserLanguage(language: Language) {
  writeCookie(UI_LANGUAGE_COOKIE, language)
  try { localStorage.setItem(UI_LANGUAGE_STORAGE, language) } catch { /* Cookies still provide continuity. */ }
}

export function LanguageProvider({
  children,
  initialLanguage = 'fr',
  accountLanguage = null,
  scope = 'anonymous',
  showSkipLink = false,
}: {
  children?: ReactNode
  initialLanguage?: Language
  accountLanguage?: Language | null
  scope?: LanguageScope
  showSkipLink?: boolean
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // Honor existing renew-language storage from before the server-readable cookie.
  // A saved account value always wins, including over a stale browser value.
  useEffect(() => {
    if (scope === 'preview' || accountLanguage) return
    let active = true
    try {
      const saved = parseUiLanguage(localStorage.getItem(UI_LANGUAGE_STORAGE))
      if (saved) {
        queueMicrotask(() => { if (active) setLanguageState(saved) })
        writeCookie(UI_LANGUAGE_COOKIE, saved)
      }
    } catch { /* Server-resolved cookie/default remains usable. */ }
    return () => { active = false }
  }, [scope, accountLanguage])

  useEffect(() => {
    if (scope === 'preview') return
    document.documentElement.lang = language
    return () => { document.documentElement.lang = 'en' }
  }, [language, scope])

  const setLanguage = async (next: Language) => {
    if (saving || !parseUiLanguage(next)) return false
    setSaveError(false)
    if (scope === 'account') {
      setSaving(true)
      try {
        const result = await saveMyUiLanguage(next)
        if (!result.ok) {
          setSaveError(true)
          return false
        }
      } catch {
        setSaveError(true)
        return false
      } finally {
        setSaving(false)
      }
    }
    setLanguageState(next)
    if (scope === 'preview') writeCookie(PREVIEW_LANGUAGE_COOKIE, next)
    else writeBrowserLanguage(next)
    return true
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, saving, saveError, t: (key) => t(key, language) }}>
      <div className="contents" lang={language}>
        {showSkipLink ? <GlobalSkipLink language={language} localized /> : null}
        {children}
      </div>
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider')
  return context
}

/** Shared portal components also render in English staff workspaces. */
export function useOptionalLanguage() {
  return useContext(LanguageContext)
}

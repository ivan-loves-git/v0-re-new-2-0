"use client"

import { useOptionalLanguage } from "@/lib/i18n/language-context"
import { uiCopy, uiCopyWith, type UiCopyKey } from "@/lib/i18n/ui-copy"
import type { Language } from "@/lib/i18n/translations"

export function useUiLanguage(): Language {
  return useOptionalLanguage()?.language ?? "en"
}

export function useUiCopy() {
  const language = useUiLanguage()
  return (key: UiCopyKey, values?: Record<string, string | number>) =>
    values ? uiCopyWith(language, key, values) : uiCopy(language, key)
}

export function UiText({ text, values }: { text: UiCopyKey; values?: Record<string, string | number> }) {
  const copy = useUiCopy()
  return <>{copy(text, values)}</>
}

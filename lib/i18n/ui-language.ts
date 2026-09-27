import type { Language } from "./translations"

export const UI_LANGUAGE_COOKIE = "renew-language"
export const UI_LANGUAGE_STORAGE = "renew-language"
export const PREVIEW_LANGUAGE_COOKIE = "renew-preview-language"

export function parseUiLanguage(value: unknown): Language | null {
  return value === "fr" || value === "en" ? value : null
}

export function resolveUiLanguage(accountValue: unknown, browserValue: unknown): Language {
  return parseUiLanguage(accountValue) ?? parseUiLanguage(browserValue) ?? "fr"
}

export function displayLocale(language: Language): "fr-FR" | "en-GB" {
  return language === "fr" ? "fr-FR" : "en-GB"
}

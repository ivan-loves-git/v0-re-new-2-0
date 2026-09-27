import type { Language } from "@/lib/i18n/translations"

/** A route provider renders the localized link during SSR; staff keeps the root link. */
export function GlobalSkipLink({ language = "en", localized = false }: {
  language?: Language
  localized?: boolean
}) {
  return <a href="#main-content" className="skip-link" lang={language}
    {...(localized ? { "data-localized-skip-link": "" } : { "data-root-skip-link": "" })}>
    {language === "fr" ? "Aller au contenu principal" : "Skip to main content"}
  </a>
}

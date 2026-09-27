"use client"

import { useEffect, useState } from "react"
import { parseUiLanguage } from "@/lib/i18n/ui-language"

/** The root link sits outside route providers, so follow their page-language signal. */
export function GlobalSkipLink() {
  const [language, setLanguage] = useState<"fr" | "en">("en")

  useEffect(() => {
    const readLanguage = () => {
      setLanguage(parseUiLanguage(document.documentElement.lang) ?? "en")
    }
    const observer = new MutationObserver(readLanguage)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] })
    queueMicrotask(readLanguage)
    return () => observer.disconnect()
  }, [])

  return <a href="#main-content" className="skip-link" lang={language}>
    {language === "fr" ? "Aller au contenu principal" : "Skip to main content"}
  </a>
}

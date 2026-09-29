import "server-only"

import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PREVIEW_LANGUAGE_COOKIE, UI_LANGUAGE_COOKIE, parseUiLanguage, resolveUiLanguage } from "./ui-language"
import type { Language } from "./translations"

export async function browserUiLanguage(): Promise<Language | null> {
  return parseUiLanguage((await cookies()).get(UI_LANGUAGE_COOKIE)?.value)
}

export async function anonymousUiLanguage(): Promise<Language> {
  return resolveUiLanguage(null, await browserUiLanguage())
}

export async function previewUiLanguage(): Promise<Language> {
  return resolveUiLanguage(null, (await cookies()).get(PREVIEW_LANGUAGE_COOKIE)?.value)
}

/** Only call with an authenticated Better Auth ID from requirePortalAccess. */
export async function repreneurAccountUiLanguage(userId: string): Promise<Language | null> {
  const { data, error } = await createAdminClient()
    .from("repreneur_ui_preferences")
    .select("language")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error("UI language preference is temporarily unavailable")
  return parseUiLanguage(data?.language)
}

export async function resolvedRepreneurUiLanguage(userId: string) {
  const accountLanguage = await repreneurAccountUiLanguage(userId)
  return {
    accountLanguage,
    language: resolveUiLanguage(accountLanguage, await browserUiLanguage()),
  }
}

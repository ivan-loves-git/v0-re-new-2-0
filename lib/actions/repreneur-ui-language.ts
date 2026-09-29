"use server"

import { requirePortalAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseUiLanguage } from "@/lib/i18n/ui-language"

export type SaveUiLanguageOutcome =
  | { ok: true }
  | { ok: false; code: "invalid_language" | "save_unavailable" }

/** The caller supplies only a locale; the owner always comes from Better Auth. */
export async function saveMyUiLanguage(value: unknown): Promise<SaveUiLanguageOutcome> {
  const language = parseUiLanguage(value)
  if (!language) return { ok: false, code: "invalid_language" }
  const { user } = await requirePortalAccess()
  const { error } = await createAdminClient()
    .from("repreneur_ui_preferences")
    .upsert({ user_id: user.id, language }, { onConflict: "user_id" })
  return error ? { ok: false, code: "save_unavailable" } : { ok: true }
}

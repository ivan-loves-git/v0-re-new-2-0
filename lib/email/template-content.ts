import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { EmailTemplateKey } from "@/lib/types/email"

/** Internal template lookup for trusted server workflows; never a Server Action. */
export async function getTemplateBody(
  templateKey: EmailTemplateKey,
): Promise<string | null> {
  try {
    const { data } = await createAdminClient()
      .from("email_templates")
      .select("body_markdown, body_editable")
      .eq("template_key", templateKey)
      .single()
    if (!data?.body_editable) return null
    return (data.body_markdown ?? "").trim() || null
  } catch {
    return null
  }
}

/** Internal template lookup for trusted server workflows; never a Server Action. */
export async function getTemplateSubject(
  templateKey: EmailTemplateKey,
  fallback: string,
): Promise<string> {
  try {
    const { data } = await createAdminClient()
      .from("email_templates")
      .select("subject")
      .eq("template_key", templateKey)
      .single()
    return data?.subject?.trim() || fallback
  } catch {
    return fallback
  }
}

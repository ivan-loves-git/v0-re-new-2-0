import type { SupabaseClient } from "@supabase/supabase-js";

/** Advisory only: a collision never merges people or reverses a committed save. */
export async function maContactSaveMessage(
  client: SupabaseClient,
  contactId: string,
  message: string,
) {
  try {
    const { data, error } = await client.rpc("ma_contact_email_collision", {
      p_contact_id: contactId,
    });
    if (error)
      return `${message} The email collision check is unavailable; review the address in Contacts.`;
    return data === true
      ? `${message} Another contact uses this email. Review both people; they remain separate.`
      : message;
  } catch {
    return `${message} The email collision check is unavailable; review the address in Contacts.`;
  }
}

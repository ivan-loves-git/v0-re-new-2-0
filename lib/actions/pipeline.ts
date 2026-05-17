"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import type { LifecycleStatus } from "@/lib/types/repreneur"

export async function updateRepreneurStatusPipeline(id: string, status: LifecycleStatus) {
  const supabase = createAdminClient()

  const { error } = await supabase.from("repreneurs").update({ lifecycle_status: status }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/pipeline")
  revalidatePath("/dashboard_re")
  revalidatePath(`/repreneurs/${id}`)
}

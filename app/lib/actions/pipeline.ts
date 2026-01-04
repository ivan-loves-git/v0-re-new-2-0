"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { LifecycleStatus } from "@/lib/types/repreneur"

export async function updateRepreneurStatusPipeline(id: string, status: LifecycleStatus) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("repreneurs").update({ lifecycle_status: status }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/pipeline")
  revalidatePath("/dashboard")
  revalidatePath(`/repreneurs/${id}`)
}

"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidatePath } from "next/cache"
import { revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import type { LifecycleStatus } from "@/lib/types/repreneur"

export async function updateRepreneurStatusPipeline(id: string, status: LifecycleStatus) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase.from("repreneurs").update({ lifecycle_status: status }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/pipeline")
  revalidatePath("/dashboard_re")
  revalidatePath(`/repreneurs/${id}`)
  revalidateRepreneurDashboardTags()
}

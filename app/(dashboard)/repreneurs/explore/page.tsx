import { createServerClient } from "@/lib/supabase/server"
import { RepreneursExplorePage } from "@/components/repreneurs/repreneurs-explore-page"
import type { Repreneur } from "@/lib/types/repreneur"

export const revalidate = 30

export default async function RepreneurExplorePage() {
  const supabase = await createServerClient()

  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .order("created_at", { ascending: false })

  return <RepreneursExplorePage repreneurs={(repreneurs || []) as Repreneur[]} />
}

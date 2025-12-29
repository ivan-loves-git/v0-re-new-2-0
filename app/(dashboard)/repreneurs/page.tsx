import Link from "next/link"
import { Plus } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { RepreneurTable } from "@/components/repreneurs/repreneur-table"
import type { Repreneur } from "@/lib/types/repreneur"

export default async function RepreneursPage() {
  const supabase = await createServerClient()

  const { data: repreneurs } = await supabase.from("repreneurs").select("*").order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Repreneurs</h1>
          <p className="text-gray-600 mt-1">Manage entrepreneurs looking to acquire businesses</p>
        </div>
        <Link href="/repreneurs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Repreneur
          </Button>
        </Link>
      </div>

      <RepreneurTable repreneurs={(repreneurs as Repreneur[]) || []} />
    </div>
  )
}

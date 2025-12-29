import { createClient } from "@/lib/supabase/server"
import { KanbanBoard } from "@/components/pipeline/kanban-board"

export default async function PipelinePage() {
  const supabase = await createClient()

  const { data: repreneurs } = await supabase.from("repreneurs").select("*").order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Pipeline</h1>
        <p className="text-gray-600 mt-1">Drag and drop repreneurs to update their status</p>
      </div>

      <KanbanBoard repreneurs={repreneurs || []} />
    </div>
  )
}

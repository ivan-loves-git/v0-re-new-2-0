"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Badge } from "@/components/ui/badge"
import { SortableRepreneurCard } from "./sortable-repreneur-card"
import type { Repreneur, LifecycleStatus } from "@/lib/types/repreneur"

interface KanbanColumnProps {
  status: LifecycleStatus
  title: string
  repreneurs: Repreneur[]
  color: string
}

export function KanbanColumn({ status, title, repreneurs, color }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
  })

  return (
    <div className="flex-1 min-w-[300px]">
      <div className={`p-4 rounded-t-lg ${color}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{title}</h2>
          <Badge variant="secondary" className="bg-white">
            {repreneurs.length}
          </Badge>
        </div>
      </div>
      <div ref={setNodeRef} className="bg-muted/30 p-4 rounded-b-lg min-h-[calc(100vh-280px)]">
        <SortableContext items={repreneurs.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {repreneurs.map((repreneur) => (
            <SortableRepreneurCard key={repreneur.id} repreneur={repreneur} />
          ))}
        </SortableContext>
        {repreneurs.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No repreneurs</p>}
      </div>
    </div>
  )
}

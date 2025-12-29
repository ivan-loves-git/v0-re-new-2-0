"use client"

import { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SortableRepreneurCard } from "./sortable-repreneur-card"
import { ChevronDown } from "lucide-react"
import type { Repreneur, LifecycleStatus } from "@/lib/types/repreneur"

const INITIAL_VISIBLE = 15
const LOAD_MORE_COUNT = 10

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

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)

  const visibleRepreneurs = repreneurs.slice(0, visibleCount)
  const hasMore = repreneurs.length > visibleCount
  const remainingCount = repreneurs.length - visibleCount

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + LOAD_MORE_COUNT)
  }

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
        <SortableContext items={visibleRepreneurs.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {visibleRepreneurs.map((repreneur) => (
            <SortableRepreneurCard key={repreneur.id} repreneur={repreneur} />
          ))}
        </SortableContext>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadMore}
            className="w-full mt-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="h-4 w-4 mr-1" />
            Show {Math.min(remainingCount, LOAD_MORE_COUNT)} more ({remainingCount} hidden)
          </Button>
        )}

        {repreneurs.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No repreneurs</p>}
      </div>
    </div>
  )
}

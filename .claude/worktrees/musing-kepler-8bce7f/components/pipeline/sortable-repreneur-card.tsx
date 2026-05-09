"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { RepreneurCard } from "./repreneur-card"
import type { Repreneur } from "@/lib/types/repreneur"

interface SortableRepreneurCardProps {
  repreneur: Repreneur
}

export function SortableRepreneurCard({ repreneur }: SortableRepreneurCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: repreneur.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <RepreneurCard repreneur={repreneur} isDragging={isDragging} />
    </div>
  )
}

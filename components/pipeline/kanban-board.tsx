"use client"

import { useState } from "react"
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { KanbanColumn } from "./kanban-column"
import { RepreneurCard } from "./repreneur-card"
import { updateRepreneurStatusPipeline } from "@/lib/actions/pipeline"
import { useRouter } from "next/navigation"
import type { Repreneur, LifecycleStatus } from "@/lib/types/repreneur"

interface KanbanBoardProps {
  repreneurs: Repreneur[]
}

export function KanbanBoard({ repreneurs }: KanbanBoardProps) {
  const router = useRouter()
  const [activeRepreneur, setActiveRepreneur] = useState<Repreneur | null>(null)
  const [optimisticRepreneurs, setOptimisticRepreneurs] = useState(repreneurs)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const columns = [
    { status: "lead" as LifecycleStatus, title: "Lead", color: "bg-blue-100" },
    { status: "qualified" as LifecycleStatus, title: "Qualified", color: "bg-yellow-100" },
    { status: "client" as LifecycleStatus, title: "Client", color: "bg-green-100" },
  ]

  const handleDragStart = (event: DragStartEvent) => {
    const repreneur = optimisticRepreneurs.find((r) => r.id === event.active.id)
    setActiveRepreneur(repreneur || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveRepreneur(null)

    if (!over || active.id === over.id) return

    const repreneurId = active.id as string
    const newStatus = over.id as LifecycleStatus

    // Optimistic update
    setOptimisticRepreneurs((prev) =>
      prev.map((r) => (r.id === repreneurId ? { ...r, lifecycle_status: newStatus } : r)),
    )

    try {
      await updateRepreneurStatusPipeline(repreneurId, newStatus)
      router.refresh()
    } catch (error) {
      // Revert on error
      setOptimisticRepreneurs(repreneurs)
      console.error("Failed to update status:", error)
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            title={column.title}
            color={column.color}
            repreneurs={optimisticRepreneurs.filter((r) => r.lifecycle_status === column.status)}
          />
        ))}
      </div>
      <DragOverlay>{activeRepreneur && <RepreneurCard repreneur={activeRepreneur} isDragging />}</DragOverlay>
    </DndContext>
  )
}

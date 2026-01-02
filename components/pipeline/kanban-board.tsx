"use client"

import { useMemo, useState } from "react"
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
import { KanbanFilters, type KanbanFiltersState } from "./kanban-filters"
import { updateRepreneurStatusPipeline } from "@/lib/actions/pipeline"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Repreneur, LifecycleStatus } from "@/lib/types/repreneur"

interface KanbanBoardProps {
  repreneurs: Repreneur[]
}

export function KanbanBoard({ repreneurs }: KanbanBoardProps) {
  const router = useRouter()
  const [activeRepreneur, setActiveRepreneur] = useState<Repreneur | null>(null)
  const [optimisticRepreneurs, setOptimisticRepreneurs] = useState(repreneurs)
  const [filters, setFilters] = useState<KanbanFiltersState>({
    search: "",
    source: "",
    dateRange: "all",
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  // Extract unique sources from repreneurs
  const sources = useMemo(() => {
    const uniqueSources = new Set<string>()
    repreneurs.forEach((r) => {
      if (r.source) uniqueSources.add(r.source)
    })
    return Array.from(uniqueSources).sort()
  }, [repreneurs])

  // Filter repreneurs based on current filters
  const filteredRepreneurs = useMemo(() => {
    return optimisticRepreneurs.filter((r) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const fullName = `${r.first_name} ${r.last_name}`.toLowerCase()
        const email = r.email.toLowerCase()
        if (!fullName.includes(searchLower) && !email.includes(searchLower)) {
          return false
        }
      }

      // Source filter
      if (filters.source && r.source !== filters.source) {
        return false
      }

      // Date range filter
      if (filters.dateRange !== "all") {
        const days = parseInt(filters.dateRange)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        if (new Date(r.created_at) < cutoffDate) {
          return false
        }
      }

      return true
    })
  }, [optimisticRepreneurs, filters])

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
      toast.success("Status updated")
      router.refresh()
    } catch (error) {
      // Revert on error
      setOptimisticRepreneurs(repreneurs)
      toast.error("Failed to update status. Please try again.")
      console.error("Failed to update status:", error)
    }
  }

  const totalFiltered = filteredRepreneurs.length
  const totalAll = optimisticRepreneurs.length
  const isFiltered = totalFiltered !== totalAll

  return (
    <div>
      <KanbanFilters filters={filters} onFiltersChange={setFilters} sources={sources} />

      {isFiltered && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing {totalFiltered} of {totalAll} repreneurs
        </p>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              title={column.title}
              color={column.color}
              repreneurs={filteredRepreneurs.filter((r) => r.lifecycle_status === column.status)}
            />
          ))}
        </div>
        <DragOverlay>{activeRepreneur && <RepreneurCard repreneur={activeRepreneur} isDragging />}</DragOverlay>
      </DndContext>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { updateRepreneurStatus } from "@/lib/actions/repreneurs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import type { LifecycleStatus } from "@/lib/types/repreneur"

interface UpdateStatusFormProps {
  repreneurId: string
  currentStatus: LifecycleStatus
}

export function UpdateStatusForm({ repreneurId, currentStatus }: UpdateStatusFormProps) {
  const [optimisticStatus, setOptimisticStatus] = useState<LifecycleStatus | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Reset optimistic value when prop changes (server confirmed)
  useEffect(() => {
    setOptimisticStatus(null)
  }, [currentStatus])

  async function handleStatusChange(newStatus: LifecycleStatus) {
    // Optimistic update
    setOptimisticStatus(newStatus)
    setIsSaving(true)

    try {
      await updateRepreneurStatus(repreneurId, newStatus)
      toast.success("Status updated")
    } catch (error) {
      console.error("Failed to update status:", error)
      toast.error("Failed to update status. Please try again.")
      // Revert on error
      setOptimisticStatus(null)
    } finally {
      setIsSaving(false)
    }
  }

  const displayStatus = optimisticStatus ?? currentStatus

  return (
    <Select
      value={displayStatus}
      onValueChange={(value) => handleStatusChange(value as LifecycleStatus)}
      disabled={isSaving}
    >
      <SelectTrigger className={`w-40 ${isSaving ? "opacity-70" : ""}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="lead">Lead</SelectItem>
        <SelectItem value="qualified">Qualified</SelectItem>
        <SelectItem value="client">Client</SelectItem>
        <SelectItem value="rejected">Rejected</SelectItem>
      </SelectContent>
    </Select>
  )
}

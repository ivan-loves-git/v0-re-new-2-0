"use client"

import { updateRepreneurStatus } from "@/lib/actions/repreneurs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { LifecycleStatus } from "@/lib/types/repreneur"

interface UpdateStatusFormProps {
  repreneurId: string
  currentStatus: LifecycleStatus
}

export function UpdateStatusForm({ repreneurId, currentStatus }: UpdateStatusFormProps) {
  async function handleStatusChange(newStatus: LifecycleStatus) {
    try {
      await updateRepreneurStatus(repreneurId, newStatus)
    } catch (error) {
      console.error("Failed to update status:", error)
    }
  }

  return (
    <Select value={currentStatus} onValueChange={(value) => handleStatusChange(value as LifecycleStatus)}>
      <SelectTrigger className="w-40">
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

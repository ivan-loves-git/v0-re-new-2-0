"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, CheckCircle, Circle, Package, Flag, MoreHorizontal, Trash2, Eye, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createMilestone, toggleMilestoneComplete, updateMilestone, deleteMilestone } from "@/lib/actions/offers"
import type { OfferMilestone, MilestoneType } from "@/lib/types/offer"

interface OfferMilestonesProps {
  repreneurOfferId: string
  repreneurId: string
  milestones: OfferMilestone[]
  isActive: boolean // Only allow editing when offer is active
}

const MILESTONE_TYPES = [
  { value: "deliverable", label: "Deliverable", icon: Package },
  { value: "checkpoint", label: "Checkpoint", icon: Flag },
] as const

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function OfferMilestones({ repreneurOfferId, repreneurId, milestones, isActive }: OfferMilestonesProps) {
  const router = useRouter()
  const [localMilestones, setLocalMilestones] = useState<OfferMilestone[]>(milestones)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedMilestone, setSelectedMilestone] = useState<OfferMilestone | null>(null)

  // Form state
  const [milestoneType, setMilestoneType] = useState<MilestoneType>("deliverable")
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isMutatingRef = useRef(false)

  useEffect(() => {
    if (!isMutatingRef.current) {
      setLocalMilestones(milestones)
    }
  }, [milestones])

  function resetForm() {
    setMilestoneType("deliverable")
    setTitle("")
    setNotes("")
    setDueDate("")
  }

  async function handleCreate() {
    if (!title.trim()) return

    const savedType = milestoneType
    const savedTitle = title.trim()
    const savedNotes = notes.trim()
    const savedDueDate = dueDate

    // Create optimistic milestone
    const tempMilestone: OfferMilestone = {
      id: `temp-${Date.now()}`,
      repreneur_offer_id: repreneurOfferId,
      milestone_type: savedType,
      title: savedTitle,
      notes: savedNotes || undefined,
      is_completed: false,
      due_date: savedDueDate || undefined,
      created_at: new Date().toISOString(),
      created_by: "",
      created_by_email: "You",
    }

    isMutatingRef.current = true
    setLocalMilestones(prev => [...prev, tempMilestone])
    resetForm()
    setIsAddOpen(false)
    setIsSubmitting(true)

    try {
      await createMilestone(
        repreneurOfferId,
        repreneurId,
        savedType,
        savedTitle,
        savedNotes || undefined,
        savedDueDate || undefined
      )
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      setTimeout(() => { isMutatingRef.current = false }, 500)
    } catch (error) {
      console.error("Failed to create milestone:", error)
      setLocalMilestones(prev => prev.filter(m => m.id !== tempMilestone.id))
      isMutatingRef.current = false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleComplete(milestone: OfferMilestone) {
    const newCompleted = !milestone.is_completed

    isMutatingRef.current = true
    setLocalMilestones(prev =>
      prev.map(m =>
        m.id === milestone.id
          ? { ...m, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : undefined }
          : m
      )
    )

    try {
      await toggleMilestoneComplete(milestone.id, repreneurId, newCompleted)
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      setTimeout(() => { isMutatingRef.current = false }, 500)
    } catch (error) {
      console.error("Failed to toggle milestone:", error)
      setLocalMilestones(prev =>
        prev.map(m =>
          m.id === milestone.id ? { ...m, is_completed: !newCompleted } : m
        )
      )
      isMutatingRef.current = false
    }
  }

  async function handleUpdate() {
    if (!selectedMilestone || !title.trim()) return

    const savedTitle = title.trim()
    const savedNotes = notes.trim()
    const savedDueDate = dueDate

    isMutatingRef.current = true
    setLocalMilestones(prev =>
      prev.map(m =>
        m.id === selectedMilestone.id
          ? { ...m, title: savedTitle, notes: savedNotes || undefined, due_date: savedDueDate || undefined }
          : m
      )
    )
    setIsEditOpen(false)
    setSelectedMilestone(null)
    setIsSubmitting(true)

    try {
      await updateMilestone(
        selectedMilestone.id,
        repreneurId,
        savedTitle,
        savedNotes || undefined,
        savedDueDate || undefined
      )
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      setTimeout(() => { isMutatingRef.current = false }, 500)
    } catch (error) {
      console.error("Failed to update milestone:", error)
      isMutatingRef.current = false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(milestoneId: string) {
    const milestoneToDelete = localMilestones.find(m => m.id === milestoneId)

    isMutatingRef.current = true
    setLocalMilestones(prev => prev.filter(m => m.id !== milestoneId))

    try {
      await deleteMilestone(milestoneId, repreneurId)
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      setTimeout(() => { isMutatingRef.current = false }, 500)
    } catch (error) {
      console.error("Failed to delete milestone:", error)
      if (milestoneToDelete) {
        setLocalMilestones(prev => [...prev, milestoneToDelete])
      }
      isMutatingRef.current = false
    }
  }

  function openEdit(milestone: OfferMilestone) {
    setSelectedMilestone(milestone)
    setTitle(milestone.title)
    setNotes(milestone.notes || "")
    setDueDate(milestone.due_date || "")
    setIsEditOpen(true)
  }

  function openView(milestone: OfferMilestone) {
    setSelectedMilestone(milestone)
    setIsViewOpen(true)
  }

  // Sort: incomplete first, then by due date, then by created date
  const sortedMilestones = [...localMilestones].sort((a, b) => {
    if (a.is_completed !== b.is_completed) {
      return a.is_completed ? 1 : -1
    }
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (a.due_date) return -1
    if (b.due_date) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const deliverables = sortedMilestones.filter(m => m.milestone_type === "deliverable")
  const checkpoints = sortedMilestones.filter(m => m.milestone_type === "checkpoint")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Milestones</h4>
        {isActive && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Milestone</DialogTitle>
                <DialogDescription>
                  Track deliverables and checkpoints for this offer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={milestoneType} onValueChange={(v) => setMilestoneType(v as MilestoneType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MILESTONE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Final report delivered"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional details..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date (optional)</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isSubmitting || !title.trim()}>
                  {isSubmitting ? "Adding..." : "Add Milestone"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {localMilestones.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No milestones yet</p>
      ) : (
        <div className="space-y-3">
          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500 uppercase font-medium">
                <Package className="h-3 w-3" />
                Deliverables
              </div>
              {deliverables.map((milestone) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  isActive={isActive}
                  onToggle={() => handleToggleComplete(milestone)}
                  onView={() => openView(milestone)}
                  onEdit={() => openEdit(milestone)}
                  onDelete={() => handleDelete(milestone.id)}
                />
              ))}
            </div>
          )}

          {/* Checkpoints */}
          {checkpoints.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500 uppercase font-medium">
                <Flag className="h-3 w-3" />
                Checkpoints
              </div>
              {checkpoints.map((milestone) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  isActive={isActive}
                  onToggle={() => handleToggleComplete(milestone)}
                  onView={() => openView(milestone)}
                  onEdit={() => openEdit(milestone)}
                  onDelete={() => handleDelete(milestone.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) { setIsEditOpen(false); setSelectedMilestone(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Final report delivered"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setSelectedMilestone(null); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={(open) => { if (!open) { setIsViewOpen(false); setSelectedMilestone(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMilestone?.milestone_type === "deliverable" ? (
                <Package className="h-5 w-5" />
              ) : (
                <Flag className="h-5 w-5" />
              )}
              {selectedMilestone?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedMilestone?.milestone_type === "deliverable" ? "Deliverable" : "Checkpoint"}
              {selectedMilestone?.due_date && ` · Due: ${formatDate(selectedMilestone.due_date)}`}
              {selectedMilestone?.is_completed && selectedMilestone?.completed_at && ` · Completed: ${formatDate(selectedMilestone.completed_at)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedMilestone?.notes ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMilestone.notes}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No notes recorded for this milestone.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsViewOpen(false); setSelectedMilestone(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface MilestoneItemProps {
  milestone: OfferMilestone
  isActive: boolean
  onToggle: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}

function MilestoneItem({ milestone, isActive, onToggle, onView, onEdit, onDelete }: MilestoneItemProps) {
  const isTemp = milestone.id.startsWith("temp-")

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg border ${
        milestone.is_completed ? "bg-gray-50" : "bg-white"
      } ${isTemp ? "opacity-70" : ""}`}
    >
      <button
        onClick={onToggle}
        disabled={!isActive || isTemp}
        className={`flex-shrink-0 ${!isActive ? "cursor-default" : "cursor-pointer"}`}
      >
        {milestone.is_completed ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-gray-300 hover:text-gray-400" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${milestone.is_completed ? "text-gray-500 line-through" : "text-gray-900"}`}>
          {milestone.title}
        </p>
        {milestone.due_date && (
          <p className="text-xs text-gray-400">
            Due: {formatDate(milestone.due_date)}
          </p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isTemp}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView}>
            <Eye className="h-4 w-4 mr-2" />
            View
          </DropdownMenuItem>
          {isActive && (
            <>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

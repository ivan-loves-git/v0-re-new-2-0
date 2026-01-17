"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskStream,
  getStreamLabel,
} from "@/lib/types/task"
import { createTask, updateTask, deleteTask } from "@/lib/actions/tasks"
import { toast } from "sonner"

const TEAM_MEMBERS = [
  { id: "bertrand", name: "Bertrand" },
  { id: "amelie", name: "Amélie" },
  { id: "antoine", name: "Antoine" },
  { id: "ivan", name: "Ivan" },
]

const STREAMS: TaskStream[] = ["questionnaire", "emails", "branding", "testing", "go_live"]
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"]
const STATUSES: TaskStatus[] = ["pending", "in_progress", "blocked", "completed"]

interface TaskFormProps {
  task?: Task | null
  allTasks: Task[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TaskForm({ task, allTasks, open, onOpenChange, onSuccess }: TaskFormProps) {
  const isEditing = !!task

  const [title, setTitle] = useState(task?.title || "")
  const [description, setDescription] = useState(task?.description || "")
  const [ownerName, setOwnerName] = useState(task?.owner_name || "")
  const [status, setStatus] = useState<TaskStatus>(task?.status || "pending")
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || "medium")
  const [stream, setStream] = useState<TaskStream | "">(task?.stream || "")
  const [expectedEndDate, setExpectedEndDate] = useState(task?.expected_end_date || "")
  const [dependsOn, setDependsOn] = useState<string[]>(task?.depends_on || [])
  const [notes, setNotes] = useState(task?.notes || "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setOwnerName("")
    setStatus("pending")
    setPriority("medium")
    setStream("")
    setExpectedEndDate("")
    setDependsOn([])
    setNotes("")
  }

  // Sync form state when task prop changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || "")
      setOwnerName(task.owner_name || "")
      setStatus(task.status)
      setPriority(task.priority)
      setStream(task.stream || "")
      setExpectedEndDate(task.expected_end_date || "")
      setDependsOn(task.depends_on || [])
      setNotes(task.notes || "")
    } else {
      resetForm()
    }
  }, [task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Title is required")
      return
    }

    setIsSubmitting(true)

    try {
      if (isEditing && task) {
        await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          owner_name: ownerName || undefined,
          status,
          priority,
          stream: stream || undefined,
          expected_end_date: expectedEndDate || undefined,
          depends_on: dependsOn,
          notes: notes.trim() || undefined,
        })
        toast.success("Task updated")
      } else {
        await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          owner_name: ownerName || undefined,
          status,
          priority,
          stream: stream || undefined,
          expected_end_date: expectedEndDate || undefined,
          depends_on: dependsOn,
          notes: notes.trim() || undefined,
        })
        toast.success("Task created")
      }

      onOpenChange(false)
      onSuccess?.()
      resetForm()
    } catch (error) {
      toast.error(isEditing ? "Failed to update task" : "Failed to create task")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return

    if (!confirm("Are you sure you want to delete this task?")) {
      return
    }

    setIsSubmitting(true)

    try {
      await deleteTask(task.id)
      toast.success("Task deleted")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error("Failed to delete task")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Simplified since useEffect handles state sync
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  // Other tasks that can be dependencies (exclude current task if editing)
  const availableDependencies = allTasks.filter((t) => t.id !== task?.id)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Task" : "Create New Task"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the task details below."
                : "Fill in the task details to create a new task."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            {/* Stream and Owner Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Stream</Label>
                <Select value={stream} onValueChange={(v) => setStream(v as TaskStream)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stream" />
                  </SelectTrigger>
                  <SelectContent>
                    {STREAMS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {getStreamLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Owner</Label>
                <Select value={ownerName} onValueChange={setOwnerName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_MEMBERS.map((member) => (
                      <SelectItem key={member.id} value={member.name}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status and Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ").charAt(0).toUpperCase() +
                          s.replace("_", " ").slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date */}
            <div className="grid gap-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={expectedEndDate}
                onChange={(e) => setExpectedEndDate(e.target.value)}
              />
            </div>

            {/* Dependencies */}
            {availableDependencies.length > 0 && (
              <div className="grid gap-2">
                <Label>Depends On</Label>
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                  {availableDependencies.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dependsOn.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDependsOn([...dependsOn, t.id])
                          } else {
                            setDependsOn(dependsOn.filter((id) => id !== t.id))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="truncate">{t.title}</span>
                      {t.stream && (
                        <span className="text-xs text-gray-400">({getStreamLabel(t.stream)})</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

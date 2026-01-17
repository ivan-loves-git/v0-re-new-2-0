"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  User,
  Calendar,
  Link2,
  Pencil,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  type Task,
  type TaskStatus,
  getDelayDays,
  canStart,
  getBlockingTasks,
  getStatusColor,
} from "@/lib/types/task"
import { updateTaskStatus } from "@/lib/actions/tasks"
import { toast } from "sonner"

interface TaskCardProps {
  task: Task
  allTasks: Task[]
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
}

export function TaskCard({ task, allTasks, onEdit, onDelete }: TaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const delayDays = getDelayDays(task)
  const canBeStarted = canStart(task, allTasks)
  const blockingTasks = getBlockingTasks(task, allTasks)

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (isUpdating) return

    if (newStatus === "in_progress" && !canBeStarted) {
      toast.error("Cannot start task. Dependencies not completed.")
      return
    }

    setIsUpdating(true)
    try {
      await updateTaskStatus(task.id, newStatus)
      toast.success(`Task ${newStatus === "completed" ? "completed" : "updated"}`)
    } catch (error) {
      toast.error("Failed to update task status")
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "blocked":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "pending":
      default:
        return <Circle className="h-4 w-4 text-gray-400" />
    }
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null
    try {
      return format(new Date(dateStr), "MMM d")
    } catch {
      return null
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 px-2 rounded border bg-white hover:bg-gray-50 transition-colors",
        task.status === "completed" && "opacity-60",
        !canBeStarted && task.status === "pending" && "border-dashed border-gray-300",
        delayDays > 0 && task.status !== "completed" && "border-red-200 bg-red-50/30"
      )}
    >
      {/* Status Toggle */}
      <button
        onClick={() =>
          handleStatusChange(task.status === "completed" ? "pending" : "completed")
        }
        disabled={isUpdating || (!canBeStarted && task.status !== "completed")}
        className={cn(
          "flex-shrink-0 transition-opacity",
          isUpdating && "opacity-50 cursor-wait",
          !canBeStarted && task.status !== "completed" && "cursor-not-allowed"
        )}
        title={
          task.status === "completed"
            ? "Mark as pending"
            : canBeStarted
            ? "Mark as complete"
            : "Blocked by dependencies"
        }
      >
        {getStatusIcon(task.status)}
      </button>

      {/* Title */}
      <span
        className={cn(
          "text-sm font-medium truncate flex-1 min-w-0",
          task.status === "completed" && "line-through text-gray-500"
        )}
      >
        {task.title}
      </span>

      {/* Owner */}
      {task.owner_name && (
        <span className="text-[11px] text-gray-500 flex-shrink-0">
          @{task.owner_name}
        </span>
      )}

      {/* Date */}
      {task.expected_end_date && (
        <span className="text-[11px] text-gray-400 flex-shrink-0">
          {formatDate(task.expected_end_date)}
        </span>
      )}

      {/* Blocked indicator */}
      {!canBeStarted && blockingTasks.length > 0 && (
        <span className="text-[10px] text-orange-600 flex items-center gap-0.5 flex-shrink-0">
          <Link2 className="h-3 w-3" />
          {blockingTasks.length}
        </span>
      )}

      {/* Delay */}
      {delayDays > 0 && task.status !== "completed" && (
        <Badge className="text-[10px] px-1 py-0 h-4 bg-red-100 text-red-700">
          {delayDays}d
        </Badge>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {task.status !== "completed" && task.status === "pending" && canBeStarted && (
          <button
            onClick={() => handleStatusChange("in_progress")}
            disabled={isUpdating}
            className="text-[11px] text-blue-600 hover:underline px-1"
          >
            Start
          </button>
        )}
        {task.status === "in_progress" && (
          <Badge className={cn("text-[10px] px-1.5 py-0 h-5", getStatusColor("in_progress"))}>
            In Progress
          </Badge>
        )}

        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(task)}
            className="h-6 w-6 text-gray-400 hover:text-gray-600"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}

        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(task)}
            className="h-6 w-6 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  Link2,
  Pencil,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  type Task,
  type TaskStatus,
  getDelayDays,
  canStart,
  getBlockingTasks,
  getStatusColor,
  getPriorityColor,
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
  const [isExpanded, setIsExpanded] = useState(false)
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
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case "in_progress":
        return <Clock className="h-5 w-5 text-blue-600" />
      case "blocked":
        return <AlertCircle className="h-5 w-5 text-red-600" />
      case "pending":
      default:
        return <Circle className="h-5 w-5 text-gray-400" />
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
    <Card
      className={cn(
        "transition-all duration-200 shadow-none",
        task.status === "completed" && "opacity-60",
        !canBeStarted && task.status === "pending" && "border-dashed border-gray-300",
        delayDays > 0 && task.status !== "completed" && "border-red-300 bg-red-50/30"
      )}
    >
      <CardContent className="px-3 py-2">
        <div className="flex items-center gap-2">
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

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "font-medium",
                  task.status === "completed" && "line-through text-gray-500"
                )}
              >
                {task.title}
              </span>

              {task.priority && task.priority !== "medium" && (
                <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                  {task.priority}
                </Badge>
              )}

              {delayDays > 0 && task.status !== "completed" && (
                <Badge className="bg-red-100 text-red-700 text-xs">
                  {delayDays}d late
                </Badge>
              )}
            </div>

            {/* Meta Row */}
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              {task.owner_name && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {task.owner_name}
                </span>
              )}

              {task.expected_end_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(task.expected_end_date)}
                </span>
              )}

              {!canBeStarted && blockingTasks.length > 0 && (
                <span className="flex items-center gap-1 text-orange-600">
                  <Link2 className="h-3.5 w-3.5" />
                  Blocked by {blockingTasks.length} task(s)
                </span>
              )}
            </div>

            {/* Description (expandable) */}
            {(task.description || task.notes) && (
              <div className="mt-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Hide details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> Show details
                    </>
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2 text-sm text-gray-600 space-y-2">
                    {task.description && <p>{task.description}</p>}
                    {task.notes && (
                      <div className="bg-gray-50 p-2 rounded text-xs">
                        <strong>Notes:</strong> {task.notes}
                      </div>
                    )}
                    {blockingTasks.length > 0 && (
                      <div className="text-xs text-orange-600">
                        <strong>Waiting for:</strong>{" "}
                        {blockingTasks.map((t) => t.title).join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {task.status !== "completed" && (
              <>
                {task.status === "pending" && canBeStarted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange("in_progress")}
                    disabled={isUpdating}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    Start
                  </Button>
                )}
                {task.status === "in_progress" && (
                  <Badge className={getStatusColor("in_progress")}>In Progress</Badge>
                )}
              </>
            )}

            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(task)}
                className="h-8 w-8 text-gray-400 hover:text-gray-600"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}

            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(task)}
                className="h-8 w-8 text-gray-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

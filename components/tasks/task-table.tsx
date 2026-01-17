"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Link2,
  Pencil,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  type Task,
  type TaskStatus,
  getDelayDays,
  canStart,
  getBlockingTasks,
  getStatusColor,
  getStreamLabel,
  getStreamColor,
} from "@/lib/types/task"
import { updateTaskStatus } from "@/lib/actions/tasks"
import { toast } from "sonner"

interface TaskTableProps {
  tasks: Task[]
  allTasks: Task[]
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
}

export function TaskTable({ tasks, allTasks, onEdit, onDelete }: TaskTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    const canBeStarted = canStart(task, allTasks)

    if (newStatus === "in_progress" && !canBeStarted) {
      toast.error("Cannot start task. Dependencies not completed.")
      return
    }

    setUpdatingId(task.id)
    try {
      await updateTaskStatus(task.id, newStatus)
      toast.success(`Task ${newStatus === "completed" ? "completed" : "updated"}`)
    } catch (error) {
      toast.error("Failed to update task status")
    } finally {
      setUpdatingId(null)
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
    if (!dateStr) return "-"
    try {
      return format(new Date(dateStr), "MMM d")
    } catch {
      return "-"
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Task</TableHead>
            <TableHead className="w-[100px]">Stream</TableHead>
            <TableHead className="w-[80px]">Owner</TableHead>
            <TableHead className="w-[80px]">Due</TableHead>
            <TableHead className="w-[90px]">Status</TableHead>
            <TableHead className="w-[80px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const delayDays = getDelayDays(task)
            const canBeStarted = canStart(task, allTasks)
            const blockingTasks = getBlockingTasks(task, allTasks)
            const isUpdating = updatingId === task.id

            return (
              <TableRow
                key={task.id}
                className={cn(
                  "hover:bg-gray-50",
                  task.status === "completed" && "opacity-60",
                  delayDays > 0 && task.status !== "completed" && "bg-red-50/50"
                )}
              >
                {/* Status checkbox */}
                <TableCell className="pr-0">
                  <button
                    onClick={() =>
                      handleStatusChange(task, task.status === "completed" ? "pending" : "completed")
                    }
                    disabled={isUpdating || (!canBeStarted && task.status !== "completed")}
                    className={cn(
                      "flex-shrink-0 transition-opacity",
                      isUpdating && "opacity-50 cursor-wait",
                      !canBeStarted && task.status !== "completed" && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {getStatusIcon(task.status)}
                  </button>
                </TableCell>

                {/* Title */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        task.status === "completed" && "line-through text-gray-500"
                      )}
                    >
                      {task.title}
                    </span>
                    {blockingTasks.length > 0 && (
                      <span className="text-[10px] text-orange-600 flex items-center gap-0.5">
                        <Link2 className="h-3 w-3" />
                        {blockingTasks.length}
                      </span>
                    )}
                    {delayDays > 0 && task.status !== "completed" && (
                      <Badge className="text-[10px] px-1 py-0 h-4 bg-red-100 text-red-700">
                        {delayDays}d late
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Stream */}
                <TableCell>
                  {task.stream && (
                    <Badge className={cn("text-[10px] px-1.5 py-0", getStreamColor(task.stream))}>
                      {getStreamLabel(task.stream)}
                    </Badge>
                  )}
                </TableCell>

                {/* Owner */}
                <TableCell>
                  <span className="text-xs text-gray-600">{task.owner_name || "-"}</span>
                </TableCell>

                {/* Due Date */}
                <TableCell>
                  <span className="text-xs text-gray-500">{formatDate(task.expected_end_date)}</span>
                </TableCell>

                {/* Status */}
                <TableCell>
                  {task.status === "in_progress" ? (
                    <Badge className={cn("text-[10px] px-1.5 py-0", getStatusColor("in_progress"))}>
                      In Progress
                    </Badge>
                  ) : task.status === "pending" && canBeStarted ? (
                    <button
                      onClick={() => handleStatusChange(task, "in_progress")}
                      disabled={isUpdating}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      Start
                    </button>
                  ) : task.status === "completed" ? (
                    <span className="text-[11px] text-green-600">Done</span>
                  ) : task.status === "blocked" ? (
                    <span className="text-[11px] text-red-600">Blocked</span>
                  ) : (
                    <span className="text-[11px] text-gray-400">Waiting</span>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-0.5">
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
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {tasks.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">No tasks found</div>
      )}
    </div>
  )
}

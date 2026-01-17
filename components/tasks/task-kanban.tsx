"use client"

import { useMemo } from "react"
import { Circle, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  type Task,
  type TaskStatus,
  getDelayDays,
  canStart,
  getStreamLabel,
  getStreamColor,
} from "@/lib/types/task"
import { updateTaskStatus } from "@/lib/actions/tasks"
import { toast } from "sonner"

interface TaskKanbanProps {
  tasks: Task[]
  allTasks: Task[]
  onEdit?: (task: Task) => void
}

const COLUMNS: { status: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { status: "pending", label: "To Do", icon: <Circle className="h-4 w-4" />, color: "bg-gray-100" },
  { status: "in_progress", label: "In Progress", icon: <Clock className="h-4 w-4" />, color: "bg-blue-100" },
  { status: "blocked", label: "Blocked", icon: <AlertCircle className="h-4 w-4" />, color: "bg-red-100" },
  { status: "completed", label: "Done", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-100" },
]

export function TaskKanban({ tasks, allTasks, onEdit }: TaskKanbanProps) {
  // Group tasks by status
  const groupedByStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      pending: [],
      in_progress: [],
      blocked: [],
      completed: [],
    }

    tasks.forEach((task) => {
      groups[task.status].push(task)
    })

    return groups
  }, [tasks])

  return (
    <div className="grid grid-cols-4 gap-3 h-[calc(100vh-280px)] min-h-[400px]">
      {COLUMNS.map((column) => (
        <KanbanColumn
          key={column.status}
          column={column}
          tasks={groupedByStatus[column.status]}
          allTasks={allTasks}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}

interface KanbanColumnProps {
  column: { status: TaskStatus; label: string; icon: React.ReactNode; color: string }
  tasks: Task[]
  allTasks: Task[]
  onEdit?: (task: Task) => void
}

function KanbanColumn({ column, tasks, allTasks, onEdit }: KanbanColumnProps) {
  return (
    <div className={cn("flex flex-col rounded-lg", column.color)}>
      {/* Column Header */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-200">
        {column.icon}
        <span className="font-medium text-sm">{column.label}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {tasks.length}
        </Badge>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            allTasks={allTasks}
            onEdit={onEdit}
          />
        ))}

        {tasks.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No tasks</p>
        )}
      </div>
    </div>
  )
}

interface KanbanCardProps {
  task: Task
  allTasks: Task[]
  onEdit?: (task: Task) => void
}

function KanbanCard({ task, allTasks, onEdit }: KanbanCardProps) {
  const delayDays = getDelayDays(task)
  const canBeStarted = canStart(task, allTasks)

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === "in_progress" && !canBeStarted) {
      toast.error("Cannot start task. Dependencies not completed.")
      return
    }

    try {
      await updateTaskStatus(task.id, newStatus)
      toast.success("Task updated")
    } catch (error) {
      toast.error("Failed to update task")
    }
  }

  return (
    <div
      onClick={() => onEdit?.(task)}
      className={cn(
        "bg-white rounded border p-2 cursor-pointer hover:shadow-sm transition-shadow",
        !canBeStarted && task.status === "pending" && "border-dashed opacity-70",
        delayDays > 0 && task.status !== "completed" && "border-red-300"
      )}
    >
      {/* Title */}
      <p className={cn(
        "text-sm font-medium line-clamp-2",
        task.status === "completed" && "line-through text-gray-500"
      )}>
        {task.title}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {task.stream && (
          <Badge className={cn("text-[10px] px-1.5 py-0", getStreamColor(task.stream))}>
            {getStreamLabel(task.stream)}
          </Badge>
        )}

        {task.owner_name && (
          <span className="text-[10px] text-gray-500">@{task.owner_name}</span>
        )}

        {delayDays > 0 && task.status !== "completed" && (
          <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
            {delayDays}d late
          </Badge>
        )}
      </div>

      {/* Quick Actions */}
      {task.status !== "completed" && (
        <div className="flex gap-1 mt-2">
          {task.status === "pending" && canBeStarted && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleStatusChange("in_progress")
              }}
              className="text-[10px] text-blue-600 hover:underline"
            >
              Start
            </button>
          )}
          {task.status === "in_progress" && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleStatusChange("completed")
              }}
              className="text-[10px] text-green-600 hover:underline"
            >
              Complete
            </button>
          )}
          {task.status === "blocked" && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleStatusChange("pending")
              }}
              className="text-[10px] text-gray-600 hover:underline"
            >
              Unblock
            </button>
          )}
        </div>
      )}
    </div>
  )
}

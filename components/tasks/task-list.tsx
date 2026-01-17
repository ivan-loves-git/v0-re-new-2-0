"use client"

import { useState, useMemo } from "react"
import { Plus, Filter, LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TaskCard } from "./task-card"
import { TaskForm } from "./task-form"
import {
  type Task,
  type TaskStatus,
  type TaskStream,
  getStreamLabel,
  getStreamColor,
} from "@/lib/types/task"

interface TaskListProps {
  tasks: Task[]
}

const STREAMS: TaskStream[] = ["questionnaire", "emails", "branding", "testing", "go_live"]
const STATUSES: TaskStatus[] = ["pending", "in_progress", "blocked", "completed"]
const OWNERS = ["Bertrand", "Amélie", "Antoine", "Ivan"]

export function TaskList({ tasks }: TaskListProps) {
  const [filterStream, setFilterStream] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterOwner, setFilterOwner] = useState<string>("all")
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterStream !== "all" && task.stream !== filterStream) return false
      if (filterStatus !== "all" && task.status !== filterStatus) return false
      if (filterOwner !== "all" && task.owner_name !== filterOwner) return false
      return true
    })
  }, [tasks, filterStream, filterStatus, filterOwner])

  // Group tasks by stream
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {}

    // Initialize all streams
    STREAMS.forEach((stream) => {
      groups[stream] = []
    })
    groups["unassigned"] = []

    // Group filtered tasks
    filteredTasks.forEach((task) => {
      const stream = task.stream || "unassigned"
      if (!groups[stream]) {
        groups[stream] = []
      }
      groups[stream].push(task)
    })

    return groups
  }, [filteredTasks])

  // Stats
  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === "completed").length
    const inProgress = tasks.filter((t) => t.status === "in_progress").length
    const overdue = tasks.filter((t) => {
      if (t.status === "completed" || !t.expected_end_date) return false
      return new Date(t.expected_end_date) < new Date()
    }).length

    return { total, completed, inProgress, overdue }
  }, [tasks])

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setShowForm(true)
  }

  const handleDelete = (task: Task) => {
    // Open form in delete mode
    setEditingTask(task)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingTask(null)
  }

  const clearFilters = () => {
    setFilterStream("all")
    setFilterStatus("all")
    setFilterOwner("all")
  }

  const hasFilters = filterStream !== "all" || filterStatus !== "all" || filterOwner !== "all"

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track V1.0 launch tasks and progress
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats Badges */}
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700">
              {stats.completed}/{stats.total} done
            </Badge>
            {stats.inProgress > 0 && (
              <Badge className="bg-blue-100 text-blue-700">
                {stats.inProgress} in progress
              </Badge>
            )}
            {stats.overdue > 0 && (
              <Badge className="bg-red-100 text-red-700">{stats.overdue} overdue</Badge>
            )}
          </div>

          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg">
        <Filter className="h-4 w-4 text-gray-500" />

        <Select value={filterStream} onValueChange={setFilterStream}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Streams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Streams</SelectItem>
            {STREAMS.map((s) => (
              <SelectItem key={s} value={s}>
                {getStreamLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ").charAt(0).toUpperCase() + s.replace("_", " ").slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {OWNERS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        <span className="text-sm text-gray-500 ml-auto">
          {filteredTasks.length} of {tasks.length} tasks
        </span>
      </div>

      {/* Task Groups */}
      <div className="space-y-8">
        {STREAMS.map((stream) => {
          const streamTasks = groupedTasks[stream]
          if (filterStream !== "all" && filterStream !== stream) return null
          if (streamTasks.length === 0 && filterStream !== stream) return null

          const completedCount = streamTasks.filter((t) => t.status === "completed").length
          const progress = streamTasks.length > 0 ? (completedCount / streamTasks.length) * 100 : 0

          return (
            <div key={stream} className="space-y-3">
              {/* Stream Header */}
              <div className="flex items-center gap-3">
                <Badge className={getStreamColor(stream)}>{getStreamLabel(stream)}</Badge>
                <span className="text-sm text-gray-500">
                  {completedCount}/{streamTasks.length} tasks
                </span>
                {/* Progress bar */}
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-xs">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Tasks */}
              {streamTasks.length > 0 ? (
                <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                  {streamTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      allTasks={tasks}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              ) : (
                <div className="pl-4 border-l-2 border-gray-200">
                  <p className="text-sm text-gray-400 italic py-4">
                    No tasks in this stream
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {/* Unassigned tasks */}
        {groupedTasks["unassigned"]?.length > 0 && filterStream === "all" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-gray-100 text-gray-700">Unassigned</Badge>
              <span className="text-sm text-gray-500">
                {groupedTasks["unassigned"].length} tasks
              </span>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-gray-200">
              {groupedTasks["unassigned"].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  allTasks={tasks}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No tasks found</p>
          {hasFilters && (
            <Button variant="link" onClick={clearFilters}>
              Clear filters to see all tasks
            </Button>
          )}
        </div>
      )}

      {/* Task Form Modal */}
      <TaskForm
        task={editingTask}
        allTasks={tasks}
        open={showForm}
        onOpenChange={handleFormClose}
      />
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
import { Plus, Filter, LayoutGrid, List, Table2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TaskCard } from "./task-card"
import { TaskForm } from "./task-form"
import { TaskKanban } from "./task-kanban"
import { TaskTable } from "./task-table"
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

type ViewMode = "list" | "kanban" | "table"
type GroupBy = "stream" | "owner" | "due_date"

export function TaskList({ tasks }: TaskListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [groupBy, setGroupBy] = useState<GroupBy>("stream")
  const [filterStream, setFilterStream] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterOwner, setFilterOwner] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterStream !== "all" && task.stream !== filterStream) return false
      if (filterStatus !== "all" && task.status !== filterStatus) return false
      if (filterOwner !== "all" && task.owner_name !== filterOwner) return false

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = task.title.toLowerCase().includes(query)
        const matchesDescription = task.description?.toLowerCase().includes(query)
        const matchesOwner = task.owner_name?.toLowerCase().includes(query)
        const matchesNotes = task.notes?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesDescription && !matchesOwner && !matchesNotes) {
          return false
        }
      }

      return true
    })
  }, [tasks, filterStream, filterStatus, filterOwner, searchQuery])

  // Group tasks based on groupBy setting
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {}

    if (groupBy === "stream") {
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
    } else if (groupBy === "owner") {
      // Initialize all owners
      OWNERS.forEach((owner) => {
        groups[owner] = []
      })
      groups["Unassigned"] = []

      // Group filtered tasks by owner
      filteredTasks.forEach((task) => {
        const owner = task.owner_name || "Unassigned"
        if (!groups[owner]) {
          groups[owner] = []
        }
        groups[owner].push(task)
      })
    } else if (groupBy === "due_date") {
      // Single group sorted by due date
      groups["all"] = [...filteredTasks].sort((a, b) => {
        if (!a.expected_end_date && !b.expected_end_date) return 0
        if (!a.expected_end_date) return 1
        if (!b.expected_end_date) return -1
        return new Date(a.expected_end_date).getTime() - new Date(b.expected_end_date).getTime()
      })
    }

    return groups
  }, [filteredTasks, groupBy])

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
    setSearchQuery("")
  }

  const hasFilters = filterStream !== "all" || filterStatus !== "all" || filterOwner !== "all" || searchQuery.trim() !== ""

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track V1.0 launch tasks and progress
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats Badges */}
          <div className="hidden sm:flex items-center gap-2">
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

          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg">
        {/* View Switcher - Left side */}
        <div className="flex items-center rounded-md border bg-white p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
              viewMode === "list"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
              viewMode === "kanban"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
            title="Board view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Board</span>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
              viewMode === "table"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
            title="Table view"
          >
            <Table2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300 hidden sm:block" />

        {/* Group By */}
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stream">By Stream</SelectItem>
            <SelectItem value="owner">By Owner</SelectItem>
            <SelectItem value="due_date">By Due Date</SelectItem>
          </SelectContent>
        </Select>

        <div className="w-px h-6 bg-gray-300 hidden sm:block" />

        {/* Filters */}
        <Select value={filterStream} onValueChange={setFilterStream}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
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
          <SelectTrigger className="w-[120px] h-8 text-xs">
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
          <SelectTrigger className="w-[120px] h-8 text-xs">
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
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}

        {/* Search bar - Right side */}
        <div className="flex-1 min-w-0" />
        <div className="relative w-full sm:w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>

        <span className="text-xs text-gray-500 hidden sm:block">
          {filteredTasks.length}/{tasks.length}
        </span>
      </div>

      {/* View Content */}
      {viewMode === "kanban" ? (
        <TaskKanban
          tasks={filteredTasks}
          allTasks={tasks}
          onEdit={handleEdit}
        />
      ) : viewMode === "table" ? (
        <TaskTable
          tasks={filteredTasks}
          allTasks={tasks}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : (
        <>
          {/* Task Groups - List View */}
          <div className="space-y-3">
            {groupBy === "stream" && (
              <>
                {STREAMS.map((stream) => {
                  const streamTasks = groupedTasks[stream] || []
                  if (filterStream !== "all" && filterStream !== stream) return null
                  if (streamTasks.length === 0 && filterStream !== stream) return null

                  const completedCount = streamTasks.filter((t) => t.status === "completed").length
                  const progress = streamTasks.length > 0 ? (completedCount / streamTasks.length) * 100 : 0

                  return (
                    <div key={stream} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px]", getStreamColor(stream))}>{getStreamLabel(stream)}</Badge>
                        <span className="text-[10px] text-gray-500">
                          {completedCount}/{streamTasks.length}
                        </span>
                        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                          <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      {streamTasks.length > 0 ? (
                        <div className="space-y-0.5 pl-2 border-l-2 border-gray-200">
                          {streamTasks.map((task) => (
                            <TaskCard key={task.id} task={task} allTasks={tasks} onEdit={handleEdit} onDelete={handleDelete} />
                          ))}
                        </div>
                      ) : (
                        <div className="pl-2 border-l-2 border-gray-200">
                          <p className="text-[10px] text-gray-400 italic py-1">No tasks</p>
                        </div>
                      )}
                    </div>
                  )
                })}
                {groupedTasks["unassigned"]?.length > 0 && filterStream === "all" && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-gray-100 text-gray-700 text-[10px]">Unassigned</Badge>
                      <span className="text-[10px] text-gray-500">{groupedTasks["unassigned"].length}</span>
                    </div>
                    <div className="space-y-0.5 pl-2 border-l-2 border-gray-200">
                      {groupedTasks["unassigned"].map((task) => (
                        <TaskCard key={task.id} task={task} allTasks={tasks} onEdit={handleEdit} onDelete={handleDelete} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {groupBy === "owner" && (
              <>
                {[...OWNERS, "Unassigned"].map((owner) => {
                  const ownerTasks = groupedTasks[owner] || []
                  if (filterOwner !== "all" && filterOwner !== owner) return null
                  if (ownerTasks.length === 0) return null

                  const completedCount = ownerTasks.filter((t) => t.status === "completed").length
                  const progress = ownerTasks.length > 0 ? (completedCount / ownerTasks.length) * 100 : 0

                  return (
                    <div key={owner} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-700 text-[10px]">@{owner}</Badge>
                        <span className="text-[10px] text-gray-500">
                          {completedCount}/{ownerTasks.length}
                        </span>
                        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                          <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="space-y-0.5 pl-2 border-l-2 border-gray-200">
                        {ownerTasks.map((task) => (
                          <TaskCard key={task.id} task={task} allTasks={tasks} onEdit={handleEdit} onDelete={handleDelete} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {groupBy === "due_date" && (
              <div className="space-y-0.5">
                {(groupedTasks["all"] || []).map((task) => (
                  <TaskCard key={task.id} task={task} allTasks={tasks} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

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

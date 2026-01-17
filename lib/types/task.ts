export type TaskStatus = "pending" | "in_progress" | "blocked" | "completed"
export type TaskPriority = "low" | "medium" | "high" | "critical"
export type TaskStream = "questionnaire" | "emails" | "branding" | "testing" | "go_live"

export interface Task {
  id: string
  title: string
  description?: string

  // Ownership
  owner_id?: string
  owner_name?: string

  // Status
  status: TaskStatus
  priority: TaskPriority

  // Timeline
  expected_start_date?: string
  expected_end_date?: string
  actual_start_date?: string
  actual_end_date?: string

  // Dependencies
  depends_on: string[]

  // Categorization
  stream?: TaskStream

  // Metadata
  created_at: string
  updated_at: string
  created_by?: string

  // Notes
  notes?: string
}

export interface Task_Insert {
  title: string
  description?: string
  owner_id?: string
  owner_name?: string
  status?: TaskStatus
  priority?: TaskPriority
  expected_start_date?: string
  expected_end_date?: string
  depends_on?: string[]
  stream?: TaskStream
  created_by?: string
  notes?: string
}

export interface Task_Update {
  title?: string
  description?: string
  owner_id?: string
  owner_name?: string
  status?: TaskStatus
  priority?: TaskPriority
  expected_start_date?: string
  expected_end_date?: string
  actual_start_date?: string
  actual_end_date?: string
  depends_on?: string[]
  stream?: TaskStream
  notes?: string
}

// Helper functions for task management

export function getDelayDays(task: Task): number {
  if (!task.expected_end_date) return 0
  const expectedEnd = new Date(task.expected_end_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expectedEnd.setHours(0, 0, 0, 0)

  if (task.status === "completed" && task.actual_end_date) {
    const actualEnd = new Date(task.actual_end_date)
    actualEnd.setHours(0, 0, 0, 0)
    const diff = Math.ceil((actualEnd.getTime() - expectedEnd.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }

  if (task.status !== "completed" && today > expectedEnd) {
    return Math.ceil((today.getTime() - expectedEnd.getTime()) / (1000 * 60 * 60 * 24))
  }

  return 0
}

export function canStart(task: Task, allTasks: Task[]): boolean {
  if (!task.depends_on?.length) return true
  return task.depends_on.every((depId) =>
    allTasks.find((t) => t.id === depId)?.status === "completed"
  )
}

export function getBlockingTasks(task: Task, allTasks: Task[]): Task[] {
  if (!task.depends_on?.length) return []
  return task.depends_on
    .map((depId) => allTasks.find((t) => t.id === depId))
    .filter((t): t is Task => t !== undefined && t.status !== "completed")
}

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700 border-green-200"
    case "in_progress":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "blocked":
      return "bg-red-100 text-red-700 border-red-200"
    case "pending":
    default:
      return "bg-gray-100 text-gray-700 border-gray-200"
  }
}

export function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-700"
    case "high":
      return "bg-orange-100 text-orange-700"
    case "medium":
      return "bg-yellow-100 text-yellow-700"
    case "low":
    default:
      return "bg-gray-100 text-gray-600"
  }
}

export function getStreamLabel(stream: TaskStream): string {
  switch (stream) {
    case "questionnaire":
      return "Questionnaire"
    case "emails":
      return "Emails"
    case "branding":
      return "Branding"
    case "testing":
      return "Testing"
    case "go_live":
      return "Go-Live"
    default:
      return stream
  }
}

export function getStreamColor(stream: TaskStream): string {
  switch (stream) {
    case "questionnaire":
      return "bg-purple-100 text-purple-700"
    case "emails":
      return "bg-blue-100 text-blue-700"
    case "branding":
      return "bg-pink-100 text-pink-700"
    case "testing":
      return "bg-orange-100 text-orange-700"
    case "go_live":
      return "bg-green-100 text-green-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

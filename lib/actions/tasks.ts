"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import type { Task, Task_Insert, Task_Update, TaskStatus, TaskStream } from "@/lib/types/task"

export async function getTasks(): Promise<Task[]> {
  const supabase = createAdminClient()

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .order("stream", { ascending: true })
    .order("expected_end_date", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (tasks || []) as Task[]
}

export async function getTasksByStream(stream: TaskStream): Promise<Task[]> {
  const supabase = createAdminClient()

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("stream", stream)
    .order("expected_end_date", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (tasks || []) as Task[]
}

export async function getTask(id: string): Promise<Task | null> {
  const supabase = createAdminClient()

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw new Error(error.message)
  }

  return task as Task
}

export async function createTask(data: {
  title: string
  description?: string
  owner_name?: string
  status?: TaskStatus
  expected_start_date?: string
  expected_end_date?: string
  depends_on?: string[]
  stream?: TaskStream
  notes?: string
}): Promise<Task> {
  const supabase = createAdminClient()

  // Verify user is authenticated (Better Auth)
  await requireUser()

  const task: Task_Insert = {
    title: data.title,
    description: data.description || undefined,
    // Note: owner_id has FK to auth.users which doesn't work with Better Auth
    // Using owner_name instead for display
    owner_name: data.owner_name || undefined,
    status: data.status || "pending",
    expected_start_date: data.expected_start_date || undefined,
    expected_end_date: data.expected_end_date || undefined,
    depends_on: data.depends_on || [],
    stream: data.stream || undefined,
    // Note: created_by has FK to auth.users which doesn't work with Better Auth
    // Auth is verified via requireUser() at app layer instead
    notes: data.notes || undefined,
  }

  const { data: created, error } = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/tasks")
  return created as Task
}

export async function updateTask(
  id: string,
  data: Task_Update
): Promise<Task> {
  const supabase = createAdminClient()

  // Verify user is authenticated (Better Auth)
  await requireUser()

  const { data: updated, error } = await supabase
    .from("tasks")
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/tasks")
  return updated as Task
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus
): Promise<Task> {
  const supabase = createAdminClient()

  // Verify user is authenticated (Better Auth)
  await requireUser()

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/tasks")
  return updated as Task
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createAdminClient()

  // Verify user is authenticated (Better Auth)
  await requireUser()

  const { error } = await supabase.from("tasks").delete().eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/tasks")
}

// Get task statistics
export async function getTaskStats(): Promise<{
  total: number
  completed: number
  in_progress: number
  blocked: number
  pending: number
  overdue: number
}> {
  const supabase = createAdminClient()

  const { data: tasks, error } = await supabase.from("tasks").select("status, expected_end_date")

  if (error) {
    throw new Error(error.message)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stats = {
    total: tasks?.length || 0,
    completed: 0,
    in_progress: 0,
    blocked: 0,
    pending: 0,
    overdue: 0,
  }

  tasks?.forEach((task: { status: string; expected_end_date: string | null }) => {
    switch (task.status) {
      case "completed":
        stats.completed++
        break
      case "in_progress":
        stats.in_progress++
        break
      case "blocked":
        stats.blocked++
        break
      case "pending":
        stats.pending++
        break
    }

    if (task.status !== "completed" && task.expected_end_date) {
      const dueDate = new Date(task.expected_end_date)
      dueDate.setHours(0, 0, 0, 0)
      if (dueDate < today) {
        stats.overdue++
      }
    }
  })

  return stats
}

// Get users for task assignment (from Supabase auth)
export async function getTeamMembers(): Promise<Array<{ id: string; email: string; name: string }>> {
  // For now, return hardcoded team members
  // In production, this could query a separate team_members table
  return [
    { id: "bertrand", email: "bertrand.galas@edu.escp.eu", name: "Bertrand" },
    { id: "amelie", email: "amelie.lyon@edu.escp.eu", name: "Amélie" },
    { id: "antoine", email: "antoine.duchene@edu.escp.eu", name: "Antoine" },
    { id: "ivan", email: "ivan.paudice@gmail.com", name: "Ivan" },
  ]
}

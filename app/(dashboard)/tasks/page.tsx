import { getTasks } from "@/lib/actions/tasks"
import { TaskList } from "@/components/tasks/task-list"

// Cache for 30 seconds - prevents re-fetching on rapid navigation
export const revalidate = 30

export default async function TasksPage() {
  const tasks = await getTasks()

  return <TaskList tasks={tasks} />
}

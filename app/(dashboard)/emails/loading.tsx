import { Skeleton } from "@/components/ui/skeleton"

export default function EmailsLoading() {
  return <div className="space-y-5" aria-label="Loading email operations">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-9 w-full max-w-xl" />
    <div className="rounded-lg border bg-card p-5">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-4 h-9 w-full" />
      <Skeleton className="mt-4 h-12 w-full" />
      <Skeleton className="mt-2 h-12 w-full" />
      <Skeleton className="mt-2 h-12 w-full" />
    </div>
  </div>
}

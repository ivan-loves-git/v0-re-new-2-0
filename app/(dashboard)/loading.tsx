import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function MetricSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-16" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1.5fr_1fr_1fr_72px] gap-4 rounded-md border p-3"
          >
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading page">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>

      <TableSkeleton />
    </div>
  )
}

import { Skeleton } from "@/components/ui/skeleton"

export default function RepreneursLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-80 mt-2" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      {/* Search and Filter Bar */}
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>

      {/* Grouped Tables */}
      <div className="space-y-4">
        {["Leads", "Qualified", "Clients", "Rejected"].map((status) => (
          <div key={status} className="rounded-lg border bg-gray-50">
            {/* Group Header */}
            <div className="px-4 py-3 flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-b-lg">
              {/* Table Header */}
              <div className="border-b px-4 py-3 grid grid-cols-4 gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>

              {/* Table Rows */}
              {[1, 2, 3].map((row) => (
                <div key={row} className="px-4 py-3 grid grid-cols-4 gap-4 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

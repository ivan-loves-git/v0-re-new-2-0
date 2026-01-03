import { Skeleton } from "@/components/ui/skeleton"

export default function IntakeLoading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div>
                <Skeleton className="h-5 w-20 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-16" />
          </div>

          {/* Step indicators skeleton */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center flex-1">
                <Skeleton className="h-12 rounded-xl flex-1" />
                {i < 5 && <div className="w-4 h-0.5 mx-1 bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Skeleton className="h-8 w-48 mx-auto mb-2" />
          <Skeleton className="h-5 w-64 mx-auto" />
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-100 border p-8">
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation buttons skeleton */}
        <div className="flex items-center justify-between mt-8">
          <Skeleton className="h-12 w-24 rounded-lg" />
          <Skeleton className="h-12 w-40 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

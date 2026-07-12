import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function JourneyLoading() {
  return (
    <div className="flex flex-col gap-5" aria-label="Loading journey">
      <div className="flex items-start gap-3 border-b pb-5">
        <Skeleton className="size-10 rounded-lg" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-[34rem] max-w-full" />
        </div>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid gap-px bg-border md:grid-cols-5">
            {[0, 1, 2, 3, 4].map((stage) => (
              <div key={stage} className="flex flex-col gap-4 bg-card p-4">
                <div className="flex items-start justify-between">
                  <Skeleton className="size-9 rounded-md" />
                  <Skeleton className="h-4 w-5" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((stage) => (
              <div key={stage} className="bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-8" />
                </div>
                <div className="flex flex-col divide-y">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

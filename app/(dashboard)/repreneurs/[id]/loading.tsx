import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function RepreneurDetailLoading() {
  return (
    <div className="flex flex-col gap-5" aria-label="Loading repreneur record">
      <Skeleton className="h-8 w-40" />

      <div className="grid gap-6 border-b pb-5 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-start gap-4">
          <Skeleton className="size-20 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton className="h-8 w-72 max-w-full" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="size-9" />
        </div>
      </div>

      <div className="flex gap-6 overflow-hidden border-b pb-2">
        {[92, 106, 84, 112, 98, 76].map((width) => (
          <Skeleton key={width} className="h-5 shrink-0" style={{ width }} />
        ))}
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-96 max-w-full" />
            <Skeleton className="h-4 w-[34rem] max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        {[0, 1].map((item) => (
          <Card key={item}>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((field) => (
                <div key={field} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

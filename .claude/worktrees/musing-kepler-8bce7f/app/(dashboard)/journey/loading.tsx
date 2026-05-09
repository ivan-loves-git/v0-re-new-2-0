import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function JourneyLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-80 mt-2" />
      </div>

      {/* Journey Stages */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {["Discovery", "Screening", "Due Diligence", "Negotiation", "Closing"].map((stage) => (
          <div key={stage} className="space-y-3">
            {/* Stage Header */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
            </div>

            {/* Cards in Stage */}
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Card key={i} className="cursor-pointer">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16 mt-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function RepreneurDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Skeleton className="h-9 w-20" />

      {/* Header with Avatar and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            {/* Name Fields */}
            <div className="flex gap-6">
              <div>
                <Skeleton className="h-3 w-12 mb-1" />
                <Skeleton className="h-8 w-32" />
              </div>
              <div>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
            {/* Contact Info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            {/* Status Badge */}
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-3">
          <div>
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="h-9 w-9 mt-5" />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3 md:grid-rows-[auto_auto]">
        {/* Rating Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-16" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Tier 1 */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-40" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-12" />
                <Skeleton className="h-4 w-16" />
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-4 w-4" />
                  ))}
                </div>
              </div>
            </div>
            <Skeleton className="h-px w-full" />
            {/* Tier 2 */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-48" />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-6 w-6" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Investment Profile Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-32" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-28 mb-1" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Activity History Card - spans 2 rows */}
        <Card className="md:row-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-28" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 pb-4 border-b last:border-0">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Offers Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded border">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notes Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="pb-3 border-b last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Questionnaire Details Section */}
      <div className="pt-6 border-t">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-28 mb-1" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

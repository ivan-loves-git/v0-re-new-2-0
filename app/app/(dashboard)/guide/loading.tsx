import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function GuideLoading() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96 mt-2" />
      </div>

      {/* Platform Goal Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>

      {/* Key Principles */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Page Instructions Accordion */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Core Concepts Accordion */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-48" />
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Guide CTA */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-80 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>

      {/* Roadmap */}
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="pl-10 relative">
            <Skeleton className="absolute left-0 h-6 w-6 rounded-full" />
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Skeleton className="h-5 w-24 mb-2" />
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-20 mt-1" />
                  </div>
                  <Skeleton className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}

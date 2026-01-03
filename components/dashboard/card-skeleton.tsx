"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface CardSkeletonProps {
  className?: string
  headerHeight?: string
  contentHeight?: string
}

export function CardSkeleton({
  className,
  headerHeight = "h-6",
  contentHeight = "h-32"
}: CardSkeletonProps) {
  return (
    <Card className={cn("animate-pulse", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className={cn("bg-gray-200 rounded w-32", headerHeight)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("bg-gray-100 rounded", contentHeight)} />
      </CardContent>
    </Card>
  )
}

export function StatCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-4 bg-gray-200 rounded" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="h-8 w-16 bg-gray-200 rounded" />
          <div className="h-5 w-16 bg-gray-100 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function TierCardSkeleton() {
  return (
    <Card className="h-full animate-pulse">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-4 bg-gray-100 rounded-full" />
          <div className="ml-auto h-6 w-6 bg-gray-200 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg border">
              <div className="h-5 w-5 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-gray-200 rounded" />
              </div>
              <div className="h-6 w-10 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function FunnelSkeleton() {
  return (
    <Card className="h-full animate-pulse">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-32 bg-gray-200 rounded" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="h-9 bg-blue-100 rounded-lg w-full" />
          <div className="h-9 bg-yellow-100 rounded-lg w-4/5" />
          <div className="h-9 bg-green-100 rounded-lg w-3/5" />
        </div>
        <div className="mt-2 pt-2 border-t flex justify-between">
          <div className="h-3 w-24 bg-gray-100 rounded" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

export function JourneyStageSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-28 bg-gray-200 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="w-32 h-32 bg-gray-100 rounded-full" />
          <div className="flex-1 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 bg-gray-200 rounded-full" />
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                </div>
                <div className="h-4 w-6 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ActivityStreamSkeleton() {
  return (
    <Card className="h-full animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-28 bg-gray-200 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" style={{ maxHeight: "450px" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0">
              <div className="p-2 rounded-full bg-blue-50">
                <div className="h-4 w-4 bg-blue-100 rounded" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-100 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentlyAddedSkeleton() {
  return (
    <Card className="h-full animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-28 bg-gray-200 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" style={{ maxHeight: "450px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-40 bg-gray-100 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                  <div className="h-5 w-14 bg-gray-100 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ChartSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gray-200 rounded" />
            <div className="h-5 w-40 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gray-200 rounded" />
            <div className="h-8 w-32 bg-gray-200 rounded" />
            <div className="h-8 w-8 bg-gray-200 rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] bg-gray-100 rounded relative overflow-hidden">
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </CardContent>
    </Card>
  )
}

export function StatsColumnSkeleton() {
  return (
    <Card className="h-full animate-pulse">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-24 bg-gray-200 rounded" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100">
                  <div className="h-4 w-4 bg-gray-200 rounded" />
                </div>
                <div className="space-y-1">
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="h-8 w-10 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Full dashboard skeleton for initial load
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="h-9 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-64 bg-gray-100 rounded mt-2 animate-pulse" />
      </div>

      {/* Row 1: Stats Column | Top Tier 1 | Top Tier 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <StatsColumnSkeleton />
        <TierCardSkeleton />
        <TierCardSkeleton />
      </div>

      {/* Row 2: Funnel + Journey | Activity Stream | Recently Added */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <FunnelSkeleton />
          <JourneyStageSkeleton />
        </div>
        <ActivityStreamSkeleton />
        <RecentlyAddedSkeleton />
      </div>

      {/* Chart */}
      <ChartSkeleton />
    </div>
  )
}

import type React from "react"
import { Suspense } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { FloatingNav } from "@/components/floating-nav"
import { requireStaffAccess } from "@/lib/access-control"
import { Skeleton } from "@/components/ui/skeleton"
import { connection } from "next/server"
import { WaveTelemetryIdentity } from "@/lib/telemetry/provider"

async function StaffDashboardGate({ children }: { children: React.ReactNode }) {
  await connection()
  await requireStaffAccess()
  return <>{children}</>
}

async function DashboardSidebar() {
  await connection()
  const access = await requireStaffAccess()
  return (
    <>
      <WaveTelemetryIdentity userId={access.user.id} role="staff" />
      <AppSidebar
        userEmail={access.user.email}
        userName={access.user.name ?? undefined}
        userAvatar={access.user.image ?? undefined}
      />
    </>
  )
}

function DashboardContentFallback() {
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
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider defaultOpen>
      <Suspense fallback={null}>
        <DashboardSidebar />
      </Suspense>
      <SidebarInset>
        <div className="flex min-h-svh flex-1 flex-col overflow-x-hidden">
            <Suspense fallback={null}>
              <FloatingNav />
            </Suspense>
            <div id="main-content" className="flex-1 px-4 py-5 md:px-6 md:py-6 xl:px-8">
              <div className="mx-auto w-full max-w-[1440px]">
                <Suspense fallback={<DashboardContentFallback />}>
                  <StaffDashboardGate>{children}</StaffDashboardGate>
                </Suspense>
              </div>
            </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

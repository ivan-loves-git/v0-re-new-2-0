import type React from "react"
import { cookies, headers } from "next/headers"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { FloatingNav } from "@/components/floating-nav"
import { auth } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get sidebar state from cookies
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  // Auth check is now handled by middleware - this just gets user info for display
  // V0 preview fallback
  const isV0Preview = process.env.VERCEL_ENV === undefined
  let userEmail = "preview@renew.com"
  let userName: string | undefined

  if (!isV0Preview) {
    const session = await auth.api.getSession({
      headers: await headers(),
    })
    // User is guaranteed to exist here because middleware redirects if not authenticated
    userEmail = session?.user?.email || "unknown@renew.com"
    userName = session?.user?.name
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar userEmail={userEmail} userName={userName} />
      <SidebarInset>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            <FloatingNav />
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

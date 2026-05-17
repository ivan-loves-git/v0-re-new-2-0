import type React from "react"
import { cookies } from "next/headers"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { FloatingNav } from "@/components/floating-nav"
import { requireStaffAccess } from "@/lib/access-control"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireStaffAccess()

  // Get sidebar state from cookies
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  // Get user info from Better Auth session cookie (faster than API call)
  // The session_data cookie contains cached user info
  const sessionDataCookie =
    cookieStore.get("__Secure-better-auth.session_data") ||
    cookieStore.get("better-auth.session_data")

  let userEmail = "preview@renew.com"
  let userName: string | undefined

  if (sessionDataCookie?.value) {
    try {
      const decoded = JSON.parse(
        Buffer.from(sessionDataCookie.value, "base64").toString("utf-8")
      )
      userEmail = decoded?.session?.user?.email || "unknown@renew.com"
      userName = decoded?.session?.user?.name
    } catch {
      // Fallback if cookie parsing fails
      userEmail = "unknown@renew.com"
    }
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

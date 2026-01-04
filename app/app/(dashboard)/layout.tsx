import type React from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth check is now handled by middleware - this just gets user info for display
  // V0 preview fallback
  const isV0Preview = process.env.VERCEL_ENV === undefined
  let userEmail = "preview@renew.com"

  if (!isV0Preview) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    // User is guaranteed to exist here because middleware redirects if not authenticated
    userEmail = user?.email || "unknown@renew.com"
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:block w-64 border-r">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userEmail={userEmail} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  )
}

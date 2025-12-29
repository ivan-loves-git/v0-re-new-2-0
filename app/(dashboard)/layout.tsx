import type React from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Only bypass auth in V0 preview (where VERCEL_ENV is undefined)
  // Vercel production AND preview deployments will have VERCEL_ENV set, so auth is enforced
  const isV0Preview = process.env.VERCEL_ENV === undefined

  let userEmail = "preview@renew.com"

  if (!isV0Preview) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/auth/login")
    }

    userEmail = user.email || "unknown@renew.com"
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

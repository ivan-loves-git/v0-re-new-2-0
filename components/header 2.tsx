"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { LogOut, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Sidebar } from "./sidebar"

interface HeaderProps {
  userEmail?: string
}

export function Header({ userEmail }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <header className="border-b bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <Sidebar />
            </SheetContent>
          </Sheet>
          <h2 className="text-lg font-semibold lg:hidden">Re-New Platform</h2>
        </div>
        <div className="flex items-center gap-4">
          {userEmail && <span className="text-sm text-gray-600 hidden sm:inline">{userEmail}</span>}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  )
}

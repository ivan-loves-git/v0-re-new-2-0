"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, GitBranch, FileText, Compass } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Repreneurs", href: "/repreneurs", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: GitBranch },
  { name: "Journey", href: "/journey", icon: Compass },
  { name: "Offers", href: "/offers", icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-gray-900 text-gray-100">
      <div className="flex h-16 items-center px-6 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Re-New Platform</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

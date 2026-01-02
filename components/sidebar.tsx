"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
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

  // Check if current path starts with a navigation item's href (for nested routes)
  const getIsActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-full flex-col bg-gray-900 text-gray-100">
      <div className="flex h-16 items-center px-6 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Re-New Platform</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = getIsActive(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute inset-0 bg-gray-800 rounded-lg"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 350,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

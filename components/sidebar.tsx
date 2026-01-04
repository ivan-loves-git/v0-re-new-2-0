"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  GitBranch,
  FileText,
  Compass,
  UserPlus,
  ExternalLink,
  GraduationCap,
  Mail,
  Target,
  BookOpen,
  Map,
  ClipboardList
} from "lucide-react"

const LOGO_EMOJIS = ["🌊", "✨", "🌹", "🌵", "🌙"]

const mainNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Repreneurs", href: "/repreneurs", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: GitBranch },
  { name: "Emails", href: "/emails", icon: Mail },
  { name: "Journey (WIP)", href: "/journey", icon: Compass },
  { name: "Offers (WIP)", href: "/offers", icon: FileText },
]

const guidelinesNavigation = [
  { name: "Mission", href: "/guide", icon: Target },
  { name: "Instructions", href: "/guide/instructions", icon: BookOpen },
  { name: "Roadmap", href: "/guide/roadmap", icon: Map },
  { name: "To Do", href: "/guide/todo", icon: ClipboardList },
]

const externalUsersNavigation = [
  { name: "Learnings", href: "/learnings-test", icon: GraduationCap },
  { name: "Public Intake", href: "/intake", icon: UserPlus, opensNewTab: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isHovering, setIsHovering] = useState(false)
  const [emojiIndex, setEmojiIndex] = useState(0)

  // Cycle through emojis when hovering
  useEffect(() => {
    if (!isHovering) {
      setEmojiIndex(0)
      return
    }

    const interval = setInterval(() => {
      setEmojiIndex((prev) => (prev + 1) % LOGO_EMOJIS.length)
    }, 150) // Fast cycle: 150ms

    return () => clearInterval(interval)
  }, [isHovering])

  // Check if current path starts with a navigation item's href (for nested routes)
  const getIsActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    // For guide pages, exact match for /guide, prefix match for others
    if (href === "/guide") {
      return pathname === "/guide"
    }
    return pathname.startsWith(href)
  }

  const renderNavItem = (item: { name: string; href: string; icon: React.ComponentType<{ className?: string }>; opensNewTab?: boolean }) => {
    // For items that open in new tab, use <a> tag
    if (item.opensNewTab) {
      return (
        <a
          key={item.name}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <span className="flex items-center gap-3">
            <item.icon className="h-5 w-5" />
            {item.name}
          </span>
          <ExternalLink className="h-3.5 w-3.5 opacity-50" />
        </a>
      )
    }

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
  }

  return (
    <div className="flex h-full flex-col bg-gray-900 text-gray-100">
      <div
        className="flex h-16 items-center px-6 border-b border-gray-800 cursor-pointer select-none"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="flex items-center gap-2">
          <span className="w-7 text-center text-2xl">{isHovering ? LOGO_EMOJIS[emojiIndex] : "🌊"}</span>
          <Image
            src="/wave-logo.png"
            alt="Wave - the repreneur CRM"
            width={96}
            height={32}
            className="h-auto"
            priority
          />
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {/* Re-New Team Section */}
        <div className="px-3 mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Re-New Team</p>
        </div>
        {mainNavigation.map(renderNavItem)}

        {/* Divider */}
        <div className="my-4 border-t border-gray-800" />

        {/* Guidelines Section */}
        <div className="px-3 mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Guidelines</p>
        </div>
        {guidelinesNavigation.map(renderNavItem)}

        {/* Divider */}
        <div className="my-4 border-t border-gray-800" />

        {/* External Users Navigation */}
        <div className="px-3 mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">External Users (test)</p>
        </div>
        {externalUsersNavigation.map(renderNavItem)}
      </nav>
    </div>
  )
}

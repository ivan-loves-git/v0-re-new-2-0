"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Search,
  GitBranch,
  Mail,
  BarChart3,
  Briefcase,
  Map,
  ChevronsUpDown,
  LogOut,
  Settings,
  User,
  Waves,
  type LucideIcon,
} from "lucide-react"
import { hasRecentRoadmapUpdates } from "@/lib/data/roadmap-status"
import { BUILD_VERSION } from "@/lib/version"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  badge?: string
  showNotification?: boolean
}

const repreneurNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard_re", icon: LayoutDashboard },
  { name: "Groups", href: "/repreneurs", icon: Users },
  { name: "Find", href: "/repreneurs/explore", icon: Search },
  { name: "Pipeline", href: "/pipeline", icon: GitBranch },
  { name: "Analytics", href: "/analytics_re", icon: BarChart3 },
]

const opportunityNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard_op", icon: LayoutDashboard },
  { name: "Analytics", href: "/analytics_op", icon: BarChart3 },
  { name: "Records", href: "/opportunities", icon: Briefcase },
]

const toolsNavigation: NavigationItem[] = [
  { name: "Emails", href: "/emails", icon: Mail },
  { name: "Wavy", href: "/tools/wavy", icon: Waves },
]

const projectNavigation: NavigationItem[] = [
  { name: "Roadmap", href: "/guide/roadmap", icon: Map, showNotification: true },
]

// External users section removed - dead routes cleaned up

interface AppSidebarProps {
  userEmail?: string
  userName?: string
  userAvatar?: string
}

export function AppSidebar({
  userEmail = "user@renew.com",
  userName,
  userAvatar,
}: AppSidebarProps) {
  const pathname = usePathname()
  const [isTouchActive, setIsTouchActive] = React.useState(false)
  const [isHovering, setIsHovering] = React.useState(false)
  const [emojiIndex, setEmojiIndex] = React.useState(0)
  const touchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const [supportsHover, setSupportsHover] = React.useState(false)
  const hasNewRoadmap = hasRecentRoadmapUpdates()

  const LOGO_EMOJIS = ["🌊", "✨", "🌹", "🌵", "🌙"]

  // Whether animation is active (touch on mobile, hover on desktop)
  const isAnimating = isTouchActive || isHovering

  // Detect hover capability on mount (client-side only)
  React.useEffect(() => {
    setSupportsHover(window.matchMedia('(hover: hover)').matches)
  }, [])

  // Cycle through emojis when animating
  React.useEffect(() => {
    if (!isAnimating) {
      setEmojiIndex(0)
      return
    }
    const interval = setInterval(() => {
      setEmojiIndex((prev) => (prev + 1) % LOGO_EMOJIS.length)
    }, 150)
    return () => clearInterval(interval)
  }, [isAnimating])

  // Cleanup touch timeout on unmount
  React.useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
    }
  }, [])

  // Handle touch - wiggle for 3 seconds then stop (mobile only)
  const handleTouchStart = () => {
    if (supportsHover) return // Don't handle touch on desktop
    if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
    setIsTouchActive(true)
    touchTimeoutRef.current = setTimeout(() => {
      setIsTouchActive(false)
    }, 3000)
  }

  // Handle mouse hover - ONLY on devices that support hover (desktop)
  // On mobile, synthetic mouse events fire after touch, so we must guard
  const handleMouseEnter = () => {
    if (!supportsHover) return // Ignore synthetic mouse events on mobile
    setIsHovering(true)
  }
  const handleMouseLeave = () => {
    if (!supportsHover) return
    setIsHovering(false)
  }

  // Check if current path is active
  const getIsActive = (href: string) => {
    if (href === "/dashboard_re") return pathname === "/dashboard_re" || pathname === "/dashboard"
    if (href === "/dashboard_op") return pathname === "/dashboard_op"
    if (href === "/analytics_re") return pathname === "/analytics_re" || pathname === "/analytics"
    if (href === "/analytics_op") return pathname === "/analytics_op"
    if (href === "/opportunities") return pathname === "/opportunities" || (pathname.startsWith("/opportunities/") && !pathname.startsWith("/opportunities/reviews"))
    // "Groups" (/repreneurs) should not match /repreneurs/explore
    if (href === "/repreneurs") return pathname === "/repreneurs" || (pathname.startsWith("/repreneurs/") && !pathname.startsWith("/repreneurs/explore"))
    return pathname.startsWith(href)
  }

  // Get user initials for avatar fallback
  const userInitials = userName
    ? userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : userEmail.slice(0, 2).toUpperCase()

  // Display name
  const displayName = userName || userEmail.split("@")[0]

  return (
    <Sidebar collapsible="icon" className="border-r-0 overflow-hidden">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent cursor-default hover:bg-transparent logo-button focus-visible:ring-0 focus-visible:ring-offset-0 outline-none"
              onTouchStart={handleTouchStart}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              tabIndex={-1}
            >
              <span className="w-7 text-center text-2xl">
                {isAnimating ? LOGO_EMOJIS[emojiIndex] : "🌊"}
              </span>
              <Image
                src="/wave-logo.png"
                alt="Wave - the repreneur CRM"
                width={96}
                height={32}
                className={`h-auto transition-transform logo-image ${isTouchActive ? "animate-wiggle" : ""}`}
                priority
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Content */}
      <SidebarContent>
        {/* Repreneurs Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Repreneurs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {repreneurNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={getIsActive(item.href)}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] font-medium opacity-50 bg-sidebar-accent px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Opportunities Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Opportunities</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {opportunityNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={getIsActive(item.href)}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] font-medium opacity-50 bg-sidebar-accent px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Tools Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={getIsActive(item.href)}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Project Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Project</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projectNavigation.map((item) => {
                const showRedDot = item.showNotification && hasNewRoadmap
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={getIsActive(item.href)}
                      tooltip={item.name}
                    >
                      <Link href={item.href}>
                        <span className="relative inline-flex">
                          <item.icon className="size-4" />
                          {showRedDot && (
                            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-red-500" />
                          )}
                        </span>
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      {/* Footer with User Account */}
      <SidebarFooter>
        {/* Build Version */}
        <div className="px-2 pb-1 text-center">
          <span className="text-[10px] text-sidebar-foreground/40 font-mono">
            {BUILD_VERSION}
          </span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={userAvatar} alt={displayName} />
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{displayName}</span>
                    <span className="truncate text-xs opacity-60">{userEmail}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 opacity-50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarImage src={userAvatar} alt={displayName} />
                      <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <User className="mr-2 size-4" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 size-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/auth/logout" className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 size-4" />
                    Log out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

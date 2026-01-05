"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
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
  ChevronsUpDown,
  LogOut,
  Settings,
  User,
  Sparkles,
} from "lucide-react"

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

// Navigation data
const mainNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Repreneurs", href: "/repreneurs", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: GitBranch },
  { name: "Emails", href: "/emails", icon: Mail },
  { name: "Journey", href: "/journey", icon: Compass, badge: "WIP" },
  { name: "Offers", href: "/offers", icon: FileText, badge: "WIP" },
]

const guidelinesNavigation = [
  { name: "Mission", href: "/guide", icon: Target },
  { name: "Instructions", href: "/guide/instructions", icon: BookOpen },
  { name: "Roadmap", href: "/guide/roadmap", icon: Map },
]

const externalUsersNavigation = [
  { name: "Learnings", href: "/learnings-test", icon: GraduationCap },
  { name: "Public Intake", href: "/intake", icon: UserPlus, external: true },
]

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

  // Handle mouse hover (desktop only - for emoji cycling, CSS handles animation)
  const handleMouseEnter = () => {
    if (supportsHover) setIsHovering(true)
  }
  const handleMouseLeave = () => {
    if (supportsHover) setIsHovering(false)
  }

  // Check if current path is active
  const getIsActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    if (href === "/guide") return pathname === "/guide"
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
              className="data-[state=open]:bg-sidebar-accent cursor-default hover:bg-transparent logo-button"
              onTouchStart={handleTouchStart}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <span className={`w-7 text-center text-2xl transition-transform ${isTouchActive ? "animate-wiggle" : ""}`}>
                {isAnimating ? LOGO_EMOJIS[emojiIndex] : "🌊"}
              </span>
              <Image
                src="/wave-logo.png"
                alt="Wave - the repreneur CRM"
                width={96}
                height={32}
                className={`h-auto transition-transform ${isTouchActive ? "animate-wiggle" : ""}`}
                priority
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Content */}
      <SidebarContent>
        {/* Re-New Team Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Re-New Team</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavigation.map((item) => (
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

        {/* Guidelines Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Guidelines</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {guidelinesNavigation.map((item) => (
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

        {/* External Users Section */}
        <SidebarGroup>
          <SidebarGroupLabel>External Users (test)</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {externalUsersNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  {item.external ? (
                    <SidebarMenuButton asChild tooltip={item.name}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <item.icon />
                        <span>{item.name}</span>
                        <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                      </a>
                    </SidebarMenuButton>
                  ) : (
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
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Account */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
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
                    <Avatar className="h-8 w-8 rounded-lg">
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
                  <DropdownMenuItem>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Upgrade to Pro
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/auth/logout" className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
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
